/**
 * What the privacy page and the listing say each permission is for.
 *
 * `docs/PRIVACY.md` is `/privacy`, and its table "Permissions, and why each
 * one" is the account a reader holds the install prompt against;
 * `docs/STORE-LISTING.md` gives Google and Microsoft the same account a
 * permission at a time, and `docs/READY-TO-SUBMIT.md` pastes it, held to the
 * listing by `ready-to-submit.test.ts`. Until 2026-11-07 both said `alarms`
 * ran "the daily rollover of attention counters", which no alarm does — the
 * reading day is worked out by `dayKey()` whenever a counter is read or
 * written — and neither named the alarm that ends a panic pass, the one that
 * writes the vocabulary to storage, or the notification that answers a panic
 * pass asked for from the keyboard.
 *
 * So the table names exactly the permissions the targets' manifests declare,
 * a row a target leaves out naming that target; every alarm the code sets,
 * read off its `alarms.create` calls, and every notification it sends, read
 * off its `notify` calls, is a job `ALARMS` or `NOTICES` names, with the
 * words both accounts must use for it; and a job no code does, `NOT_DONE`,
 * is refused. An alarm or a notification added later fails until both
 * accounts say what it is for.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const config = await import(pathToFileURL(join(ROOT, 'manifest.config.mjs')).href);
const TARGETS = config.TARGETS as string[];

/** How a row names a target that leaves its permission out. */
const TARGET_NAMES: Record<string, string> = { chrome: 'Chrome', firefox: 'Firefox', safari: 'Safari' };

interface Job {
  /** The words both accounts of the permission use for it. */
  words: RegExp;
  /** What the code does, for the failure message. */
  does: string;
}

/** Every alarm the code sets, by the first argument of its `alarms.create`. */
const ALARMS: Record<string, Job> = {
  LOCK_ALARM: { words: /cooldown/i, does: 'applies a change whose cooldown has ended' },
  FLUSH_ALARM: { words: /vocabulary/i, does: 'writes the vocabulary to storage once a minute' },
  "'weft-panic-end'": { words: /panic pass/i, does: 'ends a panic pass' },
};

/** Every notification the worker sends, by the decision its handler reports. */
const NOTICES: Record<string, Job> = {
  applyReadyChanges: { words: /queued/i, does: 'says a queued change has applied' },
  usePanicPass: { words: /panic pass/i, does: 'answers a panic pass asked for from the keyboard' },
};

/** Jobs an account once gave a permission that no code does, and why not. */
const NOT_DONE: Record<string, { words: RegExp; why: string }[]> = {
  alarms: [
    {
      words: /roll(?:s|ing)?[ -]?over/i,
      why: 'no alarm rolls the day over: dayKey() works the reading day out whenever a counter is read or written',
    },
  ],
};

/** Every permission some target's manifest declares, with the targets declaring it. */
function declared(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const target of TARGETS) {
    for (const permission of config.buildManifest(target).permissions as string[]) {
      if (!out.has(permission)) out.set(permission, new Set());
      out.get(permission)!.add(target);
    }
  }
  return out;
}

/** The privacy page's permission table: each row's permission and its reason. */
function tableRows(doc: string): Map<string, string> {
  const [, section = ''] = doc.split('## Permissions, and why each one');
  const table = section.split(/\n## /)[0]!;
  const rows = new Map<string, string>();
  for (const line of table.split('\n')) {
    const m = /^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (m) rows.set(m[1]!, m[2]!);
  }
  return rows;
}

/** The listing's justification of each permission, one paragraph each, marks dropped. */
function listingParagraphs(doc: string): Map<string, string> {
  const [, section = ''] = doc.split('## Permission justifications');
  const body = section.split(/\n### |\n## /)[0]!;
  const out = new Map<string, string>();
  for (const paragraph of body.split(/\n\s*\n/)) {
    const m = /^\*\*(\w+)\*\* — ([\s\S]+)$/.exec(paragraph.trim());
    if (m) out.set(m[1]!, m[2]!.replace(/\s+/g, ' ').replace(/[*`]/g, ''));
  }
  return out;
}

/** Every tracked source file under `src/`. */
function sources(): { file: string; text: string }[] {
  return execFileSync('git', ['ls-files', 'src'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f))
    .map((file) => ({ file, text: read(file) }));
}

/** The first argument of every `alarms.create` call under `src/`. */
function alarmsSet(): string[] {
  return sources().flatMap(({ text }) =>
    [...text.matchAll(/alarms\.create\(\s*([^,)]+?)\s*[,)]/g)].map((m) => m[1]!),
  );
}

/** For each `notify(` call in the worker, which `NOTICES` handler it reports. */
function noticesSent(source: string): { at: number; handlers: string[] }[] {
  const out: { at: number; handlers: string[] }[] = [];
  for (const m of source.matchAll(/(?<!function )\bnotify\(/g)) {
    const before = source.slice(0, m.index);
    const listener = before.lastIndexOf('addListener(');
    const span = before.slice(listener < 0 ? 0 : listener);
    out.push({
      at: before.split('\n').length,
      handlers: Object.keys(NOTICES).filter((name) => span.includes(`${name}(`)),
    });
  }
  return out;
}

const privacy = read('docs/PRIVACY.md');
const listing = read('docs/STORE-LISTING.md');

describe("the privacy page's permission table", () => {
  test('names exactly the permissions the manifests declare', () => {
    const rows = tableRows(privacy);
    const permissions = declared();
    assert.ok(permissions.size >= 5, `only ${permissions.size} permissions were read off the manifests`);
    const missing = [...permissions.keys()].filter((p) => !rows.has(p));
    const strays = [...rows.keys()].filter((p) => !permissions.has(p));
    assert.deepEqual(missing, [], `no row for ${missing.join(', ')}, which a manifest declares`);
    assert.deepEqual(strays, [], `a row for ${strays.join(', ')}, which no manifest declares`);
  });

  test('a row for a permission a target leaves out names that target', () => {
    const rows = tableRows(privacy);
    const unnamed: string[] = [];
    for (const [permission, targets] of declared()) {
      for (const target of TARGETS.filter((t) => !targets.has(t))) {
        if (!rows.get(permission)?.includes(TARGET_NAMES[target]!)) unnamed.push(`${permission} (${target})`);
      }
    }
    assert.deepEqual(unnamed, [], `these rows do not say which build leaves them out: ${unnamed.join(', ')}`);
  });
});

describe('every job a permission does is named wherever it is justified', () => {
  const accounts = (permission: string) => [
    { where: `docs/PRIVACY.md's ${permission} row`, text: tableRows(privacy).get(permission) ?? '' },
    { where: `docs/STORE-LISTING.md's ${permission} paragraph`, text: listingParagraphs(listing).get(permission) ?? '' },
  ];

  test('every alarm the code sets is one ALARMS names, and every line names one it sets', () => {
    const set = alarmsSet();
    assert.ok(set.length >= 3, `only ${set.length} alarms.create calls were read under src/`);
    const unnamed = [...new Set(set)].filter((id) => !(id in ALARMS));
    const stale = Object.keys(ALARMS).filter((id) => !set.includes(id));
    assert.deepEqual(unnamed, [], `src/ sets ${unnamed.join(', ')}, which ALARMS does not name with what it is for`);
    assert.deepEqual(stale, [], `ALARMS names ${stale.join(', ')}, which nothing under src/ sets`);
  });

  test('every notification the worker sends reports one decision NOTICES names', () => {
    const worker = read('src/background/index.ts');
    const sent = noticesSent(worker);
    assert.ok(sent.length >= 2, `only ${sent.length} notify( calls were read in src/background/index.ts`);
    const unclear = sent.filter((s) => s.handlers.length !== 1).map((s) => `index.ts:${s.at}`);
    assert.deepEqual(unclear, [], `these notifications report no one decision NOTICES names: ${unclear.join(', ')}`);
    const stale = Object.keys(NOTICES).filter((name) => !sent.some((s) => s.handlers.includes(name)));
    assert.deepEqual(stale, [], `NOTICES names ${stale.join(', ')}, which no notification reports`);
    const elsewhere = sources()
      .filter(({ file, text }) => file !== 'src/background/index.ts' && /notifications\.create\(/.test(text))
      .map(({ file }) => file);
    assert.deepEqual(elsewhere, [], `a notification sent past notify(): ${elsewhere.join(', ')}`);
  });

  for (const [permission, jobs] of [
    ['alarms', ALARMS],
    ['notifications', NOTICES],
  ] as const) {
    test(`both accounts of ${permission} name every job it does, and none it does not`, () => {
      const faults: string[] = [];
      for (const { where, text } of accounts(permission)) {
        if (!text) {
          faults.push(`${where} is missing`);
          continue;
        }
        for (const job of Object.values(jobs)) {
          if (!job.words.test(text)) faults.push(`${where} does not say it ${job.does}`);
        }
        for (const wrong of NOT_DONE[permission] ?? []) {
          if (wrong.words.test(text)) faults.push(`${where} claims a job no code does: ${wrong.why}`);
        }
      }
      assert.deepEqual(faults, []);
    });
  }
});

/**
 * Every file whose click asks the browser for a site, and the words an
 * account of where Weft asks must use for it. Until 2026-11-07 every account
 * — the privacy page, the listing's justification of the host permission and
 * its two pasted copies, the answer `docs/READY-TO-SUBMIT.md` and
 * `docs/SUBMIT.md` give a reviewer, and a launch draft — said the first-run
 * page, and the toolbar popup and Settings → Sites ask as well.
 */
const REQUESTERS: Record<string, Job> = {
  'src/ui/onboarding/index.tsx': { words: /first-run page/i, does: 'asks from the first-run page' },
  // Not /i: "the sites the user selects" names no page.
  'src/ui/options/sites.tsx': { words: /\bSites\b|[Ss]ettings page/, does: 'asks from Settings → Sites' },
  'src/ui/popup/index.tsx': { words: /popup/i, does: 'asks from the toolbar popup' },
};

/**
 * Every paragraph of a published or submitted document that says where Weft
 * asks for a site: one naming the first-run page beside a request, quote
 * markers, emphasis and code marks dropped.
 */
function hostAccounts(): { where: string; text: string }[] {
  const files = execFileSync('git', ['ls-files', 'README.md', 'docs/*.md', 'site/*.html'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);
  const out: { where: string; text: string }[] = [];
  for (const file of files) {
    let line = 1;
    for (const block of read(file).split(/(\n\s*\n)/)) {
      const text = block
        .replace(/^\s*>\s?/gm, '')
        .replace(/[*`]/g, '')
        .replace(/\s+/g, ' ');
      if (/first-run page/i.test(text) && /\b(?:requests?|requested|asks? for)\b/i.test(text)) {
        out.push({ where: `${file}:${line}`, text });
      }
      line += block.split('\n').length - 1;
    }
  }
  return out;
}

describe('a request for anything but a site is Firefox’s data collection consent, from one switch', () => {
  test('every other permissions.request asks for website content, and only where a service is turned on', () => {
    const calls = sources().flatMap(({ file, text }) =>
      [...text.matchAll(/permissions\.request\(\s*([^)]*)\)/g)].map((m) => ({ file, arg: m[1]!.trim() })),
    );
    assert.ok(calls.length >= 3, `only ${calls.length} permissions.request calls were read`);
    const other = calls.filter((c) => !/^\{\s*origins\b/.test(c.arg));
    const wrong = other.filter(
      (c) => c.file !== 'src/ui/options/data.tsx' || !/^\{\s*data_collection:\s*\['websiteContent'\]\s*\}/.test(c.arg),
    );
    assert.deepEqual(wrong.map((c) => `${c.file}: ${c.arg}`), []);
    assert.equal(other.length, 1, 'the data collection consent is asked from exactly one place');
  });
});

describe('every page that asks for a site is named wherever the asking is described', () => {
  test('every file that asks the browser for a site is one REQUESTERS names, and no other', () => {
    const asking = sources()
      .filter(({ text }) => /permissions\.request\(\s*\{\s*origins\b/.test(text))
      .map(({ file }) => file);
    assert.ok(asking.length >= 2, `only ${asking.length} files under src/ call permissions.request(`);
    const unnamed = asking.filter((f) => !(f in REQUESTERS));
    const stale = Object.keys(REQUESTERS).filter((f) => !asking.includes(f));
    assert.deepEqual(unnamed, [], `${unnamed.join(', ')} asks for a site, and REQUESTERS does not name it`);
    assert.deepEqual(stale, [], `REQUESTERS names ${stale.join(', ')}, which asks for nothing`);
  });

  test('every account of where Weft asks names every page that does', () => {
    const accounts = hostAccounts();
    assert.ok(accounts.length >= 5, `only ${accounts.length} accounts of where Weft asks for a site were found`);
    const faults: string[] = [];
    for (const { where, text } of accounts) {
      for (const job of Object.values(REQUESTERS)) {
        if (!job.words.test(text)) faults.push(`${where} does not say Weft ${job.does}`);
      }
    }
    assert.deepEqual(faults, []);
  });
});
