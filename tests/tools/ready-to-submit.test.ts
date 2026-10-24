/**
 * `docs/READY-TO-SUBMIT.md` is the one page a human works down at four store
 * consoles, and it carries the listing copy inline so that nothing has to be
 * looked up. Inline copy is a copy, and this repository has found the same
 * defect in a copy five times over: a fact pasted into one place goes on
 * shipping after the place it came from moves. So every block the page tells
 * a reader to paste names its source, and these tests hold each one to it.
 *
 * The source is `docs/STORE-LISTING.md`, which is hard-wrapped Markdown, for
 * reading. The page carries the same words in the form a store's plain-text
 * field takes: each paragraph on one line, no `**` or `*`, no backticks. No
 * store field renders Markdown, and a line break placed for an 80-column
 * editor is a line break in the listing, so pasting the source as written
 * would print its asterisks and break its sentences. `pasteForm()` is that
 * conversion and nothing else, so the words cannot drift.
 *
 * Beyond the copy: Chrome and Edge read the name and the short description out
 * of the package rather than off the form, so the package's strings are held
 * to the listing's; every permission the package declares has its
 * justification on the page, in each store that asks for one; every zip a
 * runbook names is this version's, which a version bump breaks silently (it
 * broke `SUBMIT.md` in five places on 2026-09-29); every piece of copy fits
 * the field it goes into; and the page's "tick none of the data boxes" stays
 * true only while every disclosure in the listing answers No.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

const PAGE = 'docs/READY-TO-SUBMIT.md';
const LISTING = 'docs/STORE-LISTING.md';

// A computed specifier, so tsc types the module as `any` rather than refusing
// an untyped .mjs import (TS7016). The manifest is the one source of truth for
// the version and the permissions, so it is read, not restated.
const manifest = await import(pathToFileURL(join(ROOT, 'manifest.config.mjs')).href);
const VERSION: string = manifest.VERSION;

/** Markdown for reading, as a store's plain-text field takes it. */
function pasteForm(markdown: string): string {
  return markdown
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) =>
      unmark(
        paragraph
          .split('\n')
          .map((line) => line.replace(/^>\s?/, '').trim())
          .join(' '),
      ),
    )
    .join('\n\n');
}

/** Drop emphasis and backticks, leaving what is inside a code span untouched. */
function unmark(text: string): string {
  const code: string[] = [];
  return text
    .replace(/`([^`]*)`/g, (_, span: string) => `@@${code.push(span) - 1}@@`)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*\s][^*]*?)\*/g, '$1')
    .replace(/@@(\d+)@@/g, (_, i: string) => code[Number(i)] ?? '');
}

/** The body of the `## ` section whose heading starts with `heading`. */
function section(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## ${heading}`));
  assert.notEqual(start, -1, `${LISTING} has no "## ${heading}" section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##? /.test(line));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

const listing = read(LISTING);

/** Each permission's justification, keyed by the permission it names. */
function justifications(): Map<string, string> {
  const out = new Map<string, string>();
  for (const paragraph of section(listing, 'Permission justifications').split(/\n\s*\n/)) {
    const flat = paragraph.split('\n').join(' ').trim();
    const match = /^\*\*([a-z_]+)\b.*?\*\* — (.+)$/i.exec(flat);
    if (match) out.set(match[1]!, pasteForm(match[2]!));
  }
  return out;
}

/** The first code span in the URL table's row for `field`. */
function urlFor(field: string): string {
  const row = section(listing, 'Support and privacy policy URLs')
    .split('\n')
    .find((line) => line.startsWith(`| ${field} |`));
  const url = row && /`([^`]+)`/.exec(row)?.[1];
  assert.ok(url, `${LISTING} gives no URL for "${field}"`);
  return url;
}

const SOURCES = new Map<string, () => string>([
  ['name', () => pasteForm(section(listing, 'Name'))],
  [
    'short-description',
    () =>
      pasteForm(
        section(listing, 'Short description')
          .split('\n')
          .filter((line) => line.startsWith('>'))
          .join('\n'),
      ),
  ],
  ['description', () => pasteForm(section(listing, 'Detailed description'))],
  ['single-purpose', () => pasteForm(section(listing, 'Single purpose statement'))],
  ['privacy-url', () => urlFor('Privacy policy URL')],
  ['support-url', () => urlFor('Support URL')],
  ...[...justifications()].map(
    ([permission, text]) => [`permission:${permission}`, () => text] as [string, () => string],
  ),
]);

interface Block {
  source: string;
  text: string;
  /** The `## ` heading the block sits under: which store's console it is for. */
  store: string;
  line: number;
}

/** Every `<!-- paste: <source> -->` marker on the page and the fenced block under it. */
function blocks(): Block[] {
  const lines = read(PAGE).split('\n');
  const out: Block[] = [];
  let store = '';
  lines.forEach((line, i) => {
    const heading = /^## (.+)$/.exec(line);
    if (heading) store = heading[1]!;
    const marker = /^<!-- paste: (\S+) -->$/.exec(line.trim());
    if (!marker) return;
    assert.ok(
      lines[i + 1]?.startsWith('```'),
      `${PAGE}:${i + 1}: a paste marker must sit directly above a fenced block`,
    );
    const end = lines.findIndex((l, j) => j > i + 1 && l === '```');
    assert.notEqual(end, -1, `${PAGE}:${i + 2}: the fenced block is never closed`);
    out.push({ source: marker[1]!, text: lines.slice(i + 2, end).join('\n'), store, line: i + 1 });
  });
  return out;
}

describe('the paste blocks on READY-TO-SUBMIT.md', () => {
  test('there are enough of them, in every store, for these tests to mean something', () => {
    const all = blocks();
    assert.ok(all.length >= 20, `only ${all.length} paste blocks were found on ${PAGE}`);
    for (const store of ['Chrome', 'Firefox', 'Edge', 'Safari']) {
      assert.ok(
        all.some((b) => b.store.startsWith(store)),
        `no paste block sits under a "## ${store}…" heading on ${PAGE}`,
      );
    }
  });

  test('every block names a source the listing has', () => {
    const unknown = blocks().filter((b) => !SOURCES.has(b.source));
    assert.deepEqual(
      unknown.map((b) => `${PAGE}:${b.line} names "${b.source}"`),
      [],
      `known sources: ${[...SOURCES.keys()].join(', ')}`,
    );
  });

  test('every block is its source, word for word, in paste form', () => {
    const drifted = blocks()
      .filter((b) => SOURCES.has(b.source))
      .filter((b) => b.text !== SOURCES.get(b.source)!())
      .map((b) => `${PAGE}:${b.line} (${b.source}) is not what ${LISTING} says`);
    assert.deepEqual(drifted, []);
  });
});

describe('what the stores read from the package rather than the page', () => {
  test('the package is named and described as the listing says', () => {
    const messages = JSON.parse(read('src/_locales/en/messages.json'));
    assert.equal(messages.extName.message, SOURCES.get('name')!());
    assert.equal(messages.extDescription.message, SOURCES.get('short-description')!());
  });

  test('every permission the Chrome package declares is justified for Chrome and for Edge, and nothing else is', () => {
    const declared = buildChromePermissions();
    for (const store of ['Chrome', 'Edge']) {
      const justified = blocks()
        .filter((b) => b.store.startsWith(store) && b.source.startsWith('permission:'))
        .map((b) => b.source.slice('permission:'.length))
        .sort();
      assert.deepEqual(justified, declared, `the ${store} section of ${PAGE}`);
    }
  });

  test('every zip a runbook names is this version’s', () => {
    for (const doc of [PAGE, 'docs/SUBMIT.md']) {
      const names = [...read(doc).matchAll(/weft-(chrome|firefox|safari)-(\d+\.\d+\.\d+)(-folder)?\.zip/g)];
      const stale = names.filter((m) => m[2] !== VERSION).map((m) => m[0]);
      assert.deepEqual(stale, [], `${doc} names a zip that version ${VERSION} does not build`);
    }
    const page = read(PAGE);
    for (const zip of [`weft-chrome-${VERSION}.zip`, `weft-firefox-${VERSION}.zip`]) {
      assert.ok(page.includes(zip), `${PAGE} never names ${zip}`);
    }
  });
});

/**
 * The limits each store's own documentation prints for the box a piece of
 * copy goes into, read on 2026-10-24. Copy that outgrows one fails here, by
 * name, rather than at the console. A store that prints no limit is not
 * listed: an invented number is worse than none.
 */
const LIMITS: { store: string; source: string; min?: number; max: number; url: string }[] = [
  {
    store: 'Chrome (manifest description)',
    source: 'short-description',
    max: 132,
    url: 'https://developer.chrome.com/docs/webstore/prepare',
  },
  {
    store: 'Edge',
    source: 'description',
    min: 250,
    max: 10_000,
    url: 'https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension',
  },
  {
    store: 'Mac App Store (name)',
    source: 'name',
    min: 2,
    max: 30,
    url: 'https://developer.apple.com/help/app-store-connect/reference/app-information/app-information',
  },
  {
    store: 'Mac App Store (description)',
    source: 'description',
    max: 4_000,
    url: 'https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information',
  },
];

describe('the listing behind the page', () => {
  test('every piece of copy fits the box each store gives it', () => {
    const misfits = LIMITS.map((limit) => ({ ...limit, length: [...SOURCES.get(limit.source)!()].length }))
      .filter(({ length, min = 0, max }) => length < min || length > max)
      .map(
        ({ store, source, length, min = 0, max, url }) =>
          `${source} is ${length} characters; ${store} takes ${min}–${max} (${url})`,
      );
    assert.deepEqual(misfits, []);
  });

  test('every data-usage disclosure answers No, so "tick none of the boxes" is true', () => {
    const answers = section(listing, 'Data usage disclosures')
      .split(/\n- /)
      .map((item) => item.split('\n').join(' ').trim())
      .map((item) => /^-?\s*\*\*(.+?\?)\*\*\s+(\S+)/.exec(item))
      .filter((m): m is RegExpExecArray => m !== null);
    assert.ok(answers.length >= 9, `only ${answers.length} disclosures were read`);
    const yes = answers.filter((m) => !m[2]!.startsWith('No')).map((m) => m[1]);
    assert.deepEqual(yes, [], `${PAGE} tells you to tick none of the data boxes`);
  });
});

/** The permissions a reviewer is shown for the Chrome package, sorted. */
function buildChromePermissions(): string[] {
  const m = manifest.buildManifest('chrome');
  const declared: string[] = [...m.permissions];
  if (m.optional_host_permissions?.length) declared.push('optional_host_permissions');
  return declared.sort();
}
