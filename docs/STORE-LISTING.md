# Store listing copy

Everything a Chrome Web Store or AMO submission needs, in one place.

## Name

Weft — Language Immersion

## Short description (132 characters max)

> Reads the web back to you with some words woven into another language.
> Difficulty rises with the time you spend.

(129 characters.)

## Category

Education. Secondary: Productivity.

## Detailed description

**Some of the words on the pages you read are in another language. The longer
you stay on a page, the more of them there are.**

Weft weaves a proportion of the words on a page into a language you are
learning, and raises that proportion with the time you actually spend looking
at the page. Five minutes on a news article costs you almost nothing. Forty
minutes on an infinite feed and you are reading half in French.

Point at a word and it gives you the English back.

**Why it works.** This is the diglot weave, a method developed at BYU in the
1970s and replicated since: keep a text almost entirely comprehensible and
weave the new language in just above your threshold, so meaning arrives from
context rather than from a dictionary. Weft's addition is tying the difficulty
to your attention, so the time you were going to lose anyway is what buys the
vocabulary.

**Seven languages, including two nobody else offers.** French, Spanish,
German, Italian, Portuguese — and Latin and Old English, which turn out to be
the best case the method has. In Old English the word on the page is usually
the literal ancestor of the one it replaced: hūs for house, stān for stone,
cyning for king, and the tooltip tells you so. In Latin it is the word your
English borrowed from — vacca gave us "vaccine", mille passūs gave us "mile".

**A real memory model.** Weft schedules with FSRS-6, the algorithm Anki uses.
Words you are about to forget come back; words you have genuinely learned are
left in the target language for good and stop counting against the page's
difficulty. The page becomes the review session, and you never sit down to
study.

**The screen-time half.** Anything that makes Weft easier waits out a cooldown
you set in advance, optionally behind a short vocabulary check drawn from words
you have already seen. The clock is stored, not scheduled: closing the browser
neither cancels it nor restarts it. Cancelling a queued change is always
instant and free. There is a rate-limited panic pass for the moment you
genuinely need plain English, and an optional Hard Mode that generates a
browser policy making the extension unremovable without an administrator
password.

**It does not touch what matters.** Weft ships a never-weave list covering
money, mail, credentials and health, checked before anything else. It never
rewrites a button label, a code sample, anything you are typing, or a
screen-reader live region.

**No account. No server. No telemetry.** Everything is on your machine and it
works offline. Weft asks for access to no website until you name the sites
yourself, which is why it installs without the warning about reading all your
data. Optionally you can add your own DeepL, Google or OpenAI-compatible key
for words beyond the built-in lexicons — and even then it sends single words,
never page text.

Open source. MIT licensed.

## Permission justifications

Reviewers ask for these individually.

**storage** — Stores settings and the learner's vocabulary locally. No remote
storage is used.

**alarms** — Difficulty-reducing settings changes are held behind a cooldown
that must expire reliably. An MV3 service worker is terminated when idle, so
an alarm is the only way for a stored cooldown to apply on time. Also used for
the daily rollover of attention counters.

**scripting** — The content script is registered at runtime with
`registerContentScripts` for exactly the origins the user has granted, rather
than declared statically for all sites. This is what lets the extension ship
with no install-time host permissions.

**tabs** — Reads the active tab's URL to decide whether that site is on the
user's list, and notifies open tabs when settings change so they re-render
without a reload. No browsing history is read or stored; attention is recorded
against the registrable domain only.

**idle** — Distinguishes active reading from a tab left open. Attention only
accumulates while the user is actually interacting, which is the core of the
feature.

**contextMenus** — Two entries on the extension's own toolbar button, for the
progress and settings pages.

**notifications** — Informs the user when a settings change they queued has
finished its cooldown and taken effect.

**unlimitedStorage** — A large vocabulary plus the optional translation cache
can exceed the default local-storage quota.

**optional_host_permissions (`*://*/*`)** — Requested per-origin at runtime,
from a user gesture on the extension's own first-run page, for only the sites
the user selects. Never requested at install time.

## Single purpose statement

Weft has one purpose: helping someone learn a language by partially
translating the web pages they read. Every feature serves that purpose. The
difficulty controls, the site lists and the commitment cooldowns all govern
*when and how much* of that translation happens; the progress page reports on
the vocabulary it has taught. There is no second function.

## Data usage disclosures

- **Does this item collect or use personally identifiable information?** No.
- **Health information?** No.
- **Financial and payment information?** No.
- **Authentication information?** No.
- **Personal communications?** No.
- **Location?** No.
- **Web history?** No. Attention is recorded against a registrable domain
  (for example `twitter.com`) with no path, no query and no page content, and
  it never leaves the device.
- **User activity?** No. Nothing is transmitted.
- **Website content?** No. If the user configures their own translation API
  key, individual words are sent to the provider they chose. Never sentences,
  paragraphs, URLs or page content — unless the user separately and explicitly
  enables sentence context, which is off by default and described in the
  interface.

**Certifications:** we do not sell or transfer user data to third parties
outside approved use cases; we do not use or transfer user data for purposes
unrelated to the single purpose; we do not use or transfer user data to
determine creditworthiness or for lending purposes.

## Screenshots

In `docs/screens/`. For the listing, in order:

1. `page-woven.png` — a real article woven at 28%
2. `page-old-english.png` — Old English with the tooltip showing the etymon
3. `popup.png` — the status readout
4. `dashboard.png` — progress
5. `options-density.png` — the difficulty controls

## Support and privacy policy URLs

Both required. Host `docs/PRIVACY.md` and the repository issues page.


---

## Submission checklist

Things only you can do, in the order they block each other.

### Before you can submit at all

- [ ] **Chrome Web Store developer account.** One-off $5 registration fee at
      <https://chrome.google.com/webstore/devconsole>. Use an account you will
      still control in five years, not a throwaway.
- [ ] **A privacy policy at a public URL.** Required for any extension that
      handles user data, and Weft is required to declare one even though it
      transmits nothing. `docs/PRIVACY.md` is written to be published as-is;
      put it at `https://weft.study/privacy`.
- [ ] **A support URL.** The repository issues page is fine.
- [ ] **Decide the publisher name.** It appears on the listing and cannot be
      changed casually.

### Assets, all present in this repository

- [ ] Icon, 128×128 — `assets/icon-128.png`
- [ ] Screenshots, 1280×800 or 640×400, at least one, up to five. Use, in
      order: `docs/screens/page-woven.png`, `page-old-english.png`,
      `popup.png`, `dashboard.png`, `options-density.png`. They will need
      padding to the exact dimensions; the Store rejects odd sizes rather
      than scaling them.
- [ ] Small promo tile, 440×280 — crop from `site/og.png`
- [ ] The package — `weft-chrome-<version>.zip` from `npm run zip`

### Fields, all drafted above

- [ ] Name, short description, detailed description — copy from this file
- [ ] Category: Education
- [ ] Language: English
- [ ] Permission justifications — one per permission, above. Reviewers read
      these individually and reject vague ones.
- [ ] Single purpose statement — above
- [ ] Data usage disclosures and the three certifications — above

### Expect

Review takes anywhere from a few hours to a couple of weeks. A first
submission with `optional_host_permissions: ["*://*/*"]` may draw a question
about breadth; the answer is that Weft requests per-origin at runtime from a
user gesture and never at install, which is demonstrable — a fresh install
reports zero granted origins and zero registered content scripts, and there
is an automated test asserting exactly that (`tests/e2e/licensing.spec.ts`,
"a fresh install is Free, and Free weaves").

### Firefox, separately

- [ ] An addons.mozilla.org account, no fee
- [ ] Submit `weft-firefox-<version>.zip`
- [ ] AMO requires reviewable source for minified code. `npm run build` is
      reproducible from the repository; point them at it and at
      `build.mjs`.
