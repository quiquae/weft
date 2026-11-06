#!/usr/bin/env node
/**
 * Build the content site from the lexicons.
 *
 * The dataset IS the search strategy. Weft has ~700 Latin and Old English
 * entries carrying etymological descent, reconstructed pronunciation,
 * grammatical gender and false-friend notes. Nobody else has that curated
 * together, which makes each page genuinely worth landing on — and each one
 * answers a real query ("what is the Old English word for house", "where does
 * vaccine come from").
 *
 * Two deliberate restrictions:
 *
 * **Only Latin and Old English get a page per word.** Modern-language entries
 * carry gender and a plural and nothing else, and 1,800 pages of that is thin
 * content at scale — which hurts a domain rather than helping it. The modern
 * languages get a few rich curated lists instead.
 *
 * **No fabricated example sentences.** It is tempting to template "The old
 * {word} stood at the end of a long road" for every noun, but that produces
 * nonsense for half of them and a reader can tell. The pages show the
 * interlinear gloss, which is what the product actually does.
 */
import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANS, formatPrice, PITCH } from '../src/core/pricing.ts';
import { SOLD } from '../src/core/entitlements.ts';
import { entriesByTarget, spelling } from '../src/core/lexicon.ts';
import { getLanguage } from '../src/core/languages.ts';
import { contentDate, sitemapXml } from './sitemap.ts';
import { markSvg } from './brand.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = join(ROOT, 'src/lexicon/packs');
/** Hand-written sources: the landing page, the stylesheet, the images. */
const SRC = join(ROOT, 'site');
/**
 * Everything generated goes here, sources copied in alongside it.
 *
 * Keeps 700 generated files out of the repository — they are derived from the
 * lexicon and would otherwise churn every time a word changed — while making
 * the deployable artefact a single directory.
 *
 * Overridable with `--out=<dir>` so a test can build somewhere disposable.
 * Without it, testing this tool means deleting and rewriting the directory
 * `npm run site:check` reads, which is rude at best and misleading at worst.
 */
const outArg = process.argv.slice(2).find((a) => a.startsWith('--out='));
const OUT = outArg ? resolve(outArg.slice('--out='.length)) : join(ROOT, 'dist/site');

/** Change this to the domain you publish on. Everything canonical derives from it. */
const SITE = process.env.WEFT_SITE_URL ?? 'https://weft.study';

/** Languages rich enough to justify a page per word. */
const DEEP = ['la', 'ang'];

/**
 * `descent` is a pair rather than a string because the two languages put the
 * English descendant in different places, and a template that always appends
 * gets one of them backwards. Old English's frame takes its object at the end
 * ("…that became **abide**"); Latin's needs it before the preposition, since
 * "borrowed **from** X" makes X the *source*, and the source is this page's
 * own headword. Latin keeps *borrowed* rather than borrowing the sibling's
 * *became* because a learned borrowing is what it is: `vaccine` did not become
 * anything, it was coined from `vacca`.
 *
 * `index` is the same distinction where the language index states it — its
 * title, the description a search result and a shared link print, and its
 * lead. It was one string for both languages until 2026-10-03, so the Latin
 * index said its words had "the English word they became", in the verbs the
 * feed had stopped using for Latin the day before.
 *
 * The pronunciation key is not here. It is `pronunciationNote` in
 * `src/core/languages.ts`, which the tooltip prints too; this held a copy of
 * it until 2026-10-04, and the copy had drifted in both languages.
 */
const META = {
  la: {
    name: 'Latin',
    endonym: 'Latina',
    era: 'Classical, c. 75 BC – AD 200',
    slug: 'latin',
    descent: { before: 'This is the Latin word your English', after: 'was borrowed from' },
    index: {
      title: 'with the English words borrowed from them',
      description: 'the English word borrowed from them',
      lead: 'the English word borrowed from them',
    },
  },
  ang: {
    name: 'Old English',
    endonym: 'Englisc',
    era: 'West Saxon, c. 900–1050',
    slug: 'old-english',
    descent: { before: 'This is the Old English word that became', after: '' },
    index: {
      title: 'with their English descendants',
      description: 'the English word they became',
      lead: 'the English word they turned into',
    },
  },
};

const POS_LABEL = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  num: 'number',
  intj: 'interjection',
  phrase: 'phrase',
};

const GENDER_LABEL = { m: 'masculine', f: 'feminine', n: 'neuter', c: 'common' };
const BAND_LABEL = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/* ------------------------------------------------------------------ utils */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The descent sentence, with the English descendant set inside the frame
 * rather than appended to it. See the note above `META`: appending is what
 * put the descendant after Latin's "from" and so named it as the source.
 *
 * The lexicon note, where there is one, is joined into the same sentence with
 * a dash rather than following its full stop. A note is written as an
 * appositive fragment — 141 of the 185 distinct notes across the packs open in
 * lower case — because the surfaces it was written for give it its own block:
 * `src/content/tooltip.ts` a `<div class="note">`, the descent hub a `<td>`.
 * This is the one place a note abuts a finished sentence, so this is the one
 * place it has to be joined to it.
 *
 * A dash rather than a render-time capital, which was measured: of the 99
 * notes that reach a word page, 39 open with a quotation mark around a cited
 * form and 5 with a proper noun, so capitalising would be a no-op on 44 of
 * them and would capitalise the cited Latin of "paene īnsula, almost an
 * island". Every capital already in the corpus is required by a name rather
 * than by sentence position, so a dash needs no exception list.
 */
function descentSentence(meta, etymonOf, note) {
  const tail = meta.descent.after ? ` ${esc(meta.descent.after)}` : '';
  const aside = note ? ` — ${esc(note)}` : '';
  return `${esc(meta.descent.before)} <strong>${esc(etymonOf)}</strong>${tail}${aside}.`;
}

/**
 * URL slug for a target word.
 *
 * Strips diacritics and the historical letterforms so that URLs stay ASCII
 * and typeable, while the page itself shows the word properly spelled. A URL
 * containing þ and a macron is a URL nobody can share by voice.
 *
 * Takes the word apart before it spells anything, because a letter that
 * arrives precomposed with its mark is not yet the letter the table knows:
 * `ǣ` is one code point. Spelled first, `ǣ` slipped past the rule for `æ`,
 * lost its macron, and the bare `æ` left behind became a hyphen — so `sǣ`
 * was published as `/old-english/s` and `ǣfen` as `/old-english/fen`, 22
 * headwords in all.
 *
 * Not unique on its own, and it cannot be: see `assignSlugs()` below.
 */
function slugify(word) {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/[þð]/g, 'th')
    .replace(/ƿ/g, 'w')
    .replace(/ȝ/g, 'g')
    .replace(/ſ/g, 's')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Give every entry in one language a slug no other entry in it shares.
 *
 * `slugify()` is handed one word, so it cannot see a collision however
 * carefully it is written — uniqueness is a property of the whole set, and
 * the set is only known here. Stripping a macron is exactly what collides
 * in Latin, where vowel length is the entire distinction between two words:
 * `ōs` (mouth) and `os` (bone) both reduce to `os`, as do `liber` (book) and
 * `līber` (free). The second page written then silently overwrote the first,
 * and because the survivor is a valid file every link to either still
 * resolved — so `npm run site:check` passed while two words had no page.
 *
 * Where a base slug is shared, *every* member takes the English word it
 * glosses as a suffix — `os-mouth` and `os-bone` — rather than one keeping
 * the bare slug. Two reasons: whichever kept it would be decided by pack
 * order, which is the unstable-ordering defect this project has already
 * fixed twice; and a bare `/latin/os` is a claim to be the only `os`, which
 * is the thing that is not true.
 */
function assignSlugs(entries) {
  const shared = new Map();
  for (const e of entries) {
    // A homograph number is not part of the address either: `hund²` shares
    // `hund`'s base, so the two words are `hund-dog` and `hund-hundred`.
    const base = slugify(spelling(e.tgtLemma));
    if (!shared.has(base)) shared.set(base, []);
    shared.get(base).push(e);
  }
  for (const [base, group] of shared) {
    for (const e of group) {
      e.slug = group.length === 1 ? base : `${base}-${slugify(e.lemma)}`;
    }
  }
}

/**
 * How the header paints the mark: in the text colour, so it follows the
 * theme, with the warp held back so the weft reads as lying over it.
 *
 * Only the paint is decided here. The shapes are `tools/brand.ts`, the same
 * ones the toolbar icon is filled from — this template used to carry its own
 * copy of them, which went on drawing the old mark on every page after the
 * icon was redrawn. `site/index.html` is hand-written and still carries the
 * markup inline; `tests/tools/build-site.test.ts` reads it back off the
 * rendered page and fails if it is not this drawing.
 */
const HEADER_PAINT = { warp: 'currentColor', weft: 'currentColor', warpOpacity: 0.45 };

function page({ title, description, canonical, jsonLd, body, breadcrumbs }) {
  const crumbs = breadcrumbs?.length
    ? `<nav class="crumbs" aria-label="Breadcrumb">${breadcrumbs
        .map((c, i) =>
          i === breadcrumbs.length - 1
            ? `<span aria-current="page">${esc(c.label)}</span>`
            : `<a href="${esc(c.href)}">${esc(c.label)}</a>`,
        )
        .join('<span class="crumbs__sep" aria-hidden="true">/</span>')}</nav>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:site_name" content="Weft">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og.png">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/weft.css">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
<main>
  <div class="brand">
    <a href="/" aria-label="Weft home">
      ${markSvg(HEADER_PAINT, { indent: '      ' })}
    </a>
    <span><a href="/">Weft</a></span>
  </div>
  ${crumbs}
${body}
  <footer>
    <p>
      From the <a href="/">Weft</a> lexicon — a browser extension that weaves words of
      another language into the pages you read. Latin glosses checked against Lewis &amp; Short;
      Old English against Bosworth–Toller. Lexicon CC BY-SA 4.0.
    </p>
    <p><a href="/install">Install</a> · <a href="/pricing">Pricing</a> · <a href="/support">Support</a> · <a href="/privacy">Privacy</a></p>
  </footer>
</main>
</body>
</html>
`;
}

/** The call to action, repeated at the foot of every word page. */
function cta() {
  return `  <section class="cta">
    <h2>See this in your own reading</h2>
    <p>
      Weft puts words like this one into the pages you already read, and hands back the English
      when you point at them. The longer you stay on a page, the more of it arrives in the other
      language.
    </p>
    <p><a class="cta__link" href="/">Try the live demo</a></p>
  </section>
`;
}

/* ------------------------------------------------------------ word pages */

function wordPage(entry, lang, index) {
  const meta = META[lang];
  const target = entry.tgt;
  const english = entry.lemma;
  const pos = POS_LABEL[entry.pos] ?? entry.pos;
  const slug = entry.slug;
  const url = `${SITE}/${meta.slug}/${slug}`;

  const bits = [];
  if (entry.gender) bits.push(GENDER_LABEL[entry.gender]);
  bits.push(pos);
  if (entry.num === 'pl') bits.push('plural');

  const descriptionParts = [
    `${target} is the ${meta.name} word for “${english}”`,
  ];
  if (entry.ipa) descriptionParts.push(`pronounced ${entry.ipa}`);
  if (entry.etymonOf) {
    descriptionParts.push(
      lang === 'ang'
        ? `and the direct ancestor of English “${entry.etymonOf}”`
        : `and the source of English “${entry.etymonOf}”`,
    );
  }
  const grammar = bits.join(', ');
  const description = `${descriptionParts.join(', ')}. ${
    grammar.charAt(0).toUpperCase() + grammar.slice(1)
  }.`.slice(0, 300);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: target,
    alternateName: spelling(entry.tgtLemma),
    description,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: `Weft ${meta.name} lexicon`,
      url: `${SITE}/${meta.slug}/`,
    },
    url,
    ...(entry.ipa ? { additionalProperty: { '@type': 'PropertyValue', name: 'IPA', value: entry.ipa } } : {}),
  };

  // Related: same part of speech, nearest difficulty band, not itself.
  const related = index.byLang[lang]
    .filter((e) => e.tgtLemma !== entry.tgtLemma && e.pos === entry.pos)
    .sort((a, b) => Math.abs(a.band - entry.band) - Math.abs(b.band - entry.band))
    .slice(0, 8);

  // The same English word in the other historical language — genuinely
  // interesting to a reader and the best internal link on the page.
  const other = lang === 'la' ? 'ang' : 'la';
  const counterpart = index.byLangByLemma[other]?.get(english);

  const rows = [];
  if (entry.ipa) {
    rows.push(['Pronunciation', `<span class="ipa">${esc(entry.ipa)}</span>`]);
  }
  rows.push(['Part of speech', esc(pos)]);
  if (entry.gender) rows.push(['Gender', esc(GENDER_LABEL[entry.gender])]);
  if (entry.tgt2 && entry.num !== 'pl') rows.push(['Plural', esc(entry.tgt2)]);
  rows.push(['Difficulty', `${BAND_LABEL[entry.band] ?? entry.band} — band ${entry.band} of 6`]);

  const body = `  <article>
    <header class="word__head">
      <p class="word__eyebrow">${esc(meta.name)} · ${esc(meta.era)}</p>
      <h1 class="word__target" lang="${lang}">${esc(target)}</h1>
      <p class="word__gloss">${esc(meta.name)} for <strong>${esc(english)}</strong></p>
    </header>

    <div class="word__interlinear">
      <span class="gloss">
        <span class="gloss__target" lang="${lang}">${esc(target)}</span>
        <span class="gloss__source">${esc(english)}</span>
      </span>
      <p class="word__interlinearNote">
        This is how Weft sets it: the ${esc(meta.name)} word in place, the English one hover away.
      </p>
    </div>

    ${
      entry.etymonOf
        ? `<section class="word__descent">
      <h2>Where <em>${esc(entry.etymonOf)}</em> comes from</h2>
      <p>
        ${descentSentence(meta, entry.etymonOf, entry.note)}
      </p>
    </section>`
        : entry.note
          ? `<section class="word__descent"><h2>Worth knowing</h2><p>${esc(entry.note)}.</p></section>`
          : ''
    }

    <section>
      <h2>The details</h2>
      <table class="worddata">
        <tbody>
          ${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${v}</td></tr>`).join('\n          ')}
        </tbody>
      </table>
      ${entry.ipa ? `<p class="word__pronNote">${esc(getLanguage(lang).pronunciationNote)}</p>` : ''}
    </section>

    ${
      counterpart
        ? `<section>
      <h2>The same idea in ${esc(META[other].name)}</h2>
      <p>
        ${esc(META[other].name)} says
        <a href="/${META[other].slug}/${counterpart.slug}" lang="${other}">${esc(counterpart.tgt)}</a>
        for “${esc(english)}”.
      </p>
    </section>`
        : ''
    }

    ${
      related.length
        ? `<section>
      <h2>Other ${esc(meta.name)} ${esc(pos === 'adjective' ? 'adjectives' : pos + 's')}</h2>
      <ul class="wordlist">
        ${related
          .map(
            (e) =>
              `<li><a href="/${meta.slug}/${e.slug}" lang="${lang}">${esc(e.tgt)}</a> <span>${esc(e.lemma)}</span></li>`,
          )
          .join('\n        ')}
      </ul>
    </section>`
        : ''
    }
  </article>

${cta()}`;

  return {
    path: join(META[lang].slug, `${slug}.html`),
    url,
    html: page({
      title: `${target} — ${meta.name} for “${english}” | Weft`.slice(0, 70),
      description,
      canonical: url,
      jsonLd,
      breadcrumbs: [
        { href: '/', label: 'Weft' },
        { href: `/${meta.slug}/`, label: meta.name },
        { label: target },
      ],
      body,
    }),
  };
}

/* --------------------------------------------------------- index pages */

function languageIndex(lang, entries) {
  const meta = META[lang];
  const url = `${SITE}/${meta.slug}/`;
  const withEtymon = entries.filter((e) => e.etymonOf).length;

  const byPos = new Map();
  for (const e of entries) {
    if (!byPos.has(e.pos)) byPos.set(e.pos, []);
    byPos.get(e.pos).push(e);
  }

  const sections = [...byPos.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([pos, list]) => {
      const label = POS_LABEL[pos] ?? pos;
      const plural = label === 'adjective' ? 'adjectives' : `${label}s`;
      return `    <section>
      <h2>${esc(plural[0].toUpperCase() + plural.slice(1))} <span class="count">${list.length}</span></h2>
      <ul class="wordlist wordlist--wide">
        ${list
          .sort((a, b) => a.lemma.localeCompare(b.lemma))
          .map(
            (e) =>
              `<li><a href="/${meta.slug}/${e.slug}" lang="${lang}">${esc(e.tgt)}</a> <span>${esc(e.lemma)}</span></li>`,
          )
          .join('\n        ')}
      </ul>
    </section>`;
    })
    .join('\n');

  const description =
    `Every ${meta.name} word in the Weft lexicon: ${entries.length} entries with pronunciation, ` +
    `gender and, for ${withEtymon} of them, ${meta.index.description}.`;

  return {
    path: join(meta.slug, 'index.html'),
    url,
    html: page({
      title: `${meta.name} words, ${meta.index.title} | Weft`.slice(0, 70),
      description,
      canonical: url,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        name: `Weft ${meta.name} lexicon`,
        description,
        url,
        hasDefinedTerm: entries.slice(0, 50).map((e) => ({
          '@type': 'DefinedTerm',
          name: e.tgt,
          url: `${SITE}/${meta.slug}/${e.slug}`,
        })),
      },
      breadcrumbs: [{ href: '/', label: 'Weft' }, { label: meta.name }],
      body: `  <header class="hub__head">
    <p class="word__eyebrow">${esc(meta.era)}</p>
    <h1>${esc(meta.name)}</h1>
    <p class="standfirst">
      ${entries.length} words, each with its pronunciation and grammar —
      and for ${withEtymon} of them, ${esc(meta.index.lead)}.
    </p>
  </header>
${sections}
${cta()}`,
    }),
  };
}

/* ------------------------------------------------------------ hub pages */

function descentHub(lang, entries) {
  const meta = META[lang];
  const slug = lang === 'ang' ? 'old-english-words-that-became-english' : 'latin-words-in-everyday-english';
  const url = `${SITE}/${slug}`;
  const withEtymon = entries.filter((e) => e.etymonOf).sort((a, b) => b.zipf - a.zipf);

  const title =
    lang === 'ang'
      ? 'Old English words that became English words | Weft'
      : 'Latin words hiding in everyday English | Weft'.slice(0, 70);

  const description =
    lang === 'ang'
      ? `${withEtymon.length} Old English words and the modern English words they became, from hūs to house and cyning to king — with pronunciation and the false friends.`
      : `${withEtymon.length} Latin words and the English words they gave us, from vacca to vaccine and mīlle passūs to mile — with classical pronunciation.`;

  const intro =
    lang === 'ang'
      ? `<p>
      Old English is not a foreign language you are learning from scratch. It is the language
      English used to be, and a surprising amount of it is still in your mouth. Below are
      ${withEtymon.length} words from the Weft lexicon that turned into words you already use,
      most common first.
    </p>
    <p>
      The false friends are the best part. <em>Mete</em> meant any food at all, and became
      <em>meat</em>. <em>Steorfan</em> meant simply to die, and became <em>starve</em>.
      <em>Sellan</em> meant to give.
    </p>`
      : `<p>
      Roughly a quarter of English vocabulary came from Latin, most of it through French, and a
      good deal of it is more literal than you would expect. <em>Vaccine</em> is named after a
      cow, because Jenner used cowpox. A <em>mile</em> is a thousand paces. A
      <em>peninsula</em> is almost an island. Below are ${withEtymon.length} of them, most
      common first.
    </p>`;

  const rows = withEtymon
    .map(
      (e) => `        <tr>
          <td><a href="/${meta.slug}/${e.slug}" lang="${lang}">${esc(e.tgt)}</a></td>
          <td class="arrow" aria-hidden="true">→</td>
          <td>${esc(e.etymonOf)}</td>
          <td class="worddata__note">${esc(e.note ?? '')}</td>
        </tr>`,
    )
    .join('\n');

  return {
    path: `${slug}.html`,
    url,
    html: page({
      title,
      description,
      canonical: url,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title.replace(' | Weft', ''),
        description,
        url,
        author: { '@type': 'Organization', name: 'Weft' },
        publisher: { '@type': 'Organization', name: 'Weft' },
      },
      breadcrumbs: [{ href: '/', label: 'Weft' }, { label: 'Descent' }],
      body: `  <header class="hub__head">
    <h1>${esc(title.replace(' | Weft', ''))}</h1>
    ${intro}
  </header>

  <table class="descent descent--full">
    <thead><tr><th scope="col">${esc(meta.name)}</th><th></th><th scope="col">English</th><th scope="col">Note</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>

  <p><a href="/${meta.slug}/">Every ${esc(meta.name)} word in the lexicon →</a></p>
${cta()}`,
    }),
  };
}

function cognateHub(lang, name, entries) {
  // Modern languages get one rich page rather than a page per word: the
  // entries carry gender and a plural, which is not enough to land on.
  const slug = `${name.toLowerCase()}-words-you-already-know`;
  const url = `${SITE}/${slug}`;

  // Near-identical folded forms are the ones a reader can recognise on sight.
  const fold = (s) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z]/g, '');
  const recognisable = entries
    .filter((e) => {
      const a = fold(e.lemma);
      const b = fold(e.tgt);
      if (!a || !b || a === b) return false;
      // Shared prefix of four or more, or a one-character difference.
      let shared = 0;
      while (shared < Math.min(a.length, b.length) && a[shared] === b[shared]) shared++;
      return shared >= 4 || Math.abs(a.length - b.length) <= 1 && shared >= 3;
    })
    .sort((a, b) => b.zipf - a.zipf)
    .slice(0, 120);

  const title = `${name} words you already know | Weft`;
  const description =
    `${recognisable.length} ${name} words close enough to English that you can read them on ` +
    `sight — the place to start when you begin reading ${name} rather than studying it.`;

  return {
    path: `${slug}.html`,
    url,
    html: page({
      title,
      description,
      canonical: url,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title.replace(' | Weft', ''),
        description,
        url,
      },
      breadcrumbs: [{ href: '/', label: 'Weft' }, { label: `${name} cognates` }],
      body: `  <header class="hub__head">
    <h1>${esc(name)} words you already know</h1>
    <p>
      The fastest way into reading a language is the words you do not have to learn. These
      ${recognisable.length} ${esc(name)} words are close enough to their English equivalents
      that you can recognise them in a sentence without being told — which is exactly where
      Weft starts, because comprehension has to survive the first page.
    </p>
  </header>

  <ul class="wordlist wordlist--wide wordlist--gloss">
    ${recognisable
      .map(
        (e) =>
          `<li><span class="gloss"><span class="gloss__target" lang="${lang}">${esc(e.tgt)}</span><span class="gloss__source">${esc(e.lemma)}</span></span></li>`,
      )
      .join('\n    ')}
  </ul>
${cta()}`,
    }),
  };
}

/* ---------------------------------------------------------- install page */

const REPO = process.env.WEFT_REPO ?? 'https://github.com/quiquae/weft';

function installPage(version) {
  const url = `${SITE}/install`;
  const description =
    `Install Weft in about a minute. Download the package, open your browser's extensions ` +
    `page, turn on developer mode, and load the folder. Chrome, Edge, Brave, Firefox and Safari.`;

  return {
    path: 'install.html',
    url,
    html: page({
      title: 'Install Weft — about a minute',
      description,
      canonical: url,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'Install Weft',
        description,
        totalTime: 'PT1M',
        step: [
          { '@type': 'HowToStep', name: 'Download', text: 'Download the Weft package for your browser and unzip it.' },
          { '@type': 'HowToStep', name: 'Open the extensions page', text: 'Go to chrome://extensions in Chrome, Edge or Brave.' },
          { '@type': 'HowToStep', name: 'Turn on Developer mode', text: 'Use the toggle in the top right of the extensions page.' },
          { '@type': 'HowToStep', name: 'Load unpacked', text: 'Click Load unpacked and choose the unzipped folder.' },
        ],
      },
      breadcrumbs: [{ href: '/', label: 'Weft' }, { label: 'Install' }],
      body: `  <header class="hub__head">
    <h1>Install Weft</h1>
    <p class="standfirst">
      About a minute. Weft is not in the Chrome Web Store yet, so this is a manual install —
      four steps, and the fiddly one is a toggle.
    </p>
  </header>

  <div class="download">
    <a class="download__button" href="${REPO}/releases/latest">
      Download Weft ${esc(version)}
    </a>
    <p class="download__meta">
      Chrome, Edge, Brave, Firefox and Safari · about 200&nbsp;KB · free for one language, forever
    </p>
  </div>

  <section>
    <h2>Chrome, Edge, Brave, Arc</h2>
    <ol class="steps">
      <li>
        <strong>Unzip the download.</strong>
        Take the file ending <code>-folder.zip</code> — it unzips to a single folder called
        <code>weft-chrome-${esc(version)}</code>. (The plain <code>.zip</code> is the one the
        stores want; it has no folder inside and will empty itself into your Downloads.) Keep
        the folder somewhere you will not delete by accident: the browser reads it from there
        every time it starts.
      </li>
      <li>
        <strong>Open <code>chrome://extensions</code>.</strong>
        Paste that into the address bar. On Edge it is <code>edge://extensions</code>, on Brave
        <code>brave://extensions</code>.
      </li>
      <li>
        <strong>Turn on Developer mode.</strong>
        The switch is in the top right corner of that page. Nothing happens visibly; it just
        reveals three buttons.
      </li>
      <li>
        <strong>Click “Load unpacked” and choose the folder.</strong>
        Pick <code>weft-chrome-${esc(version)}</code> itself, not the
        <code>manifest.json</code> inside it. Weft will open
        its first-run page and ask you three questions.
      </li>
    </ol>
    <p class="steps__note">
      A warning about developer-mode extensions may appear each time you start the browser.
      That is Chrome being careful about software it has not reviewed, which is exactly what it
      should do. It stops once Weft is in the Web Store.
    </p>
  </section>

  <section>
    <h2>Firefox</h2>
    <ol class="steps">
      <li><strong>Open <code>about:debugging</code></strong> and choose <strong>This Firefox</strong>.</li>
      <li><strong>Click “Load Temporary Add-on”</strong> and pick <code>manifest.json</code> inside the unzipped Firefox folder.</li>
    </ol>
    <p class="steps__note">
      Firefox unloads temporary add-ons when it closes, so this is for trying Weft rather than
      living with it. A signed Firefox build needs a review on addons.mozilla.org.
    </p>
  </section>

  <section>
    <h2>Safari</h2>
    <p>
      Safari is the awkward one, and not because of anything Weft does: Apple requires a web
      extension to be wrapped in a signed native app rather than loaded from a folder. There
      is no one-minute path.
    </p>
    <ol class="steps">
      <li>
        <strong>Install Xcode</strong> from the Mac App Store — free, about 7&nbsp;GB. The
        Command Line Tools are not enough; the converter Apple ships lives inside Xcode
        itself.
      </li>
      <li>
        <strong>Run <code>npm run safari</code></strong> in a clone of the repository. It
        checks your setup, rebuilds, and generates an Xcode project.
      </li>
      <li>
        <strong>Open the project and press Run.</strong> Then in Safari: Settings → Advanced →
        “Show features for web developers”, Develop → Allow Unsigned Extensions, and enable
        Weft under Settings → Extensions.
      </li>
    </ol>
    <p class="steps__note">
      Three things differ on Safari, all deliberate and all handled. Safari has no
      notifications API at all, so Weft marks its toolbar icon instead. Keyboard shortcuts
      need Safari&nbsp;26 — everything they do is also in the popup. And below
      Safari&nbsp;17.2 there is no CSS Custom Highlight API, so Weft styles woven words with
      wrapped spans rather than highlight ranges; it looks near-identical and behaves the
      same.
    </p>
  </section>

  <section>
    <h2>What Weft asks for</h2>
    <p>
      Nothing, at first. Weft installs with <strong>no access to any website</strong> — which
      is why you will not see the “read and change all your data on all websites” warning that
      most extensions trigger. On the first-run page you choose which sites should be woven,
      and the browser asks you to approve exactly those.
    </p>
    <p>
      It then works entirely offline. No account, no server, no telemetry.
      <a href="/pricing">Pro</a> is verified from a signed file on your own machine, so even
      paying does not involve a request.
    </p>
  </section>

  <section>
    <h2>Building it yourself</h2>
    <p>Everything is open source, and the build is three commands:</p>
    <div class="install">git clone ${esc(REPO)}<br>cd weft &amp;&amp; npm install<br>npm run packs &amp;&amp; npm run build:all</div>
    <p class="steps__note">
      That writes <code>dist/chrome</code>, <code>dist/firefox</code> and
      <code>dist/safari</code>. The first is the folder to load in step 4.
    </p>
  </section>
`,
    }),
  };
}

/* ---------------------------------------------------------- pricing page */

function pricingPage() {
  const url = `${SITE}/pricing`;
  const pro = SOLD;

  // Rows that are free on both sides matter more than the paid ones: they are
  // the evidence that the free tier is a product rather than a trailer.
  const freeRows = [
    ['One language, forever', 'Any of the seven, including Latin and Old English'],
    ['The whole lexicon for it', '356 checked words, ~580 forms'],
    ['Attention-scaled difficulty', 'The entire escalation curve'],
    ['Hover to reveal', 'With pronunciation, gender and etymology'],
    ['Cooldowns and panic passes', 'The commitment layer is the product, not an upsell'],
    ['Your vocabulary and progress', 'Scheduled with FSRS-6'],
    ['Export everything', 'Your data is yours'],
    ['Accessibility', 'Never a paid feature'],
  ];

  const description = `${PITCH} From $24 a year, or $59 once.`;

  return {
    path: 'pricing.html',
    url,
    html: page({
      title: 'Pricing — Weft',
      description,
      canonical: url,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Weft',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Chrome, Edge, Firefox, Safari',
        description: PITCH,
        url: SITE,
        offers: PLANS.map((plan) => ({
          '@type': 'Offer',
          name: `Weft Pro — ${plan.label}`,
          price: String(plan.price),
          priceCurrency: plan.currency,
          url: plan.checkout,
        })),
      },
      breadcrumbs: [{ href: '/', label: 'Weft' }, { label: 'Pricing' }],
      body: `  <header class="hub__head">
    <h1>Pricing</h1>
    <p class="standfirst">${esc(PITCH)}</p>
  </header>

  <div class="plans">
${PLANS.map(
  (plan) => `    <div class="plan"${plan.featured ? ' data-featured' : ''}>
      <span class="plan__label">${esc(plan.label)}</span>
      <span class="plan__price">${esc(formatPrice(plan))}</span>
      <span class="plan__per">${esc(plan.per)}</span>
      <span class="plan__note">${esc(plan.note)}</span>
      <a class="plan__buy" href="${esc(plan.checkout)}">Get Pro</a>
    </div>`,
).join('\n')}
  </div>

  <section>
    <h2>What you get without paying anything</h2>
    <p>
      This list is longer than the one below it, and that is deliberate. Weft Free is the whole
      idea, not a trailer for it.
    </p>
    <table class="tiers">
      <tbody>
${freeRows
  .map(
    ([what, detail]) =>
      `        <tr><th scope="row">${esc(what)}</th><td class="worddata__note">${esc(detail)}</td></tr>`,
  )
  .join('\n')}
      </tbody>
    </table>
  </section>

  <section>
    <h2>What Pro adds</h2>
    <table class="tiers">
      <tbody>
${pro
  .map(
    (f) =>
      `        <tr><th scope="row">${esc(f.label)}</th><td class="worddata__note">${esc(f.detail)}</td></tr>`,
  )
  .join('\n')}
      </tbody>
    </table>
  </section>

  <section>
    <h2>How the licence works, and what that costs you</h2>
    <p>
      Your licence is a signed file, verified on your own machine against a key compiled into
      the extension. There is no account, no activation server, and no request — not at
      purchase, not at launch, not ever. You can watch the network panel and confirm it.
    </p>
    <p>
      The honest trade: because there is no server, <strong>a licence cannot be revoked</strong>.
      A yearly licence carries an expiry date and simply stops verifying when it passes. A
      lifetime key works forever. If a lifetime key leaks widely the only remedy is rotating
      the signing key, which would mean reissuing every licence — so the price of lifetime
      reflects that risk rather than pretending it away.
    </p>
    <p>
      If a licence expires, nothing you learned is deleted. One language stays active and every
      word you know stays known.
    </p>
  </section>

  <section>
    <h2>Refunds, students, and asking</h2>
    <p>
      Thirty days, no questions, no form. Student and low-income keys exist and the only
      qualification is asking for one — there is no means test and nobody is going to check.
    </p>
  </section>
`,
    }),
  };
}

/* ----------------------------------------------- documents as site pages */

/**
 * Two documents in `docs/` also have to exist at a public URL.
 *
 * The Chrome Web Store will not accept a submission without a live privacy
 * policy, and `SUPPORT_URL` in `src/core/pricing.ts` is compiled into the
 * shipped extension and rendered as a button on the help page — a button
 * that has to land somewhere. Both also have to stay readable on GitHub,
 * and both have to say exactly the same thing in each place, because a
 * privacy policy that disagrees with itself is worse than one that exists
 * in only one of them.
 *
 * So they are rendered here, not duplicated. A general Markdown library
 * would be a few thousand lines to parse input this repository writes and
 * reviews itself; what follows handles the subset those documents use —
 * headings, paragraphs, tables, lists, blockquotes, fenced code, and inline
 * emphasis, code and links. If a document starts needing more than that,
 * the cheaper fix is to write the document differently.
 */

/**
 * Documents whose subject has a page of its own, and where that page lives.
 *
 * `PRICING.md` is the reasoning behind the prices rather than the prices,
 * but a reader on the site who follows a pricing link wants `/pricing`, and
 * a reader on GitHub who follows the same link wants the reasoning. Both get
 * what they came for from one link in the source.
 */
const DOC_PAGES = {
  'PRIVACY.md': '/privacy',
  'SUPPORT.md': '/support',
  'PRICING.md': '/pricing',
};

/**
 * Where a link inside a `docs/` document points once published.
 *
 * The documents link each other by filename, which is right on GitHub and a
 * 404 on the site. A document with a page of its own gets that page;
 * anything else in `docs/` gets the copy in the repository, which is a real
 * destination rather than a broken one.
 */
function docHref(href) {
  if (/^(?:[a-z]+:|\/\/|\/|#)/i.test(href)) return href;
  const [file, hash] = href.split('#');
  const anchor = hash ? `#${hash}` : '';
  if (DOC_PAGES[file]) return DOC_PAGES[file] + anchor;
  if (file.endsWith('.md')) return `${REPO}/blob/main/docs/${file}${anchor}`;
  return href;
}

/** Placeholder for a lifted-out code span. Never appears in a document. */
const HOLD = '';

/** Inline spans: code, links, strong, emphasis. Escaping happens first. */
function inline(text) {
  let s = esc(text);

  // Code spans are lifted out before anything else reads the line, so the
  // contents of one are never re-read as markup: the host pattern
  // `*://*/*` is not two emphasis marks, and `__MSG_extName__` is not bold.
  const spans = [];
  s = s.replace(/`([^`]+)`/g, (_, code) => `${HOLD}${spans.push(code) - 1}${HOLD}`);

  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, href) => `<a href="${docHref(href)}">${label}</a>`,
  );
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  return s.replace(new RegExp(`${HOLD}(\\d+)${HOLD}`, 'g'), (_, n) => `<code>${spans[Number(n)]}</code>`);
}

const TABLE_RULE = /^\s*\|?[-:\s|]*-[-:\s|]*\|?\s*$/;
const THEMATIC_BREAK = /^(?:---|\*\*\*|___)\s*$/;

const tableCells = (line) =>
  line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim());

/** Block-level Markdown. Recurses once, for the contents of a blockquote. */
function markdown(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const isTableHead = (n) =>
    Boolean(lines[n]?.includes('|')) && lines[n + 1] !== undefined && TABLE_RULE.test(lines[n + 1]);

  /** True where a paragraph has to stop because something else starts. */
  const opensBlock = (n) =>
    lines[n] === undefined ||
    !lines[n].trim() ||
    /^#{1,6}\s/.test(lines[n]) ||
    /^\s*>/.test(lines[n]) ||
    lines[n].startsWith('```') ||
    THEMATIC_BREAK.test(lines[n]) ||
    /^\s*(?:[-*+]|\d+\.)\s+/.test(lines[n]) ||
    isTableHead(n);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      // Clamped to h2: the page template has already emitted the h1, and a
      // second one breaks the outline a screen reader navigates by.
      const level = Math.max(2, Math.min(6, heading[1].length));
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (THEMATIC_BREAK.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (line.startsWith('```')) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      out.push(`<pre class="doc__code"><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }

    if (isTableHead(i)) {
      const head = tableCells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(tableCells(lines[i++]));
      }
      // `| | |` — an all-empty header row — is how a two-column glossary is
      // written in Markdown. Rendering that as a <thead> would draw a rule
      // above the first row and label nothing with it.
      const thead = head.some((c) => c)
        ? `<thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead>`
        : '';
      const tbody = rows
        .map(
          (cells) =>
            `<tr>${cells
              .map((c, n) =>
                n === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`,
              )
              .join('')}</tr>`,
        )
        .join('\n');
      out.push(`<table class="tiers">${thead}<tbody>\n${tbody}\n</tbody></table>`);
      continue;
    }

    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        body.push(lines[i++].replace(/^\s*>\s?/, ''));
      }
      out.push(`<blockquote>${markdown(body.join('\n'))}</blockquote>`);
      continue;
    }

    const bullet = /^\s*(?:([-*+])|\d+\.)\s+/.exec(line);
    if (bullet) {
      const tag = bullet[1] ? 'ul' : 'ol';
      const items = [];
      while (i < lines.length) {
        const item = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (item) {
          items.push([item[1]]);
          i++;
          continue;
        }
        // A wrapped line belongs to the item above it. These documents are
        // hard wrapped at 78 columns, so most items run over.
        if (items.length && /^\s+\S/.test(lines[i])) {
          items[items.length - 1].push(lines[i].trim());
          i++;
          continue;
        }
        break;
      }
      out.push(`<${tag}>${items.map((p) => `<li>${inline(p.join(' '))}</li>`).join('')}</${tag}>`);
      continue;
    }

    const para = [];
    while (i < lines.length && !opensBlock(i)) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return out.join('\n');
}

/**
 * A `docs/*.md` file as a page on the site.
 *
 * The document's own H1 becomes the page heading and its opening paragraph
 * the standfirst, so a published document has the same shape as every other
 * page here rather than a heading floating loose inside the body.
 */
async function docPage({ file, slug, title, description, label }) {
  const src = await readFile(join(ROOT, 'docs', file), 'utf8');
  const url = `${SITE}/${slug}`;

  const lines = src.replace(/\r\n/g, '\n').split('\n');
  let n = 0;
  while (n < lines.length && !lines[n].trim()) n++;
  const h1 = /^#\s+(.+)$/.exec(lines[n] ?? '');
  if (h1) n++;
  while (n < lines.length && !lines[n].trim()) n++;

  // The standfirst is the opening paragraph, and only if it is one: a
  // document that opens on a heading or a table keeps its own shape.
  const lede = [];
  if (!/^(?:[#>|`]|[-*+]\s|\d+\.\s|---)/.test(lines[n] ?? '#')) {
    while (n < lines.length && lines[n].trim()) lede.push(lines[n++]);
  }

  return {
    path: `${slug}.html`,
    url,
    html: page({
      title,
      description,
      canonical: url,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        url,
        isPartOf: { '@type': 'WebSite', name: 'Weft', url: `${SITE}/` },
      },
      breadcrumbs: [{ href: '/', label: 'Weft' }, { label }],
      body: `  <header class="hub__head">
    <h1>${esc(h1 ? h1[1] : label)}</h1>
${lede.length ? `    <p class="standfirst">${inline(lede.join(' '))}</p>\n` : ''}  </header>

  <div class="prose">
${markdown(lines.slice(n).join('\n'))}
  </div>
`,
    }),
  };
}

/* ------------------------------------------------------------------ main */

async function main() {
  const files = (await readdir(PACKS)).filter((f) => /^en-[a-z]{2,3}\.json$/.test(f));
  const byLang = {};
  const byLangByLemma = {};
  /**
   * When each pack's *content* was last built — which is the date the pages
   * generated from it last changed, and so the only honest `<lastmod>` for
   * them. `tools/build-pack.mjs` keeps this stamp unless the lexicon moved.
   */
  const packDate = {};

  for (const file of files) {
    const lang = file.slice(3, -5);
    const pack = JSON.parse(await readFile(join(PACKS, file), 'utf8'));
    packDate[lang] = pack.meta?.builtAt ?? null;
    // One entry per headword: the packs carry a row per surface form and per
    // English gloss. The lookup the extension reads cards back with, so a
    // page and the dashboard cannot disagree about which row a word is.
    const seen = entriesByTarget(pack.entries);
    // Attach the plural where the pack has one.
    for (const list of Object.values(pack.entries)) {
      for (const e of list) {
        if (e.num !== 'pl') continue;
        const head = seen.get(e.tgtLemma);
        if (head && !head.tgt2) head.tgt2 = e.tgt;
      }
    }
    byLang[lang] = [...seen.values()];
    assignSlugs(byLang[lang]);
    byLangByLemma[lang] = new Map(byLang[lang].map((e) => [e.lemma, e]));
  }

  const index = { byLang, byLangByLemma };
  const written = [];

  /** The newest of several content dates, ignoring the ones we do not have. */
  const newest = (...dates) => dates.filter(Boolean).sort().at(-1) ?? null;
  /**
   * Every word page in one deep language links to its counterpart in the
   * other, so both lexicons are content for both sets of pages. The index and
   * descent hubs list one language only and take that language's date.
   */
  const deepDate = newest(...DEEP.map((l) => packDate[l]));

  // A clean build every time: a word removed from the lexicon must not leave
  // an orphaned page behind to be indexed.
  if (existsSync(OUT)) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // Copy the hand-written sources in, so the output is self-contained.
  for (const name of await readdir(SRC)) {
    await cp(join(SRC, name), join(OUT, name), { recursive: true });
  }

  for (const lang of DEEP) {
    await mkdir(join(OUT, META[lang].slug), { recursive: true });
  }

  for (const lang of DEEP) {
    const entries = byLang[lang] ?? [];
    for (const entry of entries) {
      const built = wordPage(entry, lang, index);
      await writeFile(join(OUT, built.path), built.html);
      written.push({ url: built.url, priority: '0.6', lastmod: deepDate });
    }
    const idx = languageIndex(lang, entries);
    await writeFile(join(OUT, idx.path), idx.html);
    written.push({ url: idx.url, priority: '0.8', lastmod: packDate[lang] });

    const hub = descentHub(lang, entries);
    await writeFile(join(OUT, hub.path), hub.html);
    written.push({ url: hub.url, priority: '0.9', lastmod: packDate[lang] });

    console.log(`  ${META[lang].slug}: ${entries.length} word pages + index + descent hub`);
  }

  const MODERN = { fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese' };
  for (const [lang, name] of Object.entries(MODERN)) {
    if (!byLang[lang]) continue;
    const hub = cognateHub(lang, name, byLang[lang]);
    await writeFile(join(OUT, hub.path), hub.html);
    written.push({ url: hub.url, priority: '0.8', lastmod: packDate[lang] });
    console.log(`  ${name.toLowerCase()}-words-you-already-know`);
  }

  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const install = installPage(pkg.version);
  await writeFile(join(OUT, install.path), install.html);
  console.log('  install');

  const pricing = pricingPage();
  await writeFile(join(OUT, pricing.path), pricing.html);
  console.log('  pricing');

  /*
   * The two pages something outside this repository depends on.
   *
   * `/privacy` is what a store submission is rejected for not having, and
   * `/support` is what `SUPPORT_URL` — compiled into the extension and
   * rendered as a button on its help page — resolves to. Both are rendered
   * from the documents in `docs/`, so the published page and the one a
   * reader finds in the repository can never drift apart.
   */
  const documents = [
    await docPage({
      file: 'PRIVACY.md',
      slug: 'privacy',
      label: 'Privacy',
      title: 'Privacy — Weft',
      description:
        'Everything Weft stores is on your machine. No account, no server, no telemetry. ' +
        'This is the long version, including the parts that are limitations rather than features.',
    }),
    await docPage({
      file: 'SUPPORT.md',
      slug: 'support',
      label: 'Support',
      title: 'Support — Weft',
      description:
        'What to try when Weft is not weaving, how to report a problem with the details ' +
        'attached, and what Weft will never ask you for.',
    }),
  ];
  for (const doc of documents) {
    await writeFile(join(OUT, doc.path), doc.html);
    console.log(`  ${doc.path.replace('.html', '')}`);
  }

  /*
   * Sitemap and robots.
   *
   * Each hand-written page is dated by the source that holds *its* words, not
   * by the generator or by the clock — an edit to a Latin gloss must not tell
   * search engines the privacy policy changed. The install page is the one
   * that names this file, because its prose genuinely lives in installPage()
   * rather than in a document of its own.
   */
  const urls = [
    { url: `${SITE}/`, priority: '1.0', lastmod: contentDate(ROOT, ['site/index.html']) },
    {
      url: `${SITE}/install`,
      priority: '0.95',
      lastmod: contentDate(ROOT, ['tools/build-site.mjs', 'package.json']),
    },
    {
      url: `${SITE}/pricing`,
      priority: '0.9',
      lastmod: contentDate(ROOT, ['src/core/pricing.ts', 'src/core/entitlements.ts']),
    },
    { url: `${SITE}/support`, priority: '0.6', lastmod: contentDate(ROOT, ['docs/SUPPORT.md']) },
    { url: `${SITE}/privacy`, priority: '0.5', lastmod: contentDate(ROOT, ['docs/PRIVACY.md']) },
    ...written,
  ];
  await writeFile(join(OUT, 'sitemap.xml'), sitemapXml(urls));
  await writeFile(
    join(OUT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
  );

  console.log(`\n  sitemap.xml: ${urls.length} URLs`);
  console.log(`  robots.txt`);
  console.log(`\n  -> dist/site  (deploy this directory)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
