# Store listing copy

Everything a Chrome Web Store or AMO submission needs, in one place.

## Name

Weft — Language Immersion

## Short description (132 characters max)

> Reads the web back to you with some words woven into another language.
> Difficulty rises with the time you spend.

(112 characters.)

## Category

Education. Secondary: Productivity.

## Detailed description

**Some of the words on the pages you read are in another language. The longer
you stay on a page, the more of them there are.**

Weft weaves a proportion of the words on a page into a language you are
learning, and raises that proportion with the time you actually spend looking
at the page. Five minutes on a news article costs you almost nothing. Forty
minutes on an infinite feed and a third of the words Weft knows are in French.

Point at a word and it gives you the English back.

**Why it works.** This is the diglot weave, a method that goes back to 1968
and has been tested since: keep a text almost entirely comprehensible and
weave the new language in just above your threshold, so meaning arrives from
context rather than from a dictionary. Weft's addition is tying the difficulty
to your attention, so the time you were going to lose anyway is what buys the
vocabulary.

**You already know more French than you think.** A very large part of
English arrived from French, and nearly as much again from Latin, which French
grew out of, so the word on your page is often already inside an English word you use —
and the tooltip says which. cheval shares a root with "cavalry" and
"chivalry", fenêtre with "defenestration", jour with "journal" and
"journey". That is the difference between memorising a word and noticing you
have known it for years.

**Seven languages.** French, Spanish, German, Italian and Portuguese — plus
Latin and Old English, for anyone who wants the same device taken as far as it
goes.

**A real memory model.** Weft schedules with FSRS-6, the open-source memory
model Anki also offers.
Words you are about to forget come back; words you have genuinely learned are
left in the target language for good and stop counting against the page's
difficulty. The page becomes the review session, and you never sit down to
study.

**The screen-time half.** Anything that makes Weft easier waits out a cooldown
you set in advance — and, if you choose, behind a short vocabulary check drawn
from words you have already seen. The clock is stored, not scheduled: closing the browser
neither cancels it nor restarts it. Cancelling a queued change is always
instant and free. There is a rate-limited panic pass for the moment you
genuinely need plain English, and, in Chrome and Edge, an optional Hard Mode
that generates a browser policy making the extension unremovable without an
administrator password.

**It does not touch what matters.** Weft ships a never-weave list covering
money, mail, credentials and health, checked before anything else. It never
rewrites a button label, a code sample, anything you are typing, or a
screen-reader live region.

**No account. No server. No telemetry.** Everything is on your machine and it
works offline. Weft asks for access to no website until you name the sites
yourself, which is why it installs without the warning about reading all your
data. You can add your own DeepL, Google or OpenAI-compatible key for words
beyond the built-in lexicons — and even then it sends single words,
never the page. An OpenAI-compatible service is sent the sentence each word
appears in as well, but only if you turn on “Send the surrounding sentence”,
which is off by default.

**Free.** Every feature is free, and there is nothing to buy.

Open source: the code is MIT, the word lists CC BY-SA 4.0.

## Permission justifications

Reviewers ask for these individually.

**storage** — Stores settings and the learner's vocabulary locally. No remote
storage is used.

**alarms** — Difficulty-reducing settings changes are held behind a cooldown
that must expire reliably. An MV3 service worker is terminated when idle, so
an alarm is the only way for a stored cooldown to apply on time. Also used to
end a panic pass on time and to write the learner's vocabulary to storage once
a minute.

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
finished its cooldown and taken effect, and answers a panic pass asked for with
the keyboard shortcut. **Not requested in the Safari build**,
which has no notifications API; there the toolbar badge is used instead.

### Two permissions that were removed, and why the answer matters

An earlier draft of this listing justified two permissions Weft did not need.
Both left the manifest on 2026-09-15, four days before 1.0.0, so no released
version declared either and no store has seen them; the reasoning is recorded
here so that neither comes back.

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
from a user gesture on one of the extension's own pages — the first-run page,
the settings page's Sites section, or the toolbar popup on the site being read
— for only the sites the user selects. Never requested at install time.

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
  key, individual words are sent to the provider they chose, never paragraphs,
  URLs or the page. Only an OpenAI-compatible provider is also sent the
  sentence each word appears in, and only if the user turns on “Send the
  surrounding sentence”, which is off by default and described where it is
  switched on.

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

`apple-*` (1440x900) are the same five scenes at one of the four sizes the
Mac App Store accepts. **Edge is sent the `chrome-*` set and has none of its
own:** Microsoft's
[publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
takes screenshots of "either 640 x 480 pixels or 1280 x 800 pixels" (read
2026-10-25), and the Chrome five are 1280x800. An `edge-*` set was drawn at
1366x768 until 2026-10-25, a size Edge does not take, and is gone.
`tests/tools/ready-to-submit.test.ts` holds every screenshot
`docs/READY-TO-SUBMIT.md` sends a store to the sizes that store prints, and
fails on a frame the page sends to no store.

Scenes 4 and 5 are scrolled, and the scroll is **framed on a section
boundary** rather than nudged by `scrollIntoViewIfNeeded` — the section's top
edge is put at the top of the shot, and the capture asserts it landed there.
`scrollIntoViewIfNeeded` states no alignment, so Blink chose one from the
viewport height and cut across a row of content in four of the six scrolled
captures: two bled the row above in (clipped progress tiles, a halved preset
row) and two cut the head off the target row itself, one of them opening
mid-sentence. All three frames of a scene now show the same content boundary,
so the three listings differ only in how much fits below it.

The screenshots use `tests/e2e/pages/showcase.html`, not the test fixture.
`article.html` deliberately displays the things Weft must *not* touch — a
button, a code block, a three-word sentence — because those elements are its
assertions; in a screenshot they read as a broken page.

They also set the ratio to ~30% rather than the shipped 6% default. One
changed word in a paragraph reads as a typo rather than as a feature, and the
listing text states the default is gentler, so nothing is overstated.

### Promo tiles

`npm run tiles` (`tools/make-store-tiles.mjs`) writes, into `docs/store/`:

- `tile-small-440x280.png` — Chrome small tile, **required**
- `tile-marquee-1400x560.png` — Chrome marquee; optional, but an extension
  cannot be featured without one
- `logo-edge-300x300.png` — Edge store logo, **required** there

These are an artefact group — `store promo tiles` — so `npm run
artefacts:check` reports them stale if the generator, or the mark it draws,
moves after they were last written. It did not report them at all until
2026-09-30, because `tools/artefacts.ts` claimed they were drawn by hand
while this page said otherwise three lines up. All three reproduce
byte-identically.

**The mark and the words on them are not the tiles' own.** Both come from
`tools/brand.ts`, which is also what the toolbar icon, the social card and
the header of every site page are drawn from, so the icon you upload and the
tile you upload beside it cannot show two different marks. They did, from
2026-09-22 to 2026-10-01: the icon was redrawn so that the weft crosses
three of its four threads, and the tile generator kept a pasted copy of the
old mark, which crosses two. `tests/tools/brand.test.ts` now reads the mark
back out of the pixels of all three files and fails if that happens again.

The marquee leads with the same four French pairs as the social card —
*rivière*, *cheval*, *matin*, *forêt* — and the small tile with the first.
Until 2026-10-01 the marquee showed *rivière*, *hūs*, *cyning*, *vacca*:
the set the card dropped on 2026-09-26 when French was made to lead
everywhere, on the grounds that Old English beside Latin "reads as a tool
for medievalists". That decision never reached the marquee because nobody
then knew the marquee had a generator. If the mixed set was in fact wanted
here, it is one list to change, `LEAD_PAIRS`, and the card follows it.

The generator checks that nothing runs off a tile's frame before it writes
any of the three, and writes none if one does.

## Support and privacy policy URLs

Both required, and both are generated pages rather than anything to host by
hand. `npm run site` renders `docs/PRIVACY.md` to `/privacy` and
`docs/SUPPORT.md` to `/support` through the same template as the rest of the
site, so the published page and the document in this repository cannot drift
apart. `npm run site:check` fails the build if either is missing, along with
whatever `SUPPORT_URL` in `src/core/pricing.ts` resolves to.

| Field | Value |
|---|---|
| Privacy policy URL | `https://quiquae.github.io/weft/privacy` |
| Support URL | `https://quiquae.github.io/weft/support` — the same URL the extension's own help page links to |

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
      `https://quiquae.github.io/weft/privacy`. Confirm it loads logged out.
- [ ] **A support URL.** `docs/SUPPORT.md` is rendered to `/support` by the
      same build, and it is the page `SUPPORT_URL` in `src/core/site.ts`
      already points the extension's help button at. Both need the site
      published on GitHub Pages.
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
reports zero granted origins and zero registered content scripts, and two
tests hold it: `tests/tools/install-permissions.test.ts` over every
target's manifest, and `tests/e2e/privacy.spec.ts` ("what a fresh install
may touch") over a real install.

### Firefox, separately

- [ ] The Firefox manifest declares `data_collection_permissions`, which AMO
      requires of a new extension — it does not yet
      (`READY-TO-SUBMIT.md`, F0)
- [ ] An addons.mozilla.org account, no fee
- [ ] Submit `weft-firefox-<version>.zip`
- [ ] AMO requires reviewable source for minified code. `npm run build` is
      reproducible from the repository; point them at it and at
      `build.mjs`.
