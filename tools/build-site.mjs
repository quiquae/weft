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
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANS, formatPrice, PITCH } from '../src/core/pricing.ts';
import { FEATURES } from '../src/core/entitlements.ts';

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
 */
const OUT = join(ROOT, 'dist/site');

/** Change this to the domain you publish on. Everything canonical derives from it. */
const SITE = process.env.WEFT_SITE_URL ?? 'https://weft.study';

/** Languages rich enough to justify a page per word. */
const DEEP = ['la', 'ang'];

const META = {
  la: {
    name: 'Latin',
    endonym: 'Latina',
    era: 'Classical, c. 75 BC – AD 200',
    slug: 'latin',
    descent: 'This is the Latin word your English borrowed from',
    note: 'Classical reconstruction. Every letter is pronounced; v as /w/, c always hard.',
  },
  ang: {
    name: 'Old English',
    endonym: 'Englisc',
    era: 'West Saxon, c. 900–1050',
    slug: 'old-english',
    descent: 'This is the Old English word that became',
    note: 'þ and ð are both "th"; c before a front vowel is "ch"; sc is "sh". A macron marks a long vowel.',
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
 * URL slug for a target word.
 *
 * Strips diacritics and the historical letterforms so that URLs stay ASCII
 * and typeable, while the page itself shows the word properly spelled. A URL
 * containing þ and a macron is a URL nobody can share by voice.
 */
function slugify(word) {
  return word
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/[þð]/g, 'th')
    .replace(/ƿ/g, 'w')
    .replace(/ȝ/g, 'g')
    .replace(/ſ/g, 's')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

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
      <svg viewBox="0 0 128 128" role="img" aria-label="Weft">
        <g stroke="currentColor" stroke-width="11" opacity="0.45">
          <line x1="12.8" y1="12.8" x2="12.8" y2="115.2"/>
          <line x1="46.9" y1="12.8" x2="46.9" y2="115.2"/>
          <line x1="81.1" y1="12.8" x2="81.1" y2="115.2"/>
          <line x1="115.2" y1="12.8" x2="115.2" y2="115.2"/>
        </g>
        <line x1="7.3" y1="64" x2="76.3" y2="64" stroke="currentColor" stroke-width="20.5"/>
      </svg>
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
  const slug = slugify(entry.tgtLemma);
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
    alternateName: entry.tgtLemma,
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
        ${esc(meta.descent)} <strong>${esc(entry.etymonOf)}</strong>.
        ${entry.note ? esc(entry.note) + '.' : ''}
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
      ${entry.ipa ? `<p class="word__pronNote">${esc(meta.note)}</p>` : ''}
    </section>

    ${
      counterpart
        ? `<section>
      <h2>The same idea in ${esc(META[other].name)}</h2>
      <p>
        ${esc(META[other].name)} says
        <a href="/${META[other].slug}/${slugify(counterpart.tgtLemma)}" lang="${other}">${esc(counterpart.tgt)}</a>
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
              `<li><a href="/${meta.slug}/${slugify(e.tgtLemma)}" lang="${lang}">${esc(e.tgt)}</a> <span>${esc(e.lemma)}</span></li>`,
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
              `<li><a href="/${meta.slug}/${slugify(e.tgtLemma)}" lang="${lang}">${esc(e.tgt)}</a> <span>${esc(e.lemma)}</span></li>`,
          )
          .join('\n        ')}
      </ul>
    </section>`;
    })
    .join('\n');

  const description =
    `Every ${meta.name} word in the Weft lexicon: ${entries.length} entries with pronunciation, ` +
    `gender and, for ${withEtymon} of them, the English word they became.`;

  return {
    path: join(meta.slug, 'index.html'),
    url,
    html: page({
      title: `${meta.name} words, with their English descendants | Weft`.slice(0, 70),
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
          url: `${SITE}/${meta.slug}/${slugify(e.tgtLemma)}`,
        })),
      },
      breadcrumbs: [{ href: '/', label: 'Weft' }, { label: meta.name }],
      body: `  <header class="hub__head">
    <p class="word__eyebrow">${esc(meta.era)}</p>
    <h1>${esc(meta.name)}</h1>
    <p class="standfirst">
      ${entries.length} words, each with its pronunciation and grammar —
      and for ${withEtymon} of them, the English word they turned into.
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
      : `${withEtymon.length} Latin words and the English words they gave us, from vacca to vaccine and mille passūs to mile — with classical pronunciation.`;

  const intro =
    lang === 'ang'
      ? `<p>
      Old English is not a foreign language you are learning from scratch. It is the language
      English used to be, and a surprising amount of it is still in your mouth. Below are
      ${withEtymon.length} words from the Weft lexicon that turned into words you already use,
      most common first.
    </p>
    <p>
      The false friends are the best part. <em>Drēam</em> meant joy and music, not a sleeping
      vision. <em>Steorfan</em> meant simply to die, and became <em>starve</em>.
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
          <td><a href="/${meta.slug}/${slugify(e.tgtLemma)}" lang="${lang}">${esc(e.tgt)}</a></td>
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
        You should end up with a folder containing a <code>manifest.json</code>. Keep it
        somewhere you will not delete by accident — the browser reads it from that folder
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
        Pick the folder itself, not the <code>manifest.json</code> inside it. Weft will open
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
      <li><strong>Click “Load Temporary Add-on”</strong> and pick the Firefox zip.</li>
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
  const pro = FEATURES.filter((f) => f.tier === 'pro');

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

  const description =
    'Weft Free is one language forever, with the whole lexicon and the whole idea. ' +
    'Pro adds every language at once, a different one per site, Hard Mode, and your own ' +
    'translation key. From $24 a year, or $59 once.';

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

/* ------------------------------------------------------------------ main */

async function main() {
  const files = (await readdir(PACKS)).filter((f) => /^en-[a-z]{2,3}\.json$/.test(f));
  const byLang = {};
  const byLangByLemma = {};

  for (const file of files) {
    const lang = file.slice(3, -5);
    const pack = JSON.parse(await readFile(join(PACKS, file), 'utf8'));
    // One entry per headword: the packs carry a row per surface form.
    const seen = new Map();
    for (const list of Object.values(pack.entries)) {
      for (const e of list) {
        if (e.num === 'pl') continue;
        if (!seen.has(e.tgtLemma)) seen.set(e.tgtLemma, e);
      }
    }
    // Attach the plural where the pack has one.
    for (const list of Object.values(pack.entries)) {
      for (const e of list) {
        if (e.num !== 'pl') continue;
        const head = seen.get(e.tgtLemma);
        if (head && !head.tgt2) head.tgt2 = e.tgt;
      }
    }
    byLang[lang] = [...seen.values()];
    byLangByLemma[lang] = new Map(byLang[lang].map((e) => [e.lemma, e]));
  }

  const index = { byLang, byLangByLemma };
  const written = [];

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
      written.push({ url: built.url, priority: '0.6' });
    }
    const idx = languageIndex(lang, entries);
    await writeFile(join(OUT, idx.path), idx.html);
    written.push({ url: idx.url, priority: '0.8' });

    const hub = descentHub(lang, entries);
    await writeFile(join(OUT, hub.path), hub.html);
    written.push({ url: hub.url, priority: '0.9' });

    console.log(`  ${META[lang].slug}: ${entries.length} word pages + index + descent hub`);
  }

  const MODERN = { fr: 'French', es: 'Spanish', de: 'German', it: 'Italian', pt: 'Portuguese' };
  for (const [lang, name] of Object.entries(MODERN)) {
    if (!byLang[lang]) continue;
    const hub = cognateHub(lang, name, byLang[lang]);
    await writeFile(join(OUT, hub.path), hub.html);
    written.push({ url: hub.url, priority: '0.8' });
    console.log(`  ${name.toLowerCase()}-words-you-already-know`);
  }

  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const install = installPage(pkg.version);
  await writeFile(join(OUT, install.path), install.html);
  console.log('  install');

  const pricing = pricingPage();
  await writeFile(join(OUT, pricing.path), pricing.html);
  console.log('  pricing');

  // Sitemap and robots.
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { url: `${SITE}/`, priority: '1.0' },
    { url: `${SITE}/install`, priority: '0.95' },
    { url: `${SITE}/pricing`, priority: '0.9' },
    ...written,
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.url}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`,
  )
  .join('\n')}
</urlset>
`;
  await writeFile(join(OUT, 'sitemap.xml'), sitemap);
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
