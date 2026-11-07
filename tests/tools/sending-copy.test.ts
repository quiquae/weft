/**
 * What the public copy says a translation service is sent.
 *
 * Until 2026-11-05 five places a stranger reads said a translation service is
 * never sent page text, with no word of the switch that sends it: the README,
 * the privacy page's blockquote, the store listing's description and the four
 * copies `docs/READY-TO-SUBMIT.md` pastes of it, and the landing page's answer
 * to "Does Weft send the pages I read anywhere?". With “Send the surrounding
 * sentence” on, an OpenAI-compatible service is sent the sentence each word
 * appears in. The privacy page said, too, that the sentence goes to "your
 * chosen provider", and DeepL and Google are never sent it.
 *
 * So two rules, each read from the code rather than typed here. A paragraph
 * that says a service is never sent page text or the sentence names the
 * switch that sends it, by the title `whatIsSent()` gives it. And a paragraph
 * that says the sentence is sent names every service `SENTENCE_RECIPIENTS`
 * lists, by the name `whatIsSent()` uses, so a second recipient fails here
 * until the copy says so. The documents are the README, every tracked
 * Markdown file under `docs/` and the hand-written pages under `site/`: the
 * site prints `docs/PRIVACY.md` and `docs/SUPPORT.md` as `/privacy` and
 * `/support`, and every store's form links to the first.
 *
 * And a third, since 2026-11-05: a paragraph that says how often a word is
 * sent names the setting that decides it, “Keep answers for”, by the title of
 * the options row that sets `providers.cacheDays`, and one that names it says
 * the length it starts at and the most words the cache keeps, as the code
 * sets them. The privacy page said a word "is only ever sent once" in its
 * table and "at most once in that time" a page below, and the options row
 * said the first above a slider offering a year, while every save pruned the
 * cache at 180 days.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProviderId } from '../../src/core/types.ts';
import { SENTENCE_RECIPIENTS, whatIsSent } from '../../src/core/sending.ts';
import { MAX_PROVIDER_ENTRIES } from '../../src/core/prune.ts';
import { settings } from '../helpers.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** A paragraph of copy, and the line it starts on. */
interface Unit {
  where: string;
  text: string;
}

/** How the product's own copy names each service. */
const NAMES: Record<ProviderId, string> = {
  deepl: 'DeepL',
  google: 'Google',
  openai: 'OpenAI-compatible',
};

/** What the dashboard and the settings page say with the sentence switched on. */
const ON = whatIsSent({ enabled: true, sendContext: true });

/** The switch that sends the sentence, by the title the product's copy gives it. */
const SWITCHES = [...ON.matchAll(/“([^”]+)”/g)].map((m) => m[1]!);

/**
 * A service said never to be sent page text, or the sentence. "No sentence",
 * since 2026-11-07: `docs/ARCHITECTURE.md` closed on "No sentence-level
 * translation. The unit of work is a word, everywhere, including on the
 * provider path", which every other form here missed.
 */
const DENIES =
  /\b(?:never|not|no)\s+(?:any\s+)?page text\b|\b(?:never|not)\s+(?:the|a|any)\s+sentences?\b|\bnever\s+sentences\b|\bno\s+sentences?\b/i;

/** The sentence said to be sent, to go somewhere, or to be received. */
const SENDS = [
  /\bsentences?\b[^.;:]*?\b(?:goes|go|sent|leaves?|receives?)\b/i,
  /\b(?:sends?|sending|sent|receives?)\b[^.;:]*?\bsentences?\b/i,
];

/** The title of the options row that sets how long an answer is kept, read off the page. */
const KEEP = (() => {
  const source = readFileSync(join(ROOT, 'src/ui/options/data.tsx'), 'utf8');
  const bound = source.indexOf("c.set('providers.cacheDays'");
  const title = /\btitle="([^"]+)"/.exec(source.slice(source.lastIndexOf('<Row', bound), bound));
  if (bound < 0 || !title) throw new Error('no options row sets providers.cacheDays, or it has no title');
  return title[1]!;
})();

/** What the cache's bounds are, as the code sets them and the copy writes them. */
const KEPT_DAYS = String(settings().providers.cacheDays);
const KEPT_WORDS = MAX_PROVIDER_ENTRIES.toLocaleString('en');

/** A word said to be sent once, or once ever. */
const ONCE = /\bsent\b[^.;:]*?\bonce\b|\bonce\s+ever\b/i;

/** Says how often a word is sent, and not what decides it. */
const unboundedOnce = (u: Unit) => ONCE.test(u.text) && !u.text.includes(KEEP);

const namesSwitch = (u: Unit) => SWITCHES.some((name) => u.text.includes(name));

/** Says the sentence never leaves, and does not say what sends it. */
const unnamedSwitch = (u: Unit) => DENIES.test(u.text) && !namesSwitch(u);

/** Says the sentence is sent, and leaves out a service it is sent to. */
const unnamedRecipients = (u: Unit) =>
  (namesSwitch(u) || SENDS.some((re) => re.test(u.text))) &&
  SENTENCE_RECIPIENTS.some((id) => !u.text.includes(NAMES[id]));

/**
 * Markdown's paragraphs and list items as a reader sees them: quoting,
 * emphasis and code marks dropped. A fence, a comment or a heading ends the
 * paragraph beside it, so a pasted block reads as the box it goes into.
 */
function markdownUnits(file: string, text: string): Unit[] {
  const out: Unit[] = [];
  let start = 0;
  let lines: string[] = [];
  const flush = () => {
    const flat = lines.join(' ').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();
    if (flat) out.push({ where: `${file}:${start + 1}`, text: flat });
    lines = [];
  };
  text.split('\n').forEach((raw, i) => {
    if (/^\s*>?\s*$/.test(raw) || /^\s*(?:```|<!--|<\/?details|#{1,6}\s)/.test(raw)) {
      flush();
      return;
    }
    const line = raw.replace(/^\s*(?:>\s?)+/, '');
    const item = /^\s*(?:[-*+]|\d+\.)\s+/;
    if (item.test(line)) flush();
    if (!lines.length) start = i;
    lines.push(line.replace(item, ''));
  });
  flush();
  return out;
}

/**
 * What a hand-written page tells a search engine and shows a reader: every
 * string of its structured data, which is where the landing page answers
 * its questions, every `<meta>` content, and its text blocks.
 */
function htmlUnits(file: string, html: string): Unit[] {
  const lineOf = (index: number) => html.slice(0, index).split('\n').length;
  const flat = (s: string) =>
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
  const out: Unit[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const strings: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(JSON.parse(m[1]!));
    for (const s of strings) {
      const at = html.indexOf(s.slice(0, 40), m.index);
      out.push({ where: `${file}:${lineOf(at >= 0 ? at : m.index)}`, text: s });
    }
  }
  for (const m of html.matchAll(/<meta\b[^>]*\bcontent="([^"]*)"/g)) {
    out.push({ where: `${file}:${lineOf(m.index)}`, text: flat(m[1]!) });
  }
  // Scripts and styles blanked to the same length, so an index still finds its line.
  const body = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, (s) => ' '.repeat(s.length));
  const blocks = /<(p|li|td|th|h[1-6]|dt|dd|figcaption|summary|blockquote|caption)\b[^>]*>([\s\S]*?)<\/\1>/g;
  for (const m of body.matchAll(blocks)) {
    out.push({ where: `${file}:${lineOf(m.index)}`, text: flat(m[2]!) });
  }
  return out;
}

const FILES = execFileSync('git', ['ls-files', 'README.md', 'docs/*.md', 'site/*.html'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const documents = FILES.map((file) => {
  const text = readFileSync(join(ROOT, file), 'utf8');
  return { file, units: file.endsWith('.html') ? htmlUnits(file, text) : markdownUnits(file, text) };
});
const paragraphs = documents.flatMap((d) => d.units);
const quote = (u: Unit) => `${u.where}: ${u.text.length > 100 ? `${u.text.slice(0, 100)}…` : u.text}`;

describe('what the public copy says a translation service is sent', () => {
  test('the documents are read', () => {
    assert.ok(documents.length >= 12, `only ${documents.length} documents were read: ${FILES.join(', ')}`);
    assert.ok(paragraphs.length >= 500, `only ${paragraphs.length} paragraphs were read`);
    const page = documents.find((d) => d.file === 'site/index.html');
    assert.ok(page && page.units.length >= 20, 'the landing page gave the reader nothing to read');
  });

  test('the switch and the services are named as the product names them', () => {
    assert.equal(SWITCHES.length, 1, `expected one switch named in whatIsSent(): ${ON}`);
    for (const [id, name] of Object.entries(NAMES) as Array<[ProviderId, string]>) {
      assert.ok(ON.includes(name), `whatIsSent() does not call ${id} “${name}”: ${ON}`);
    }
  });

  test('a paragraph that says the sentence never leaves names the switch that sends it', () => {
    assert.deepEqual(
      paragraphs.filter(unnamedSwitch).map(quote),
      [],
      `with “${SWITCHES[0]}” on, ${ON}`,
    );
  });

  test('a paragraph that says the sentence is sent names every service it goes to', () => {
    const recipients = SENTENCE_RECIPIENTS.map((id) => NAMES[id]).join(', ');
    assert.deepEqual(
      paragraphs.filter(unnamedRecipients).map(quote),
      [],
      `the sentence goes to ${recipients} and to no other service`,
    );
  });

  test('a paragraph that says how often a word is sent names the setting that decides it', () => {
    assert.deepEqual(
      paragraphs.filter(unboundedOnce).map(quote),
      [],
      `a word is sent again once its answer is older than “${KEEP}”, or is not among the newest ${KEPT_WORDS}`,
    );
  });

  test('a paragraph that names how long answers are kept says the bounds the code sets', () => {
    const told = paragraphs.filter((u) => u.text.includes(KEEP));
    assert.ok(told.length >= 2, `only ${told.length} paragraphs name “${KEEP}”: ${told.map(quote).join('; ')}`);
    assert.deepEqual(
      told.filter((u) => !u.text.includes(KEPT_DAYS) || !u.text.includes(KEPT_WORDS)).map(quote),
      [],
      `answers are kept for ${KEPT_DAYS} days unless the reader changes it, and for the newest ${KEPT_WORDS} words at most`,
    );
  });

  test('the public copy says the sentence can be sent', () => {
    const told = paragraphs.filter(namesSwitch);
    assert.ok(
      told.length >= 3,
      `only ${told.length} paragraphs name “${SWITCHES[0]}”: ${told.map(quote).join('; ')}`,
    );
  });
});

describe('the reader', () => {
  test('reads Markdown as a reader does', () => {
    const probe = [
      '> A provider receives **single words**. Never page',
      '> text.',
      '',
      '- **Website content?** No. Never sentences.',
      '- Another `item`',
      '<!-- paste: description -->',
      '```text',
      'One paragraph.',
      '',
      'Two *marked* words.',
      '```',
    ].join('\n');
    assert.deepEqual(markdownUnits('probe.md', probe), [
      { where: 'probe.md:1', text: 'A provider receives single words. Never page text.' },
      { where: 'probe.md:4', text: 'Website content? No. Never sentences.' },
      { where: 'probe.md:5', text: 'Another item' },
      { where: 'probe.md:8', text: 'One paragraph.' },
      { where: 'probe.md:10', text: 'Two marked words.' },
    ]);
  });

  test('reads a page’s structured data, its descriptions and its text', () => {
    const probe = [
      '<meta name="description" content="Words &amp; more">',
      '<script type="application/ld+json">',
      '{"a": [{"text": "Never page text, says the answer."}]}',
      '</script>',
      '<p>A <strong>visible</strong>',
      'paragraph.</p>',
    ].join('\n');
    assert.deepEqual(htmlUnits('probe.html', probe), [
      { where: 'probe.html:3', text: 'Never page text, says the answer.' },
      { where: 'probe.html:1', text: 'Words & more' },
      { where: 'probe.html:5', text: 'A visible paragraph.' },
    ]);
  });

  test('refuses a denial without its switch, and a sending without its recipients', () => {
    const u = (text: string): Unit => ({ where: 'probe', text });
    const name = SWITCHES[0];
    assert.ok(unnamedSwitch(u('It sends single words, never page text.')));
    assert.ok(unnamedSwitch(u('The word and its number. Not the sentence. Not the page.')));
    assert.ok(!unnamedSwitch(u(`Not the sentence, unless you turn on “${name}”.`)));
    assert.ok(!unnamedSwitch(u('A file can switch sentence context off.')));
    assert.ok(unnamedRecipients(u('When it is on, one sentence goes to your chosen provider.')));
    assert.ok(unnamedRecipients(u(`Turn on “${name}” for better answers.`)));
    assert.ok(unnamedRecipients(u('Sending one sentence of surrounding context is a separate opt-in.')));
    assert.ok(!unnamedRecipients(u(`With “${name}” on, an ${NAMES.openai} service is sent the sentence.`)));
    assert.ok(!unnamedRecipients(u('A file can switch lookups or sentence context off, and that lands at once.')));
  });

  test('refuses a claim of how often a word is sent without the setting that decides it', () => {
    const u = (text: string): Unit => ({ where: 'probe', text });
    assert.ok(unboundedOnce(u('Word → translation, so a word is only ever sent once.')));
    assert.ok(unboundedOnce(u('What leaves your machine, per word, once ever.')));
    assert.ok(unboundedOnce(u('Answers are cached for as long as you configure, so a word is sent at most once in that time.')));
    assert.ok(!unboundedOnce(u(`Kept for as many days as “${KEEP}” says, so a word is sent at most once in that time.`)));
    assert.ok(!unboundedOnce(u('Worth doing only once you are ready to be present.')));
  });
});
