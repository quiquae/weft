# Ready to submit — Weft 1.0.1

**Do this first:** register `weft.study` — item 1 of [BLOCKED](#blocked--only-creagh-can-do-these),
at the bottom. Chrome, Edge and Apple each ask for a privacy policy URL, and at
22:51 UTC on 2026-10-24 `https://weft.study/privacy` did not resolve. Nothing
below can be submitted until it loads in a logged-out browser.

One page, worked top to bottom. Every field's copy is on it, in the form the
store's box takes: one paragraph per line, no Markdown. Click a grey block's
copy button, paste, move to the next step. The copy comes from
`docs/STORE-LISTING.md`, and `npm test` fails if the two ever disagree
(`tests/tools/ready-to-submit.test.ts`). `docs/SUBMIT.md` is the long-form
runbook behind this page; nothing here needs it.

| Store | Upload | Fee | Ready? |
|---|---|---|---|
| Chrome Web Store | `weft-chrome-1.0.1.zip` | One-time registration fee, about 5 USD | **Once BLOCKED 1 is done and 3 decided** |
| Firefox (AMO) | `weft-firefox-1.0.1.zip` and a source zip | Free | **No** — the package lacks a manifest key AMO requires of a new add-on (F0) |
| Edge Add-ons | `weft-chrome-1.0.1.zip` — the Chrome zip, unchanged | Free | **Once BLOCKED 1 is done and 3 decided** |
| Safari (Mac App Store) | `weft-safari-1.0.1.zip`, untried | 99 USD a year | **No** — never built, and Pro breaks Apple’s rules as it stands |

Facts about the stores were checked on 2026-10-24 against each store's own
documentation, linked where they are used. Fees and forms change; the store's
page wins over this one.

---

## 0 — Build the exact bytes you will upload (10 minutes, once)

**0.1** From the repository, on an up-to-date `main`:

```bash
git checkout main && git pull
npm run test:all    # about 5 minutes; must end with exit 0
npm run zip
npm run validate    # must print a pass for all three packages
```

**0.2** Check the repository root now holds these three. Upload the plain ones
only — the `-folder.zip` twins wrap everything in a directory, and the stores
reject that:

- `weft-chrome-1.0.1.zip` — Chrome **and** Edge
- `weft-firefox-1.0.1.zip` — Firefox
- `weft-safari-1.0.1.zip` — Safari, through Apple's zip packager, untried (see Safari)

**0.3** If `npm run validate` dies with `Unknown system error -11`, that is
iCloud copying files into `dist/`, not the package. Fix:
`rm -rf dist/chrome dist/firefox dist/safari && npm run build:all`, then 0.1 again.

**0.4** If you changed anything since the zips were built — `CHECKOUT_BASE`
for BLOCKED 3, a Firefox manifest key — run 0.1 again. A store gets the bytes
on disk, not the bytes in the repository.

---

## Chrome Web Store

**Ready once BLOCKED 1 is done and BLOCKED 3 decided.** About 45 minutes of
forms once the account exists.
Fee: **one-time**, not recurring — Google says "pay a one-time registration fee"
([register](https://developer.chrome.com/docs/webstore/register)) and prints no
amount; it has been 5 USD for years and the console shows it before you pay.

**C1 — Account.** Sign in at <https://chrome.google.com/webstore/devconsole>
with an account you will still control in five years. Pay the fee, set the
publisher name (BLOCKED 4), verify the contact email.

**C2 — Upload.** *Add new item* → `weft-chrome-1.0.1.zip`.

**C3 — Store listing → Product details.** The title and the short summary
come from the package, and Google says the manifest cannot be edited in the
dashboard after upload ([prepare](https://developer.chrome.com/docs/webstore/prepare)). Check they read as below; if the form does offer a
summary box, paste the second one:

<!-- paste: name -->
```text
Weft — Language Immersion
```

<!-- paste: short-description -->
```text
Reads the web back to you with some words woven into another language. Difficulty rises with the time you spend.
```

**C4 — Description.**

<details><summary>Description — click to open, then copy</summary>

<!-- paste: description -->
```text
Some of the words on the pages you read are in another language. The longer you stay on a page, the more of them there are.

Weft weaves a proportion of the words on a page into a language you are learning, and raises that proportion with the time you actually spend looking at the page. Five minutes on a news article costs you almost nothing. Forty minutes on an infinite feed and a third of the words Weft knows are in French.

Point at a word and it gives you the English back.

Why it works. This is the diglot weave, a method developed at BYU in the 1970s and tested since: keep a text almost entirely comprehensible and weave the new language in just above your threshold, so meaning arrives from context rather than from a dictionary. Weft's addition is tying the difficulty to your attention, so the time you were going to lose anyway is what buys the vocabulary.

You already know more French than you think. A very large part of English arrived from French, and nearly as much again from Latin, which French grew out of, so the word on your page is often already inside an English word you use — and the tooltip says which. cheval shares a root with "cavalry" and "chivalry", fenêtre with "defenestration", jour with "journal" and "journey". That is the difference between memorising a word and noticing you have known it for years.

Seven languages. French, Spanish, German, Italian and Portuguese — plus Latin and Old English, for anyone who wants the same device taken as far as it goes.

A real memory model. Weft schedules with FSRS-6, the open-source memory model Anki also offers. Words you are about to forget come back; words you have genuinely learned are left in the target language for good and stop counting against the page's difficulty. The page becomes the review session, and you never sit down to study.

The screen-time half. Anything that makes Weft easier waits out a cooldown you set in advance — and, with Pro, behind a short vocabulary check drawn from words you have already seen. The clock is stored, not scheduled: closing the browser neither cancels it nor restarts it. Cancelling a queued change is always instant and free. There is a rate-limited panic pass for the moment you genuinely need plain English, and, with Pro, a Hard Mode that generates a browser policy making the extension unremovable without an administrator password.

It does not touch what matters. Weft ships a never-weave list covering money, mail, credentials and health, checked before anything else. It never rewrites a button label, a code sample, anything you are typing, or a screen-reader live region.

No account. No server. No telemetry. Everything is on your machine and it works offline. Weft asks for access to no website until you name the sites yourself, which is why it installs without the warning about reading all your data. With Pro you can add your own DeepL, Google or OpenAI-compatible key for words beyond the built-in lexicons — and even then it sends single words, never the page. An OpenAI-compatible service is sent the sentence each word appears in as well, but only if you turn on “Send the surrounding sentence”, which is off by default.

Free, and Pro. Everything above is free except what is marked Pro. Pro is a licence checked on your machine, with no account, and adds Hard Mode, your own translation key, the vocabulary check and sixty days of attention history.

Open source. MIT licensed.
```

</details>

**C5 — Category:** `Education`. **Language:** `English`.

**C6 — Graphic assets.** All already the exact size:

- Store icon: `assets/icon-128.png` (128×128)
- Screenshots, in this order: `docs/store/chrome-01-woven.png`,
  `chrome-02-reveal.png`, `chrome-03-cousins.png`, `chrome-04-progress.png`,
  `chrome-05-settings.png` (1280×800 each)
- Small promo tile: `docs/store/tile-small-440x280.png`
- Marquee promo tile: `docs/store/tile-marquee-1400x560.png`
- Promo video: none

**C7 — Additional fields.** Homepage URL: `https://weft.study`. Official URL:
optional; leave it empty. Mature content: unticked. Support URL:

<!-- paste: support-url -->
```text
https://weft.study/support
```

**C8 — Privacy → Single purpose.**

<!-- paste: single-purpose -->
```text
Weft has one purpose: helping someone learn a language by partially translating the web pages they read. Every feature serves that purpose. The difficulty controls, the site lists and the commitment cooldowns all govern when and how much of that translation happens; the progress page reports on the vocabulary it has taught. There is no second function.
```

**C9 — Privacy → Permission justification.** One box per permission. Reviewers
read each one; paste them individually.

`storage`

<!-- paste: permission:storage -->
```text
Stores settings and the learner's vocabulary locally. No remote storage is used.
```

`alarms`

<!-- paste: permission:alarms -->
```text
Difficulty-reducing settings changes are held behind a cooldown that must expire reliably. An MV3 service worker is terminated when idle, so an alarm is the only way for a stored cooldown to apply on time. Also used to end a panic pass on time and to write the learner's vocabulary to storage once a minute.
```

`scripting`

<!-- paste: permission:scripting -->
```text
The content script is registered at runtime with registerContentScripts for exactly the origins the user has granted, rather than declared statically for all sites. This is what lets the extension ship with no install-time host permissions.
```

`tabs`

<!-- paste: permission:tabs -->
```text
Reads the active tab's URL to decide whether that site is on the user's list, and notifies open tabs when settings change so they re-render without a reload. No browsing history is read or stored; attention is recorded against the registrable domain only.
```

`contextMenus`

<!-- paste: permission:contextMenus -->
```text
Two entries on the extension's own toolbar button, for the progress and settings pages. (Named menus in Safari and Firefox; the code resolves whichever the browser provides.)
```

`notifications`

<!-- paste: permission:notifications -->
```text
Informs the user when a settings change they queued has finished its cooldown and taken effect, and answers a panic pass asked for with the keyboard shortcut. Not requested in the Safari build, which has no notifications API; there the toolbar badge is used instead.
```

Host permission (`*://*/*`, optional), if the form lists it:

<!-- paste: permission:optional_host_permissions -->
```text
Requested per-origin at runtime, from a user gesture on one of the extension's own pages — the first-run page, the settings page's Sites section, or the toolbar popup on the site being read — for only the sites the user selects. Never requested at install time.
```

**C10 — Remote code:** *No, I am not using remote code.* `npm run validate`
checks the package for it.

**C11 — Data usage.** Tick **none** of the data types — every disclosure in the
listing answers No. Then tick **all three** certifications. One answer to keep
consistent: the listing says No to website content because words go only to
a translation provider the user sets up with their own key. If F0 below ends
up declaring `websiteContent` for Firefox, tick website content here and on
Edge too, so the three stores are told the same thing.

**C12 — Privacy policy URL.**

<!-- paste: privacy-url -->
```text
https://weft.study/privacy
```

**C13 — Distribution.** Visibility: *Public*. Regions: *All regions*. If it
asks whether this is a paid item: no — the extension is free to install; Pro
is an optional licence bought outside the store (see BLOCKED 3 and 4).

**C14 — Submit for review.** Review takes hours to a couple of weeks; a first
submission is slower. The question to expect is about `*://*/*`. The answer:
Weft asks for one site at a time, at runtime, from a click on one of its own
pages — the first-run page, Settings → **Sites** or the toolbar popup — never
at install; the manifest declares no `content_scripts`;
and a fresh install has zero granted origins and zero registered content
scripts, which `tests/tools/install-permissions.test.ts` holds every
manifest to and `tests/e2e/privacy.spec.ts` ("what a fresh install may
touch") reads from a real install.

---

## Firefox (addons.mozilla.org)

**Not ready: the package needs one manifest key, and you need to choose
its value.** Fee: **none** — no fee appears anywhere in Mozilla's publishing
documentation. About 45 minutes of forms once the key is in.

**F0 — First: declare what Weft sends.** "From November 3, 2025, all new
extensions must adopt the Firefox built-in data collection consent system"
([Mozilla](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)),
and one without it set correctly "will be prevented from being submitted"
([Mozilla](https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions/)).
Weft has never been listed, so it is new, and `weft-firefox-1.0.1.zip`
puts only `id` and `strict_min_version` under
`browser_specific_settings.gecko`. Two calls only you can make. AMO's own
linter, run on 2026-10-25 against the zip and six candidate declarations,
finds an error in none of them, so it decides neither; the figures are in
`SUBMIT-STATUS.md`. Mozilla's page decides more:

- **The value.** Weft sends nothing by default. With the optional own-key
  provider it sends words from the page to the service the user chose — and,
  with “Send the surrounding sentence” on, the sentence each word appears in
  to an OpenAI-compatible one. Mozilla counts that:
  "data transmission refers to any data collected, used, transferred,
  shared, or handled outside the add-on or the local browser", and its type
  is `websiteContent`, "anything visible on a website". So
  `"required": ["none"]` alone would be false. The accurate declaration is
  `"data_collection_permissions": { "required": ["none"], "optional": ["websiteContent"] }`,
  and it is a promise to ask: optional data "aren't granted by default", and
  "The extension can request that the user opts in to this data collection
  after installation by calling permissions.request() in a user-activated
  event handler". That needs code Weft does not have yet — the request,
  from the click that turns the providers on, and a check before a word
  leaves. `"required": ["websiteContent"]` needs no code, and asks everyone
  who installs to accept a transmission the default never makes.
- **The floor.** Firefox shows its own consent screen from version 140;
  Weft's floor is 128. Mozilla: "For new extensions, options 1 or 2 make the
  most sense". Option 1 raises `strict_min_version` to `140.0` and sets
  `gecko_android`'s to `142.0`, which lints with no warning but Preact's four
  (F3). Option 2 keeps 128 and turns the providers off on 128–139, where
  `permissions.getAll()` has no `data_collection`. Keeping 128 with Weft's
  own opt-in — no word leaves until a user types in their own key — as the
  consent is the third, a custom consent experience, which Mozilla does not
  name among the sensible ones for a new extension.
- **And Chrome and Edge with it.** If Firefox is told `websiteContent`, tick
  website content in C11 and on Edge too, as C11 says.

Then rebuild (step 0.1) and run `npm run lint:firefox`. It exits 0 with the
key missing — the linter only warns, and the refusal is AMO's own check of
a new add-on — so read the warnings, not the exit status: the four Preact
ones should be all. The change itself is queued in `TODO.md`'s `Next`.

**F1 — Account.** <https://addons.mozilla.org/developers/>, with a Firefox
account.

**F2 — Upload.** *Submit a New Add-on* → *On this site* →
`weft-firefox-1.0.1.zip`. Platform: Firefox for desktop only; nothing
has ever tested Weft on Firefox for Android.

**F3 — Source code: Yes.** The bundle is built with esbuild and minified, so
AMO wants the source it came from. Make the archive from the commit the zip
was built from, on a clean `main`:

```bash
git archive --format=zip --output=weft-source-1.0.1.zip HEAD
```

Upload `weft-source-1.0.1.zip`, and put this in *Notes to reviewer*. Its
last two sentences answer the four warnings AMO's validator prints for this
package — "Unsafe assignment to innerHTML" in `popup.js`, `onboarding.js`,
`dashboard.js` and `options.js` — measured with the validator itself on
2026-10-25:

```text
Build from the source archive: Node 22.18 or later (.nvmrc says 22; the build runs TypeScript, which Node does with no flag from 22.18.0), then `npm ci` and `npm run build:firefox`. The output, dist/firefox, is the contents of weft-firefox-1.0.1.zip. The build needs no secrets and no network access beyond `npm ci`; the lexicon packs in src/lexicon/packs/ are committed and copied as they are. Mozilla's default build environment is Node 24 on Ubuntu 24.04, inside that range; CI builds it with Node 22 on Ubuntu. The four "Unsafe assignment to innerHTML" warnings are in Preact, which is bundled into the four extension pages: each is the library's dangerouslySetInnerHTML path, e.innerHTML = ….__html. No file under src/ uses dangerouslySetInnerHTML or innerHTML.
```

**F4 — Name.** From the package; check it reads:

<!-- paste: name -->
```text
Weft — Language Immersion
```

**F5 — Summary**, 250 characters at most
([Mozilla](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)):

<!-- paste: short-description -->
```text
Reads the web back to you with some words woven into another language. Difficulty rises with the time you spend.
```

**F6 — Description.**

**Decide before pasting:** the screen-time paragraph's last clause, that
Hard Mode "generates a browser policy making the extension unremovable",
is true in Google Chrome and Microsoft Edge alone. In Firefox the settings
page says Hard Mode has no file there, because Firefox reads no policy
written for Chrome or Edge (TODO.md, Hard Mode per browser). Keeping the clause promises a reviewer
something they can look for and not find; dropping it here means a
Firefox variant of the description in `docs/STORE-LISTING.md`.

<details><summary>Description — click to open, then copy</summary>

<!-- paste: description -->
```text
Some of the words on the pages you read are in another language. The longer you stay on a page, the more of them there are.

Weft weaves a proportion of the words on a page into a language you are learning, and raises that proportion with the time you actually spend looking at the page. Five minutes on a news article costs you almost nothing. Forty minutes on an infinite feed and a third of the words Weft knows are in French.

Point at a word and it gives you the English back.

Why it works. This is the diglot weave, a method developed at BYU in the 1970s and tested since: keep a text almost entirely comprehensible and weave the new language in just above your threshold, so meaning arrives from context rather than from a dictionary. Weft's addition is tying the difficulty to your attention, so the time you were going to lose anyway is what buys the vocabulary.

You already know more French than you think. A very large part of English arrived from French, and nearly as much again from Latin, which French grew out of, so the word on your page is often already inside an English word you use — and the tooltip says which. cheval shares a root with "cavalry" and "chivalry", fenêtre with "defenestration", jour with "journal" and "journey". That is the difference between memorising a word and noticing you have known it for years.

Seven languages. French, Spanish, German, Italian and Portuguese — plus Latin and Old English, for anyone who wants the same device taken as far as it goes.

A real memory model. Weft schedules with FSRS-6, the open-source memory model Anki also offers. Words you are about to forget come back; words you have genuinely learned are left in the target language for good and stop counting against the page's difficulty. The page becomes the review session, and you never sit down to study.

The screen-time half. Anything that makes Weft easier waits out a cooldown you set in advance — and, with Pro, behind a short vocabulary check drawn from words you have already seen. The clock is stored, not scheduled: closing the browser neither cancels it nor restarts it. Cancelling a queued change is always instant and free. There is a rate-limited panic pass for the moment you genuinely need plain English, and, with Pro, a Hard Mode that generates a browser policy making the extension unremovable without an administrator password.

It does not touch what matters. Weft ships a never-weave list covering money, mail, credentials and health, checked before anything else. It never rewrites a button label, a code sample, anything you are typing, or a screen-reader live region.

No account. No server. No telemetry. Everything is on your machine and it works offline. Weft asks for access to no website until you name the sites yourself, which is why it installs without the warning about reading all your data. With Pro you can add your own DeepL, Google or OpenAI-compatible key for words beyond the built-in lexicons — and even then it sends single words, never the page. An OpenAI-compatible service is sent the sentence each word appears in as well, but only if you turn on “Send the surrounding sentence”, which is off by default.

Free, and Pro. Everything above is free except what is marked Pro. Pro is a licence checked on your machine, with no account, and adds Hard Mode, your own translation key, the vocabulary check and sixty days of attention history.

Open source. MIT licensed.
```

</details>

**F7 — Categories.** Up to two for Firefox; leave Firefox for Android's
empty. The listing's own are Education and Productivity; pick the nearest
two on AMO's list — *Language Support*, if it is there, is the closest fit.

**F8 — Support.** Website:

<!-- paste: support-url -->
```text
https://weft.study/support
```

Email: none exists yet (BLOCKED 4); leave it empty.

**F9 — License.** Choose the custom licence and paste the `LICENSE` file:
it is MIT for the code and CC BY-SA 4.0 for the lexicon data, and choosing
MIT alone would misstate the lexicons.

**F10 — Privacy policy.** Tick *This add-on has a privacy policy*. Mozilla
wants the policy's text wherever data can leave the device — "a privacy
policy explaining what is being sent and how it's used is required" — and
the own-key provider makes that possible. Paste the text of
`docs/PRIVACY.md` — like F9's `LICENSE`, a whole file, so not repeated here.

**F11 — Payment.** Tick *This add-on requires payment, non-free services or
software, or additional hardware*. Mozilla's policy: "Listings must disclose
when payment is required to enable any add-on functionality"
([policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)),
and Pro is paid.

**F12 — Submit.** Attach the source to every later version too: Mozilla
wants it each time.

---

## Edge Add-ons

**Ready once BLOCKED 1 is done and BLOCKED 3 decided.** About 40 minutes. Fee: **none** — "There is no
registration fee for submitting extensions to the Microsoft Edge program"
([Microsoft](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)).
Every field below is from Microsoft's
[publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).

**E1 — Account.** Register at <https://partner.microsoft.com/dashboard/microsoftedge>
with a Microsoft account (or sign in with GitHub, which makes one). Account
type: *Individual*, unless you have a registered company — it cannot be
changed later. Publisher display name: the same
one as Chrome (BLOCKED 4), 50 characters at most.

**E2 — Upload.** *Create new extension* → `weft-chrome-1.0.1.zip`. Edge
runs the Chrome package unchanged; there is no Edge build.

**E3 — Availability.** Visibility: *Public*. Markets: all (the default).

**E4 — Properties.** Category: *Education* if the list offers it, otherwise
*Productivity*, the listing's second choice. Website: `https://weft.study`.
Mature content: unticked. Support contact detail:

<!-- paste: support-url -->
```text
https://weft.study/support
```

**E5 — Privacy → Single purpose.**

<!-- paste: single-purpose -->
```text
Weft has one purpose: helping someone learn a language by partially translating the web pages they read. Every feature serves that purpose. The difficulty controls, the site lists and the commitment cooldowns all govern when and how much of that translation happens; the progress page reports on the vocabulary it has taught. There is no second function.
```

**E6 — Privacy → Permission justification.** Edge lists the same permissions
as Chrome, from the same manifest.

`storage`

<!-- paste: permission:storage -->
```text
Stores settings and the learner's vocabulary locally. No remote storage is used.
```

`alarms`

<!-- paste: permission:alarms -->
```text
Difficulty-reducing settings changes are held behind a cooldown that must expire reliably. An MV3 service worker is terminated when idle, so an alarm is the only way for a stored cooldown to apply on time. Also used to end a panic pass on time and to write the learner's vocabulary to storage once a minute.
```

`scripting`

<!-- paste: permission:scripting -->
```text
The content script is registered at runtime with registerContentScripts for exactly the origins the user has granted, rather than declared statically for all sites. This is what lets the extension ship with no install-time host permissions.
```

`tabs`

<!-- paste: permission:tabs -->
```text
Reads the active tab's URL to decide whether that site is on the user's list, and notifies open tabs when settings change so they re-render without a reload. No browsing history is read or stored; attention is recorded against the registrable domain only.
```

`contextMenus`

<!-- paste: permission:contextMenus -->
```text
Two entries on the extension's own toolbar button, for the progress and settings pages. (Named menus in Safari and Firefox; the code resolves whichever the browser provides.)
```

`notifications`

<!-- paste: permission:notifications -->
```text
Informs the user when a settings change they queued has finished its cooldown and taken effect, and answers a panic pass asked for with the keyboard shortcut. Not requested in the Safari build, which has no notifications API; there the toolbar badge is used instead.
```

Host permission (`*://*/*`, optional), if the form lists it:

<!-- paste: permission:optional_host_permissions -->
```text
Requested per-origin at runtime, from a user gesture on one of the extension's own pages — the first-run page, the settings page's Sites section, or the toolbar popup on the site being read — for only the sites the user selects. Never requested at install time.
```

**E7 — Remote code:** *No, I am not using remote code.* **Data usage:** tick
none of the data types, then every certification.

**E8 — Privacy policy URL.**

<!-- paste: privacy-url -->
```text
https://weft.study/privacy
```

**E9 — Store listings → English → Edit details.** Extension name and short
description come from the package and cannot be typed here; they will read as
in C3. Description — Edge wants 250 to 10 000 characters, and `npm test`
fails if this stops fitting:

**The clause holds here:** the screen-time paragraph's last clause, that
Hard Mode "generates a browser policy making the extension unremovable", is
true in Microsoft Edge for the copy this listing serves. Since 2026-11-07
Weft writes Edge's own policy, on Windows and macOS, for its copy from Edge
Add-ons, which is the only copy Edge force-installs on a machine nobody
manages; a copy from the Chrome Web Store running in Edge is told why it
has none (`docs/HARD-MODE.md`, Microsoft Edge). Edge on Linux has no file,
Microsoft listing the policy for Windows and macOS only.

<details><summary>Description — click to open, then copy</summary>

<!-- paste: description -->
```text
Some of the words on the pages you read are in another language. The longer you stay on a page, the more of them there are.

Weft weaves a proportion of the words on a page into a language you are learning, and raises that proportion with the time you actually spend looking at the page. Five minutes on a news article costs you almost nothing. Forty minutes on an infinite feed and a third of the words Weft knows are in French.

Point at a word and it gives you the English back.

Why it works. This is the diglot weave, a method developed at BYU in the 1970s and tested since: keep a text almost entirely comprehensible and weave the new language in just above your threshold, so meaning arrives from context rather than from a dictionary. Weft's addition is tying the difficulty to your attention, so the time you were going to lose anyway is what buys the vocabulary.

You already know more French than you think. A very large part of English arrived from French, and nearly as much again from Latin, which French grew out of, so the word on your page is often already inside an English word you use — and the tooltip says which. cheval shares a root with "cavalry" and "chivalry", fenêtre with "defenestration", jour with "journal" and "journey". That is the difference between memorising a word and noticing you have known it for years.

Seven languages. French, Spanish, German, Italian and Portuguese — plus Latin and Old English, for anyone who wants the same device taken as far as it goes.

A real memory model. Weft schedules with FSRS-6, the open-source memory model Anki also offers. Words you are about to forget come back; words you have genuinely learned are left in the target language for good and stop counting against the page's difficulty. The page becomes the review session, and you never sit down to study.

The screen-time half. Anything that makes Weft easier waits out a cooldown you set in advance — and, with Pro, behind a short vocabulary check drawn from words you have already seen. The clock is stored, not scheduled: closing the browser neither cancels it nor restarts it. Cancelling a queued change is always instant and free. There is a rate-limited panic pass for the moment you genuinely need plain English, and, with Pro, a Hard Mode that generates a browser policy making the extension unremovable without an administrator password.

It does not touch what matters. Weft ships a never-weave list covering money, mail, credentials and health, checked before anything else. It never rewrites a button label, a code sample, anything you are typing, or a screen-reader live region.

No account. No server. No telemetry. Everything is on your machine and it works offline. Weft asks for access to no website until you name the sites yourself, which is why it installs without the warning about reading all your data. With Pro you can add your own DeepL, Google or OpenAI-compatible key for words beyond the built-in lexicons — and even then it sends single words, never the page. An OpenAI-compatible service is sent the sentence each word appears in as well, but only if you turn on “Send the surrounding sentence”, which is off by default.

Free, and Pro. Everything above is free except what is marked Pro. Pro is a licence checked on your machine, with no account, and adds Hard Mode, your own translation key, the vocabulary check and sixty days of attention history.

Open source. MIT licensed.
```

</details>

**E10 — Images.**

- Extension logo: `docs/store/logo-edge-300x300.png`
- Small promotional tile: `docs/store/tile-small-440x280.png`
- Large promotional tile: `docs/store/tile-marquee-1400x560.png`
- Screenshots: the **Chrome** five, `docs/store/chrome-01-woven.png` …
  `chrome-05-settings.png`, 1280×800 each. Microsoft accepts 640×480 or
  1280×800 only, so Edge has no set of its own.
- Search terms: optional; none are drafted.

**E11 — Publish.** *Notes for certification* is optional; the C14 answer is a
good one to paste. Certification takes up to seven business days.

---

## Safari (Mac App Store)

**Not ready, and the biggest job of the four.** Fee: **99 USD a year**,
recurring — "$99 annual membership" ([Apple](https://developer.apple.com/programs/)),
required to distribute at all.

Apple now takes a zip: "Simply upload a ZIP file with your extension to App
Store Connect to have it converted for you and packaged up for testing"
([Apple](https://developer.apple.com/safari/extensions/)), "without using a
Mac or Xcode". So `weft-safari-1.0.1.zip` is the file to try. Nobody has:
Apple's packager guide returned no text when this page was checked, so
whether it takes a flat archive like this one, which platforms it builds and
which Safari it targets are all unread. The older route — `npm run safari`
and the full 7 GB Xcode, as `docs/SUBMIT.md` describes — has never been run
here either.

Three things to settle before the forms:

- **Pro, which only you can decide.** App Review Guideline 3.1.1 says apps
  "may not use their own mechanisms to unlock content or functionality, such
  as license keys", and 4.4 that extensions "may not include marketing,
  advertising, or in-app purchases"
  ([guidelines](https://developer.apple.com/app-store/review/guidelines/)).
  Weft Pro is a licence key, and the options page has buy buttons. Expect a
  rejection until the Safari build drops Pro or sells it through In-App
  Purchase.
- **The support URL.** Apple's "must lead to actual contact information
  (legal address, email address, telephone number)"
  ([Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)),
  and `/support` gives a GitHub issues link (BLOCKED 4).
- **A hand check in Safari 16.4–17.1**, where the wrapped renderer runs and
  no automated test reaches: woven words must be styled.

**S1 — Join** the Apple Developer Program (BLOCKED 4), then open App Store
Connect.

**S2 — Upload** `weft-safari-1.0.1.zip` to the Safari web extension
packager, and try the build through TestFlight. If the packager refuses it,
fall back to `npm run safari` and Xcode.

**S3 — App information.** Category: *Education*. Copyright (required):
`2026 Weft contributors`, as `LICENSE` has it. Name, 30 characters at most:

<!-- paste: name -->
```text
Weft — Language Immersion
```

Subtitle, 30 characters at most: **not drafted** — the short description is
112. Privacy Policy URL (required for Mac apps):

<!-- paste: privacy-url -->
```text
https://weft.study/privacy
```

**S4 — Version information.** Description, 4 000 characters at most:

**Decide before pasting:** the screen-time paragraph's last clause, that
Hard Mode "generates a browser policy making the extension unremovable",
is true in Google Chrome and Microsoft Edge alone. In Safari the settings
page says Hard Mode has no file there, because Safari reads no policy
written for Chrome or Edge (TODO.md, Hard Mode per browser). Keeping the clause promises a reviewer
something they can look for and not find; dropping it here means a
Safari variant of the description in `docs/STORE-LISTING.md`.

<details><summary>Description — click to open, then copy</summary>

<!-- paste: description -->
```text
Some of the words on the pages you read are in another language. The longer you stay on a page, the more of them there are.

Weft weaves a proportion of the words on a page into a language you are learning, and raises that proportion with the time you actually spend looking at the page. Five minutes on a news article costs you almost nothing. Forty minutes on an infinite feed and a third of the words Weft knows are in French.

Point at a word and it gives you the English back.

Why it works. This is the diglot weave, a method developed at BYU in the 1970s and tested since: keep a text almost entirely comprehensible and weave the new language in just above your threshold, so meaning arrives from context rather than from a dictionary. Weft's addition is tying the difficulty to your attention, so the time you were going to lose anyway is what buys the vocabulary.

You already know more French than you think. A very large part of English arrived from French, and nearly as much again from Latin, which French grew out of, so the word on your page is often already inside an English word you use — and the tooltip says which. cheval shares a root with "cavalry" and "chivalry", fenêtre with "defenestration", jour with "journal" and "journey". That is the difference between memorising a word and noticing you have known it for years.

Seven languages. French, Spanish, German, Italian and Portuguese — plus Latin and Old English, for anyone who wants the same device taken as far as it goes.

A real memory model. Weft schedules with FSRS-6, the open-source memory model Anki also offers. Words you are about to forget come back; words you have genuinely learned are left in the target language for good and stop counting against the page's difficulty. The page becomes the review session, and you never sit down to study.

The screen-time half. Anything that makes Weft easier waits out a cooldown you set in advance — and, with Pro, behind a short vocabulary check drawn from words you have already seen. The clock is stored, not scheduled: closing the browser neither cancels it nor restarts it. Cancelling a queued change is always instant and free. There is a rate-limited panic pass for the moment you genuinely need plain English, and, with Pro, a Hard Mode that generates a browser policy making the extension unremovable without an administrator password.

It does not touch what matters. Weft ships a never-weave list covering money, mail, credentials and health, checked before anything else. It never rewrites a button label, a code sample, anything you are typing, or a screen-reader live region.

No account. No server. No telemetry. Everything is on your machine and it works offline. Weft asks for access to no website until you name the sites yourself, which is why it installs without the warning about reading all your data. With Pro you can add your own DeepL, Google or OpenAI-compatible key for words beyond the built-in lexicons — and even then it sends single words, never the page. An OpenAI-compatible service is sent the sentence each word appears in as well, but only if you turn on “Send the surrounding sentence”, which is off by default.

Free, and Pro. Everything above is free except what is marked Pro. Pro is a licence checked on your machine, with no account, and adds Hard Mode, your own translation key, the vocabulary check and sixty days of attention history.

Open source. MIT licensed.
```

</details>

Keywords, 100 bytes, required: **not drafted**. Marketing URL:
`https://weft.study`. Support URL (but see above):

<!-- paste: support-url -->
```text
https://weft.study/support
```

Screenshots: `docs/store/apple-01-woven.png` … `apple-05-settings.png`
(1440×900, one of the four sizes Apple takes, and without the alpha channel
it refuses —
[specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)).

**S5 — App Privacy.** The listing's disclosures say nothing is collected (as
in C11). The one thing to weigh first: with the optional own-key provider,
single words go to the translation service the user picked, and with “Send
the surrounding sentence” on, the sentence each word appears in goes to an
OpenAI-compatible one. Read Apple's definition of "collect" before choosing
*Data Not Collected*.

**S6 — Trader status, price, submit.** Trader status is BLOCKED 4. Price:
free. Then submit the build for review.

---

## BLOCKED — only Creagh can do these

Roughly in this order: 1 first, because every store waits on it; 5 last.

1. **Register `weft.study`, and host the site on it.** NXDOMAIN at the
   registry's own server on 2026-10-24 (`docs/SUBMIT-STATUS.md`). Then: make
   the repository public
   (`gh repo edit quiquae/weft --visibility public --accept-visibility-change-consequences`),
   turn on Pages (Settings → Pages → Source: GitHub Actions) and run
   `gh variable set WEFT_PAGES --body true`. Done when this prints `200`:
   `curl -sS -o /dev/null -w '%{http_code}\n' https://weft.study/privacy`.
   *(TODO.md B1, B2, B3.)* Making the repository public is also what makes
   the description's "Open source. MIT licensed." true, and the support page's
   issue-tracker link stop returning 404.
2. **Push the `v1.0.1` tag**, after regenerating the release notes on a
   clean `main` (TODO.md B2a). It fires the release workflow, which publishes.
3. **Decide the three Pro buy buttons.** The package's options page links to
   `https://weft.lemonsqueezy.com/checkout/buy/…`, a placeholder: it returned
   `404` at 22:51 UTC on 2026-10-24. Either create the Lemon Squeezy products
   and replace `CHECKOUT_BASE` in `src/core/pricing.ts`, then rebuild (step
   0.1), or submit knowing a reviewer can click a dead link. *(TODO.md B4.)*
4. **Open the store accounts and pay.** Chrome: a one-time fee, about 5 USD.
   Edge: free, with a Microsoft account. Firefox: free. Apple: 99 USD a year,
   for Safari only. Use one publisher name everywhere — it is awkward to
   change on Chrome and painful on Apple. Two answers to have ready before
   you start, because both publish personal details:
   - **Trader status (EU Digital Services Act).** Weft sells Pro, so expect
     to be asked. Apple asks every account and publishes a trader's address,
     phone number and email in the EU
     ([Apple](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements));
     Google shows "the verified information of traders" to users
     ([Google](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure))
     and wants a physical address for items that "offer functionality to
     purchase items, additional features, or subscriptions"
     ([Google](https://developer.chrome.com/docs/webstore/set-up-account)).
   - **A support email address.** None exists anywhere in this repository;
     the support page points at GitHub issues. Apple's support URL "must lead
     to actual contact information (legal address, email address, telephone
     number)", which `/support` does not give.
5. **Post the launch links — by hand, after the Chrome listing is live.**
   `docs/LAUNCH.md` has a draft per community and says it first: no automated
   account may post any of it, because coordinated self-promotion earns a
   domain-level shadowban, which would bury the site's 714 pages.

**Next, 2 minutes:** type `weft.study` into any registrar's domain search and
see whether it can be bought.
