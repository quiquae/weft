# Submission status

**Measured 2026-10-24, 21:59–22:12 UTC, on `main` at `42b3b28`.** Every npm
command below was run on its own, in the order `SUBMIT.md` gives them, with
npm's own exit status captured rather than a pipe's. This is a snapshot, not a live
claim: if `git log -1` shows a later commit than `42b3b28`, run the gate
again before relying on any figure here, and rewrite this file from that run
rather than editing its numbers by hand.

**Verdict: the gate passes, and the submission is blocked.** Every check in
the gate is green, except `artefacts:check`, which exits 1 for the one reason
it must until the tag (**B2a** in `TODO.md`). But the privacy policy
URL the Chrome Web Store requires, `https://weft.study/privacy`, does not
resolve, because `weft.study` has no delegation in the `.study` zone. That is
**B1**, and nothing in the gate measures it: see the last section.

Machine: macOS 27.0.1 on arm64, Node 26.7.0, npm 11.19.0, Playwright 1.63.0.
`.nvmrc` and CI pin Node 22. The local runs recorded in `CLAUDE.md` all used
26.7, as this one did; the check against the pinned version is CI, which runs
everything here but `site:check` and `artefacts:check` on Node 22 for every
pull request.

## The gate, as `SUBMIT.md` defines it

| Command | Exit | Result | Wall clock |
|---|---|---|---|
| `npm run test:all` | **0** | every step green; the breakdown is below | 5 min 15 s |
| `npm run packs:verify` | **0** | 0 errors, 5 warnings — the five Old English targets of more than one word carry no IPA, expected since 2026-10-07 | 1 s |
| `npm run site` | **0** | 714 URLs in `sitemap.xml`, written to `dist/site` | 5 s |
| `npm run site:check` | **0** | 714 pages, 16 118 internal links, all resolve; all 3 externally-referenced pages exist in the build | 3 s |
| `npm run artefacts:check` | **1** | 8 groups, 1 stale: the release notes, written at `d2e834f`, 84 commits behind. The other seven are `ok` | 2 s |
| `npm run zip` | **0** | six archives; `weft-chrome-1.0.1.zip` is 224 859 bytes, `manifest.json` at its root, `"version": "1.0.1"` | 4 s |
| `npm run validate` | **0** | all 3 packages pass: Chrome 989 KB, Firefox 990, Safari 990 unpacked | under 1 s |

`site:check` reads `dist/site` and does not build it, so `npm run site` ran
first. `zip` and `validate` come from the Chrome Web Store block in
`SUBMIT.md`, whose last line, the live `curl`, is measured in the last
section below; `validate` reads `dist/<target>`, the directories `zip` had
just built and archived.

### Inside `npm run test:all`

| Step | Result |
|---|---|
| `typecheck` | `tsc --noEmit` clean |
| `test:unit` | **566** pass, 0 fail, 137 suites |
| `test:dom` | **102** pass, 0 fail, 23 suites |
| `test:tools` | **431** pass, 0 fail, 102 suites |
| `compat` | 21 dependencies × 3 browsers, floors Chrome 116, Firefox 128, Safari 16.4: 56 pass, 7 degrade with a named fallback, 0 fail, 0 without data |
| `build:all` | Chrome 989 KB, Firefox 990 KB, Safari 990 KB |
| `validate` | all 3 packages pass |
| `test:e2e` | 43 tests on 1 worker: **40 passed** in 4.3 min, **3 skipped** — the three asset generators, `firstrun.spec.ts:22`, `screenshots.spec.ts:103` and `store-assets.spec.ts:45`, which run only behind their `WEFT_*` variables |
| `build:all`, `validate` | again, the same sizes, all 3 pass |

### The warnings and the stale group, read rather than counted

`packs:verify`'s five warnings are `lex-ang.tsv:374`, `:405`, `:406`, `:407`
and `:408`, the rows for "tomorrow", "hello", "goodbye", "please" and "sorry",
woven as `tō morgen`, `wes hāl`, `wes hāl`, `iċ bidde` and `mē hrēoweþ`. Each
is "no IPA, and ang has no speech-synthesis voice": the transcription
generator writes none for a phrase. Built packs: 581–588 entries across
576–583 surface forms, 356 rows in each of the seven seeds.

`artefacts:check`'s stale group is `RELEASE-1.0.1.md`. It is generated from
`git log`, so every commit stales it, and it cannot be made fresh inside a PR
because the squash commit that lands it does not exist yet. Regenerate it on a
clean `main` immediately before pushing the tag (`npm run release --
--version=1.0.1`), as **B2a** says. The seven `ok` groups: the store listing
screenshots, documentation screenshots, first-run walkthrough shots, icon
comparison sheet, shipped extension icons, social card and store promo tiles.

The six archives on disk before this run were written on 2026-09-29, when
1.0.1 was cut: the Chrome store archive was 218 593 bytes, where the one
`main` builds today is 224 859. `npm run zip` replaced them. They are
gitignored, so the next change to `src/` makes them stale again without
anything saying so: run `npm run zip` immediately before uploading, never
upload one an earlier session left behind.

## The blocker: the privacy policy URL does not resolve

**`site:check` passing is not evidence that the site is up.** It reads the
files `npm run site` writes and skips every absolute URL
(`tools/check-links.mjs:50`), so it proves the build contains a page at
`/privacy`, `/support` and `/pricing`. Whether `https://weft.study` serves
them is a question it never asks, and it passes whether or not the domain
exists. The live URLs were measured separately, at 21:59 UTC, and the
privacy URL again at 22:11:

| Measurement | Result |
|---|---|
| `dig weft.study A @8.8.8.8` | `NXDOMAIN` |
| `dig weft.study A @1.1.1.1` | `NXDOMAIN` |
| `dig study. NS` | `a.nic.study.`, `b.nic.study.`, `c.nic.study.` — the TLD resolves |
| `dig weft.study NS @a.nic.study. +norecurse` | `NXDOMAIN`, flags `qr aa`: the registry's own server, answering with authority |
| `curl https://weft.study/privacy` | exit 6, `Could not resolve host: weft.study`, HTTP `000` |
| `curl https://weft.study/support` | the same |
| `curl https://weft.study/pricing` | the same |

So the URL the store listing gives for the privacy policy
(`docs/STORE-LISTING.md`) and the two compiled into the shipped extension
(`SUPPORT_URL` and `PRICING_URL` in `src/core/pricing.ts`) all point at a name
that is not in the `.study` zone. The Chrome Web Store rejects a submission
whose privacy policy does not load. An NXDOMAIN from the registry's own
server means the name is not in the zone. That is what an unregistered name
returns, and also what a registered one held without nameservers returns, so
a registrar's search, not this measurement, says whether it can be bought.

No check in the repository measures this, on purpose: a CI step that fetched
`weft.study` would fail on every push until B1, and the `Site` workflow's own
comments give the reason that rules it out — a red X that is ignored is worse
than no check at all.

## What it waits on, in order

1. **B1** — register `weft.study`, or choose another domain and change every
   line the `git grep` in `TODO.md`'s B1 finds — the store listing's privacy
   and support URLs among them — except the Firefox id `weft@weft.study`,
   which stays either way.
2. **B2** — make the repository public, or set `WEFT_REPO`. Run **B2a**
   immediately before pushing the `v1.0.1` tag.
3. **B3** — turn on Pages and `gh variable set WEFT_PAGES --body true`.
4. Re-measure the live URL. The command below must print `200`, and the page
   must load in a logged-out browser:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://weft.study/privacy
   ```

5. **B5** — the submission itself, by hand, as `SUBMIT.md` describes. **B4**,
   the checkout URLs, can follow: the free tier needs no purchase.

## To measure again

```bash
npm run test:all
npm run packs:verify
npm run site && npm run site:check
npm run artefacts:check    # exits 1 until B2a: read the list
npm run zip
npm run validate
dig weft.study A @1.1.1.1 | grep status
curl -sS -o /dev/null -w '%{http_code}\n' https://weft.study/privacy
```

Do not chain `artefacts:check` with `&&`: it exits 1 on a correct tree
until the tag, so it would stop everything after it.
