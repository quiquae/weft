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

**You already know more French than you think.** A very large part of
English arrived from French, and most of the rest shares a Latin root with it,
so the word on your page is often already inside an English word you use —
and the tooltip says which. cheval is the root of "cavalry" and "chivalry".
fenêtre is the root of "defenestration". jour is the root of "journal" and
"journey". That is the difference between memorising a word and noticing you
have known it for years.

**Seven languages.** French, Spanish, German, Italian and Portuguese — plus
Latin and Old English, which nobody else offers, for anyone who wants the
same device taken as far as it goes.

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

**contextMenus** — Two entries on the extension's own toolbar button, for the
progress and settings pages. (Named `menus` in Safari and Firefox; the code
resolves whichever the browser provides.)

**notifications** — Informs the user when a settings change they queued has
finished its cooldown and taken effect. **Not requested in the Safari build**,
which has no notifications API; there the toolbar badge is used instead.

### Two permissions that were removed, and why the answer matters

An earlier draft of this listing justified two permissions Weft did not need.
Both are gone from the manifest, and the reasoning is recorded here because a
reviewer comparing versions will see them disappear.

**`idle` was never used at all.** It had zero call sites. The justification
claimed it was how attention is distinguished from a parked tab — "the core of
the feature" — which was simply wrong. Attention is measured in the content
script from `visibilitychange`, window focus and an activity-event idle
threshold (`src/content/attention.ts`). That is strictly better than
`chrome.idle`: it is per-page rather than per-machine, and it needs no
permission. An unused permission with a confident explanation attached is
worse than an unused permission.

**`unlimitedStorage` was masking a bug rather than granting a capability.**
Two stores grew without bound — per-host attention (sixty days of history per
host, no cap on hosts) and the optional provider cache (no cap at all). Around
five thousand hosts crosses the quota, which is a realistic few years of
browsing. `src/core/prune.ts` now bounds both, with a test asserting the
serialised size stays well under quota, so the permission is unnecessary.

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

Generated at each store's exact required size by
`WEFT_STORE=1 npx playwright test store-assets`, into `docs/store/`.
Chrome wants 1280x800 "square corners, no padding (full bleed)", so these are
viewport captures, not full-page ones — a full-page shot of the settings page
comes out 1280x3000 and is rejected.

| # | Chrome (1280x800) | Shows |
|---|---|---|
| 1 | `chrome-01-woven.png` | An ordinary article, ~30% woven into French |
| 2 | `chrome-02-reveal.png` | The tooltip handing back the English |
| 3 | `chrome-03-cousins.png` | The tooltip naming the English relative |
| 4 | `chrome-04-progress.png` | Progress, scrolled to the discoveries feed |
| 5 | `chrome-05-settings.png` | The difficulty controls and the friction |

`edge-*` (1366x768) and `apple-*` (1440x900) are the same five scenes at
those stores' sizes.

The screenshots use `tests/e2e/pages/showcase.html`, not the test fixture.
`article.html` deliberately displays the things Weft must *not* touch — a
button, a code block, a three-word sentence — because those elements are its
assertions; in a screenshot they read as a broken page.

They also set the ratio to ~30% rather than the shipped 6% default. One
changed word in a paragraph reads as a typo rather than as a feature, and the
listing text states the default is gentler, so nothing is overstated.

### Promo tiles

`node tools/make-store-tiles.mjs` writes, into `docs/store/`:

- `tile-small-440x280.png` — Chrome small tile, **required**
- `tile-marquee-1400x560.png` — Chrome marquee; optional, but an extension
  cannot be featured without one
- `logo-edge-300x300.png` — Edge store logo, **required** there

## Support and privacy policy URLs

Both required, and both are generated pages rather than anything to host by
hand. `npm run site` renders `docs/PRIVACY.md` to `/privacy` and
`docs/SUPPORT.md` to `/support` through the same template as the rest of the
site, so the published page and the document in this repository cannot drift
apart. `npm run site:check` fails the build if either is missing, along with
whatever `SUPPORT_URL` in `src/core/pricing.ts` resolves to.

| Field | Value |
|---|---|
| Privacy policy URL | `https://weft.study/privacy` |
| Support URL | `https://weft.study/support` — the same URL the extension's own help page links to |

Both wait on the domain being registered. Neither URL is reachable until then.


---

## Submission checklist

Things only you can do, in the order they block each other.

### Before you can submit at all

- [ ] **Chrome Web Store developer account.** A one-time registration fee at
      <https://chrome.google.com/webstore/devconsole>. Chrome's docs confirm
      it is one-time and not recurring but do not print the amount; it has
      been $5 for years, and the figure is shown at registration. Use an
      account you will still control in five years, not a throwaway.
- [ ] **A privacy policy at a public URL.** Required for any extension that
      handles user data, and Weft is required to declare one even though it
      transmits nothing. `docs/PRIVACY.md` is rendered to `/privacy` by
      `npm run site`; publish the site and it is live at
      `https://weft.study/privacy`. Confirm it loads logged out.
- [ ] **A support URL.** `docs/SUPPORT.md` is rendered to `/support` by the
      same build, and it is the page `SUPPORT_URL` in `src/core/pricing.ts`
      already points the extension's help button at. Both need the domain.
- [ ] **Decide the publisher name.** It appears on the listing and cannot be
      changed casually.

### Assets, all present in this repository

- [ ] Icon, 128×128 — `assets/icon-128.png`
- [ ] Screenshots, exactly 1280×800 — the five `docs/store/chrome-*.png`,
      in numbered order. Already the right size; no padding needed.
- [ ] Small promo tile, exactly 440×280 — `docs/store/tile-small-440x280.png`
- [ ] Marquee, 1400×560 — `docs/store/tile-marquee-1400x560.png`
- [ ] The package — `weft-chrome-<version>.zip` from `npm run zip`
- [ ] Run `npm run validate` first. It fails on the things the stores
      reject for: an unused permission, a leaked test seam, an unresolved
      `__MSG_*__`, an inline script, a missing referenced file, remote code.

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
