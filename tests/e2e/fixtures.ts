import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTENSION = join(HERE, '../../dist/chrome');
const PAGES = join(HERE, 'pages');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
};

/**
 * A real HTTP origin for the tests.
 *
 * Weft refuses to run on file: URLs — that exclusion is one of the things
 * under test — so the fixtures are served over http from localhost, which is
 * also the origin the test build grants itself.
 */
async function startServer(): Promise<{ server: Server; origin: string }> {
  const server = createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const name = path === '/' ? '/article.html' : path;
    try {
      const body = await readFile(join(PAGES, name));
      res.writeHead(200, { 'content-type': MIME[extname(name)] ?? 'text/plain' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  /*
   * Short keep-alive, because this server has to be able to die.
   *
   * Chromium holds keep-alive connections open to the origin it loaded a
   * page from, and `server.close()` waits for every open connection before
   * its callback fires. With Node's 5-second default the teardown outlived
   * the 60-second test timeout in CI and nine tests failed with
   * "Tearing down 'origin' exceeded the test timeout" — not one of them a
   * real failure, every one of them a test that had actually loaded a page.
   */
  server.keepAliveTimeout = 500;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { server, origin: `http://localhost:${port}` };
}

export interface WeftFixtures {
  context: BrowserContext;
  extensionId: string;
  worker: Worker;
  origin: string;
  /** Configure the extension through its own message API. */
  configure(patch: Record<string, unknown>): Promise<void>;
  /** Send any request to the background worker from an extension page. */
  rpc<T = unknown>(request: Record<string, unknown>): Promise<T>;
}

/**
 * Refuse to run against a production build, and say so in one line.
 *
 * `npm run test:e2e` is `build:test && playwright test && build`. That
 * trailing `build` is deliberate — it stops a test-seamed extension lingering
 * on disk, and `tools/validate-package.mjs` fails a package whose manifest
 * carries `host_permissions` or whose name still says "test build". The cost
 * is that `dist/chrome` is a *production* build once the suite finishes, and
 * so also after `npm run test:all`, which ends in `build:all`.
 *
 * A production manifest grants no localhost origin, so `configure()`'s
 * `origins: []` leaves the content script unregistered and nothing is ever
 * woven. Every spec then fails on whatever it waits for first: the three
 * generator specs behind `WEFT_STORE` / `WEFT_SCREENS` / `WEFT_FIRSTRUN` are
 * the ones that meet it, because they are the ones a human runs by hand
 * rather than through `npm run test:e2e`.
 *
 * That cost a session. `WEFT_STORE=1 npx playwright test store-assets` was
 * diagnosed as a broken generator and written up as one — 20 seconds of
 * "element(s) not found: locator('weft-w')" names the renderer, the lexicon
 * and the settings before it names the build, and three hypotheses about the
 * extension's own code were eliminated before anyone looked at the manifest
 * on disk. So the check is here rather than in any one spec, and it names the
 * command that fixes it.
 */
async function requireTestBuild(): Promise<void> {
  const manifest = join(EXTENSION, 'manifest.json');
  let m: { host_permissions?: string[] };
  try {
    m = JSON.parse(await readFile(manifest, 'utf8'));
  } catch {
    throw new Error(
      `No extension at ${EXTENSION}. Run \`npm run build:test\` first, or use \`npm run test:e2e\`.`,
    );
  }
  const granted = m.host_permissions ?? [];
  if (!granted.some((p) => p.includes('localhost'))) {
    throw new Error(
      `${manifest} is a production build: it declares no localhost host permission, so the ` +
        'fixtures cannot grant the test origin and nothing will ever be woven. Run ' +
        '`npm run build:test` first, or run the whole suite with `npm run test:e2e`, which ' +
        'builds the test extension and restores the production one afterwards.',
    );
  }
}

export const test = base.extend<WeftFixtures>({
  context: async ({}, use) => {
    await requireTestBuild();
    const userDataDir = await mkdtemp(join(tmpdir(), 'weft-e2e-'));
    // `channel: 'chromium'` selects the full Chromium build rather than the
    // headless shell, which has no extension support at all. Extensions also
    // require a persistent context; they cannot be loaded into an ephemeral
    // one.
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION}`,
        `--load-extension=${EXTENSION}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    await use(context);
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },

  /**
   * The extension id, computed rather than discovered.
   *
   * Chrome derives an unpacked extension's id from the SHA-256 of its
   * absolute path, mapping each nibble to a-p. Computing it is more reliable
   * than waiting for the service worker, because an MV3 worker is lazy: it
   * may have started and been killed again before a test looks.
   */
  extensionId: async ({}, use) => {
    const hash = createHash('sha256').update(EXTENSION).digest();
    let id = '';
    for (let i = 0; i < 16; i++) {
      id += String.fromCharCode(97 + ((hash[i] as number) >> 4));
      id += String.fromCharCode(97 + ((hash[i] as number) & 0x0f));
    }
    await use(id);
  },

  worker: async ({ context, rpc }, use) => {
    // Touching the worker through a message is what wakes it, so the fixture
    // pokes it before looking for it.
    await rpc({ type: 'get-settings' });
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20_000 });
    await use(worker);
  },

  origin: async ({}, use) => {
    const { server, origin } = await startServer();
    await use(origin);
    await new Promise<void>((resolve) => {
      // close() stops accepting and then waits for existing connections.
      // The browser's keep-alive sockets are exactly such connections, so
      // without destroying them first the callback may never fire. Guarded
      // because closeAllConnections is Node 18.2+ and the message it would
      // otherwise produce ("exceeded the test timeout") names the wrong
      // culprit entirely.
      server.closeAllConnections?.();
      server.close(() => resolve());
    });
  },

  rpc: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    const call = async <T>(request: Record<string, unknown>): Promise<T> => {
      return page.evaluate(async (req) => {
        const reply = await chrome.runtime.sendMessage(req);
        if (!reply?.ok) throw new Error(reply?.error ?? 'no reply');
        return reply.data;
      }, request) as Promise<T>;
    };
    await use(call);
    await page.close();
  },

  configure: async ({ rpc, origin }, use) => {
    const host = new URL(origin).hostname;
    const configure = async (patch: Record<string, unknown>) => {
      await rpc({
        type: 'complete-onboarding',
        patch: {
          'sites.taxed': [{ pattern: host, enabled: true, escalate: true }],
          'sites.gentle': [],
          'learning.introduceNewPerDay': 500,
          ...patch,
        },
        origins: [],
      });
      // Registration is what actually puts the content script on the page.
      await rpc({ type: 'reregister-scripts' });
    };
    await use(configure);
  },
});

export { expect };

/** Text of an element with whitespace collapsed, for stable comparison. */
export const squash = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** Count how many words of `text` are not in `original`. */
export function changedWordCount(original: string, text: string): number {
  const a = squash(original).split(' ');
  const b = squash(text).split(' ');
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) n++;
  return n;
}

/**
 * Frame a viewport capture on one section, with its top edge at the top
 * of the shot and nothing above it in view.
 *
 * This replaces `scrollIntoViewIfNeeded()`, which states no alignment:
 * Blink picks one from the element's position and the viewport height, so
 * the landing point was a function of the frame size and erred in both
 * directions. Four of the six scrolled captures were cut across a row of
 * content, and it took someone opening the files to notice — they are
 * byte-stable, so the reproducibility diff and `artefacts:check` were
 * both satisfied. `apple-04-progress.png` cut the tops off all four
 * progress tiles' digits and `apple-05-settings.png` halved the preset
 * button row, which is the row *above* the target bleeding in; but
 * `chrome-05-settings.png` halved the "Resting density" heading and
 * `edge-05-settings.png` lost it altogether and opened mid-sentence,
 * which is the target section's own head cut off.
 *
 * Integer `scrollTo`, not `scrollIntoView({ block: 'start' })`: a
 * fractional scroll offset shifts subpixel text rendering, and these
 * fifteen files are compared byte for byte. `Math.ceil` rather than
 * `Math.round` so the rounding error is spent on the section's own top
 * padding rather than on a sliver of the row above it.
 *
 * The word-level `scrollIntoViewIfNeeded()` in scene 3 is deliberately
 * left alone: it makes a word hoverable rather than framing a shot, and
 * a partly visible line of prose at the top of an article screenshot is
 * what reading an article looks like.
 *
 * **It lives in the fixtures rather than in `store-assets.spec.ts` because
 * that spec was not the only generator doing this.** `firstrun.spec.ts` had
 * the same call on the same kind of selector, `.section:has(.help__report)`,
 * and the session that fixed the four store captures never looked at it. Its
 * shot happened to land correctly at 1000x900, which is the trap rather than
 * a reprieve: the four store shots were byte-stable too, and
 * `artefacts:check` called that group `ok` for as long as they were clipped.
 * One implementation means the two-sided assertion cannot be present in one
 * generator and absent in another, and `tests/tools/shot-framing.test.ts`
 * fails if any generator frames a section some other way.
 */
export const frameOn = async (page: Page, selector: string) => {
  const section = page.locator(selector).first();
  await section.evaluate((el) => {
    window.scrollTo(0, Math.ceil(el.getBoundingClientRect().top + window.scrollY));
  });
  await page.waitForTimeout(400);
  const box = await section.boundingBox();
  expect(box, `${selector} is not in the layout, so the scene has nothing to frame on`)
    .not.toBeNull();
  const y = box?.y ?? 0;
  /*
   * Two-sided on purpose, and that is the whole finding. A section
   * sitting below the top of the viewport leaves the row above it half
   * in shot; one sitting above the top has its own heading cut off. Both
   * shipped, in different frames, from the same call. The upper bound
   * also catches the case a deliberate offset cannot fix on its own — a
   * scroll clamped by the end of the document, which leaves the row
   * above in shot however precisely the target was computed.
   */
  expect(
    y,
    `${selector} sits ${Math.round(y)}px below the top of the viewport, so whatever is ` +
      'above it is half in shot',
  ).toBeLessThanOrEqual(0.5);
  expect(
    y,
    `${selector} sits ${Math.round(-y)}px above the top of the viewport, so the scene is ` +
      'cutting the head off the row it exists to show',
  ).toBeGreaterThanOrEqual(-1.5);
};
