import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
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

export const test = base.extend<WeftFixtures>({
  context: async ({}, use) => {
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

export { expect } from '@playwright/test';

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
