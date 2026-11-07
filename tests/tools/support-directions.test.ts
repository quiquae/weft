/**
 * The support page's directions, held to the product they direct a reader
 * through.
 *
 * `docs/SUPPORT.md` is published as `/support`, the support address the
 * store listings give, and the one reading it is somebody for whom Weft is
 * not working, who will do what it says. Until 2026-11-07 it sent them to
 * "the first-run page from Settings", which the settings page does not link;
 * it said that taking a site off the never-weave list "is a
 * difficulty-reducing change and waits out a cooldown", where the lock judges
 * a longer never-weave list the easier one, so adding a site waits and taking
 * one off applies at once; and it said the dashboard "says no network request
 * has ever been made", which the dashboard says only until one has.
 *
 * So three rules, over the documents a user is sent to:
 *
 *  - every line of the interface they quote in bold is one the interface
 *    prints;
 *  - every path into Weft's settings, `Settings → **Row** → **Control**`, is
 *    written in bold so it can be read, and each step of it names a title or
 *    a control the settings page has;
 *  - and every sentence that says which change to the never-weave list waits
 *    says what `directionOf()` says, read in the source, the README, every
 *    tracked Markdown file under `docs/` and the hand-written pages under
 *    `site/`. It is the one list whose longer form is the easier one — a
 *    longer taxed or gentle list weaves more, a longer never-weave list less —
 *    which is why a sentence written from the other two gets it backwards.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { directionOf } from '../../src/core/lock.ts';
import { DEFAULT_EXCLUSIONS, NEVER_WEAVE_KINDS } from '../../src/core/sites.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const tracked = (...specs: string[]) =>
  execFileSync('git', ['ls-files', ...specs], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);

/** The documents a user is sent to, rather than the ones a contributor is. */
const USER_DOCS = [
  'README.md',
  'docs/SUPPORT.md',
  'docs/PRIVACY.md',
  'docs/PRICING.md',
  'docs/HARD-MODE.md',
];

/** The interface's own text, whitespace collapsed and JSX's `{' '}` dropped. */
function flatSource(files: string[]): string {
  return files
    .map((f) => read(f))
    .join('\n')
    .replace(/\{'\s*'\}/g, ' ')
    .replace(/\s+/g, ' ');
}

const UI = flatSource(tracked('src/ui/*.tsx', 'src/ui/*.ts'));
const SETTINGS = flatSource(tracked('src/ui/options/*.tsx'));

/** A line of the interface a document quotes in bold: **"…"** or **“…”**. */
function quotedLines(text: string): string[] {
  return [...text.matchAll(/\*\*["“]([^"”*]+)["”]\*\*/g)].map((m) =>
    m[1]!.trim().replace(/[.:]$/, ''),
  );
}

/**
 * Whether the interface prints a line: as a whole string, a whole text node or
 * a whole sentence of one, so a fragment of a line is not the line.
 */
function printed(source: string, line: string): boolean {
  const esc = line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const before = `(?<=^|["'\`{(>]|>\\s|[.!?]\\s)`;
  const after = `(?=$|\\s*["'<\`{}]|[.,:;!?](?:\\s|$|["'<\`{}]))`;
  return new RegExp(`${before}${esc}${after}`).test(source);
}

interface SettingsPath {
  where: string;
  steps: string[];
}

/**
 * Every path into Weft's settings a document gives, and every one written so
 * that it cannot be read. "System Settings" is the Mac's and a path under a
 * repository's "Settings" is GitHub's, so neither is Weft's.
 */
function settingsPaths(where: string, text: string): { paths: SettingsPath[]; unread: string[] } {
  const flat = text.replace(/\s+/g, ' ');
  const paths: SettingsPath[] = [];
  const unread: string[] = [];
  for (const m of flat.matchAll(/(?<!System |macOS )\bSettings\s*(?:→|->)\s*/g)) {
    const rest = flat.slice(m.index! + m[0].length);
    if (/^Pages\b/.test(rest)) continue; // GitHub's repository settings
    const steps: string[] = [];
    let at = 0;
    for (;;) {
      const step = /^\*\*([^*]+)\*\*/.exec(rest.slice(at));
      if (!step) break;
      steps.push(step[1]!.trim());
      at += step[0].length;
      const arrow = /^\s*(?:→|->)\s*/.exec(rest.slice(at));
      if (!arrow) break;
      at += arrow[0].length;
    }
    if (steps.length) paths.push({ where, steps });
    else unread.push(`${where}: Settings → ${rest.slice(0, 40)}`);
  }
  return { paths, unread };
}

/** A title or a control the settings page has. */
const onSettingsPage = (step: string) =>
  SETTINGS.includes(`title="${step}"`) || printed(SETTINGS, step);

// ---------------------------------------------------------------------------
// Which change to the never-weave list waits.

type Verb = 'add' | 'remove';
type Says = 'waits' | 'at once';

interface Claim {
  where: string;
  verb: Verb;
  says: Says;
  clause: string;
}

/**
 * A sentence that names the never-weave list, another list, or one already
 * named. The list has gone by three names: the privacy page calls it a
 * deny-list and the source a never-touch list, and both said until
 * 2026-11-07 that taking an entry off it waits, which a reader that knew only
 * "never-weave" could not see. An entry of the list is the list's too.
 */
const NAMES_LIST = /\bnever[- ]weave\b|\bnever-touch list\b|\bdeny-list\b/i;
const OTHER_LIST = /\b(?:taxed|gentle)\b/i;
const ANAPHOR = /\b(?:the list|this list|it|entry|entries)\b/i;
const ADD = /\badd(?:s|ed|ing)?\b/i;
const REMOVE =
  /\b(?:remov(?:e|es|ed|ing)|tak(?:e|es|en|ing)\s+(?:\w+\s+){0,2}off|drop(?:s|ped|ping)?|delet(?:e|es|ed|ing))\b/i;
const WAITS =
  /\bcooldown\b|\bwaits?\b|\bqueued\b|\breduction in difficulty\b|\bdifficulty-reducing\b|\bmakes? (?:Weft|it|the page|a page) easier\b/i;
const AT_ONCE = /\bat once\b|\bimmediately\b|\binstantly\b|\bstraight away\b|\bmakes? (?:Weft|it|the page|a page) harder\b/i;

/** Text as a reader sees it: comment markers, Markdown emphasis and tags gone. */
function prose(text: string): string {
  return text
    .split('\n')
    // A quote marker is a `>` with words after it: one alone on its line
    // closes a JSX tag.
    .map((line) => line.replace(/^\s*(?:\*|\/\/|>(?=\s+\S))\s?/, ''))
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Every claim a text makes about which change to the never-weave list waits.
 * A settings row's `detail` is read as naming its `title`'s list, because the
 * row prints the two together and the detail says "it".
 */
function claims(where: string, text: string): Claim[] {
  const sentencesOf = (t: string) => t.split(/(?<=[.!?])\s+/);
  const named: string[] = [];
  for (const row of text.matchAll(/title="([^"]*)"\s+detail="([^"]*)"/g)) {
    if (NAMES_LIST.test(row[1]!)) named.push(...sentencesOf(row[2]!).map((s) => `${row[1]}: ${s}`));
  }
  // A paragraph or a list item that names the list goes on calling it "the
  // list" or "it" until it names another, and so does every paragraph under
  // a heading that names it, as the privacy page's "The never-weave list"
  // does, until the next heading.
  // A line opening with `*` is a list item in Markdown and the next line of
  // a doc comment in source, which read line by line could never name the
  // list and say which way it goes in one paragraph, as the source's own
  // account of the list did not.
  const item = /\.md$/.test(where) ? /\n(?=\s*(?:[-*+]|\d+\.)\s)/ : /\n(?=\s*(?:[-+]|\d+\.)\s)/;
  let section = false;
  for (const paragraph of text.split(new RegExp(`\\n\\s*\\n|${item.source}`))) {
    if (/^\s*#{1,6}\s/.test(paragraph)) {
      section = NAMES_LIST.test(paragraph);
      continue;
    }
    let naming = section;
    for (const sentence of sentencesOf(prose(paragraph))) {
      if (NAMES_LIST.test(sentence)) naming = true;
      else if (OTHER_LIST.test(sentence)) naming = false;
      if (naming && (NAMES_LIST.test(sentence) || ANAPHOR.test(sentence))) named.push(sentence);
    }
  }
  const out: Claim[] = [];
  for (const sentence of named) {
    {
      for (const clause of sentence.split(/;|\s[—–]\s|,\s(?:but|while|whereas)\s/)) {
        const verbs = [ADD.test(clause) && 'add', REMOVE.test(clause) && 'remove'].filter(Boolean);
        const says = [WAITS.test(clause) && 'waits', AT_ONCE.test(clause) && 'at once'].filter(Boolean);
        if (verbs.length === 1 && says.length === 1) {
          out.push({ where, verb: verbs[0] as Verb, says: says[0] as Says, clause: clause.trim() });
        }
      }
    }
  }
  return out;
}

/** What the lock says of each change, as the copy would say it. */
const EXPECTED: Record<Verb, Says> = {
  add: directionOf('sites.excluded', ['a.example'], ['a.example', 'b.example']) === 'easier' ? 'waits' : 'at once',
  remove: directionOf('sites.excluded', ['a.example', 'b.example'], ['a.example']) === 'easier' ? 'waits' : 'at once',
};

const misstated = (c: Claim) => c.says !== EXPECTED[c.verb];

const COPY = tracked('src/*.ts', 'src/*.tsx', 'README.md', 'docs/*.md', 'site/*.html');
const found = COPY.flatMap((file) => claims(file, read(file)));

describe('the support page quotes the interface and gives paths into it', () => {
  test('every line of the interface a user document quotes in bold is one the interface prints', () => {
    const quotes = USER_DOCS.flatMap((doc) => quotedLines(read(doc)).map((line) => ({ doc, line })));
    // Four on 2026-11-07: the support page's three popup lines and the privacy page's switch.
    assert.ok(quotes.length >= 4, `only ${quotes.length} quoted lines were read`);
    assert.deepEqual(
      quotes.filter((q) => !printed(UI, q.line)).map((q) => `${q.doc}: “${q.line}”`),
      [],
      'a document quotes a line the interface does not print',
    );
  });

  test('every path into the settings page is written so it can be read, and leads somewhere', () => {
    const read_ = USER_DOCS.map((doc) => settingsPaths(doc, read(doc)));
    const paths = read_.flatMap((r) => r.paths);
    assert.deepEqual(
      read_.flatMap((r) => r.unread),
      [],
      'write each step of a path into the settings page in bold, so this test can read it',
    );
    // Four on 2026-11-07: Help, Your data, Sites and Hard Mode.
    assert.ok(paths.length >= 4, `only ${paths.length} paths into the settings page were read`);
    assert.deepEqual(
      paths.flatMap((p) =>
        p.steps.filter((s) => !onSettingsPage(s)).map((s) => `${p.where}: Settings → … **${s}**`),
      ),
      [],
      'a path names a step the settings page does not have',
    );
  });

  test('the readers find what they are for, and refuse what they should', () => {
    assert.deepEqual(quotedLines('Click **"Weave this site."** then **“Grant access”**.'), [
      'Weave this site',
      'Grant access',
    ]);
    assert.ok(!printed('Gather the details', 'Gather the'), 'a fragment of a line counted as the line');
    const { paths, unread } = settingsPaths(
      'probe',
      'Settings → **Help** → **Gather the details**. Settings → export writes a file. ' +
        'System Settings → General → Device Management. Settings → Pages → Source.',
    );
    assert.deepEqual(paths, [{ where: 'probe', steps: ['Help', 'Gather the details'] }]);
    assert.equal(unread.length, 1, 'a path written without bold was not caught');
    assert.ok(onSettingsPage('Gather the details') && onSettingsPage('Never weave'));
    assert.ok(!onSettingsPage('Reopen the first-run page'), 'a control the page lacks was found');
  });
});

describe('which change to the never-weave list is said to wait', () => {
  test('the lock judges a longer never-weave list the easier one', () => {
    assert.deepEqual(EXPECTED, { add: 'waits', remove: 'at once' });
  });

  test('the reader reads both directions and both verbs, and nothing else', () => {
    const refused = [
      'You can edit the never-weave list in Settings, but taking something off it is a difficulty-reducing change and waits out a cooldown.',
      'Adding a site to the never-weave list applies at once.',
      'Removing a pattern from the never-weave list waits out the cooldown.',
    ];
    for (const text of refused) {
      const said = claims('probe', text);
      assert.equal(said.length, 1, `no claim was read in “${text}”`);
      assert.ok(misstated(said[0]!), `“${text}” was accepted`);
    }
    const both = claims(
      'probe',
      'Adding a site to the never-weave list makes Weft easier, so it waits out a cooldown; taking one off applies at once.',
    );
    assert.equal(both.length, 2, 'a sentence saying both was not read as two claims');
    assert.ok(!both.some(misstated), 'the lock’s own rule was refused');
    const row = claims(
      'probe.tsx',
      '<Row\n  title="Never weave"\n  detail="Beats every other rule. Adding to it goes through the cooldown."\n>',
    );
    assert.equal(row.length, 1, 'a settings row’s detail was not read under its title');
    const section = claims(
      'probe.md',
      '## The never-weave list\n\nWeft ships a deny-list.\n\n' +
        'You can remove entries, but removing one is a difficulty-reducing change and goes through the cooldown.\n\n' +
        '## Gentle sites\n\nRemoving one from the list waits out the cooldown.',
    );
    assert.equal(section.length, 1, 'a paragraph under a heading naming the list was not read, or one under the next was');
    assert.ok(misstated(section[0]!), 'taking an entry off a never-weave section was accepted as waiting');
    const otherName = claims(
      'probe.ts',
      '/**\n * Default never-touch list. Users can remove entries; they cannot remove\n' +
        ' * them silently (it is a difficulty-reducing change and goes through the cooldown).\n */',
    );
    assert.equal(otherName.length, 1, 'the list was not read under its other name');
    for (const text of [
      'Two swaps never touch. Remove it and it waits out the cooldown.',
      'Words from the never-weave list are never sent at all.',
      'Take a site off the list and it waits out a cooldown.',
      'The never-weave list beats every other rule.',
    ]) {
      assert.deepEqual(claims('probe', text), [], `“${text}” was read as a claim about the never-weave list`);
    }
  });

  test('the copy is read, and the settings row says which way it goes', () => {
    assert.ok(COPY.length >= 70, `only ${COPY.length} files were read`);
    assert.ok(found.length >= 2, `only ${found.length} claims about the never-weave list were found`);
    assert.ok(
      found.some((c) => c.where === 'src/ui/options/sites.tsx'),
      'the never-weave row on the settings page no longer says which change waits',
    );
  });

  test('every sentence that says which change to the never-weave list waits says the lock’s rule', () => {
    assert.deepEqual(
      found.filter(misstated).map((c) => `${c.where}: “${c.clause}”`),
      [],
      'adding to the never-weave list makes Weft easier and waits; taking a site off applies at once',
    );
  });
});

// ---------------------------------------------------------------------------
// What the never-weave list covers.

/** A kind's words, whole, wherever a line break falls between them. */
const namesKind = (sentence: string, kind: string) =>
  new RegExp(`\\b${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i').test(sentence);

interface Listing {
  where: string;
  sentence: string;
  missing: string[];
}

/**
 * Every sentence that lists what the never-weave list covers, read with its
 * tags left in, since a settings row's detail is an attribute of one. A
 * sentence naming two of the list's kinds is listing them; one naming a
 * single kind is not, as "your mail is never woven" is not.
 */
function listings(where: string, text: string): Listing[] {
  const flat = text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\*|\/\/)\s?/, ''))
    .join(' ')
    .replace(/[*`_]/g, '')
    .replace(/\s+/g, ' ');
  return flat
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => NEVER_WEAVE_KINDS.filter((k) => namesKind(sentence, k.kind)).length >= 2)
    .map((sentence) => ({
      where,
      sentence,
      missing: NEVER_WEAVE_KINDS.filter((k) => !namesKind(sentence, k.kind)).map((k) => k.kind),
    }));
}

/**
 * The shipped pages and the documents a user is sent to. Not the list itself,
 * which names every kind by construction, and not the store listing or the
 * landing page, whose "money, mail, credentials and health" is a summary of
 * what the list covers rather than an account of it, a call `TODO.md` leaves
 * for a human.
 */
const ACCOUNTS = [...tracked('src/*.ts', 'src/*.tsx').filter((f) => f !== 'src/core/sites.ts'), ...USER_DOCS];
const listed = ACCOUNTS.flatMap((file) => listings(file, read(file)));

describe('what the never-weave list is said to cover', () => {
  test('the shipped list is its kinds, a kind at a time', () => {
    assert.deepEqual(DEFAULT_EXCLUSIONS, NEVER_WEAVE_KINDS.flatMap((k) => k.patterns));
    // Six on 2026-11-07.
    assert.ok(NEVER_WEAVE_KINDS.length >= 6, `only ${NEVER_WEAVE_KINDS.length} kinds`);
    assert.deepEqual(NEVER_WEAVE_KINDS.filter((k) => k.patterns.length === 0).map((k) => k.kind), []);
    assert.equal(new Set(DEFAULT_EXCLUSIONS).size, DEFAULT_EXCLUSIONS.length, 'a pattern is in two kinds');
  });

  test('the reader finds a listing, and what it leaves out', () => {
    const partial = listings('probe', 'Weft ships this list covering money, mail, credentials and health. It is checked first.');
    assert.equal(partial.length, 1, 'a sentence naming two kinds was not read as a listing');
    assert.deepEqual(partial[0]!.missing, NEVER_WEAVE_KINDS.map((k) => k.kind).filter((k) => k !== 'mail' && k !== 'money'));
    assert.deepEqual(listings('probe', 'Your mail is never woven. Nor is an email.'), [], 'one kind was read as a listing');
    const row = listings(
      'probe.tsx',
      '<Row\n  title="Never weave"\n  detail="Beats every other rule. It covers ' +
        NEVER_WEAVE_KINDS.map((k) => k.kind).join(',\n ') +
        '."\n>',
    );
    assert.equal(row.length, 1, 'a settings row’s detail was not read');
    assert.deepEqual(row[0]!.missing, [], 'a kind broken across a line was not found');
  });

  test('every sentence that lists what the never-weave list covers names every kind', () => {
    assert.ok(ACCOUNTS.length >= 60, `only ${ACCOUNTS.length} files were read`);
    for (const page of ['src/ui/options/sites.tsx', 'src/ui/onboarding/index.tsx', 'docs/SUPPORT.md']) {
      assert.ok(listed.some((l) => l.where === page), `${page} no longer says what the never-weave list covers`);
    }
    assert.deepEqual(
      listed.filter((l) => l.missing.length).map((l) => `${l.where}: “${l.sentence}” leaves out ${l.missing.join('; ')}`),
      [],
      'name every kind the list ships, in its words: ' + NEVER_WEAVE_KINDS.map((k) => k.kind).join(', '),
    );
  });
});
