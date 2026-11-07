# Architecture

Weft is four things: a pure decision engine, a content script that applies its
decisions to a page, a service worker that holds authority, and four interface
surfaces. This document is about the decisions that were not obvious, and
about the two or three that everything else follows from.

## The one that matters: edit `nodeValue`, never replace the node

The default renderer changes **no DOM structure at all**. It assigns to a text
node's `nodeValue` and styles the exact character ranges with the CSS Custom
Highlight API.

This is not a micro-optimisation. It is the difference between an extension
that works on a React feed and one that crashes it.

The reason Google Translate breaks React applications is well documented and
specific: it *replaces* text nodes. It builds a new node, inserts it where
yours was, and detaches the original. React's fiber still holds a reference to
the detached node, so the next render calls `removeChild` on a node that no
longer has that parent, and throws `NotFoundError`. Every text-rewriting
extension inherits this hazard, and the usual mitigation is to monkey-patch
`Node.prototype.removeChild` inside the page's own JavaScript context — which
is invasive, requires injecting into the main world, and only suppresses the
symptom.

Assigning to `nodeValue` mutates the existing node in place. The tree is never
restructured, so no framework's reference is ever invalidated, and no patching
is needed.

The cost is that there are no per-word elements to style or to hit-test, and
the Custom Highlight API pays exactly that cost back: it styles arbitrary
character ranges without touching the DOM, and hit-testing is done against
`caretPositionFromPoint` instead of against an element. It has been Baseline
since June 2025 (Chrome/Edge 105, Safari 17.2, Firefox 140, which could not
draw `text-decoration` on a highlight until 146, nor `text-shadow` until 149).

`tests/e2e/pages/reconciler.html` reproduces the failure directly: a page that
stores text-node references and later calls `parent.removeChild(node)` on each
of them. It passes. That test is the evidence for this whole design.

### The second renderer, and why it is a trade-off rather than a fallback

Zero DOM change also means no `lang` attribute and nothing focusable. For a
screen-reader user, French pronounced as mangled English is worse than an
occasional hydration warning — and that is their call to make, not ours. So
there is a `wrapped` renderer behind the same interface that replaces the text
node with `<weft-w lang="fr" tabindex="0">` elements.

`resolveRenderMode` decides per page: an explicit accessibility preference
wins, then an explicit setting, then Highlight-API support, then a framework
check. `auto` prefers the structurally safe renderer.

Wrapped mode is where the subtlest bug in the project lived. The renderer
replaces a text node, which the `MutationObserver` then reports as a *removal*
of that node and additions of several others. Without tracking which nodes it
owns, the page object read its own work as the page changing underneath it: it
looked up the removed node, found the record, and reverted the weave it had
just applied, while re-queueing the text nodes it had inserted. Every
paragraph was woven twice and then immediately unwoven. A `WeakSet` of owned
nodes fixes it.

## `src/core/` is pure

No DOM, no `chrome.*`, no I/O. Every interesting decision lives there:

| Module | Answers |
|---|---|
| `tokenize.ts` | Where are the words, exactly? Byte-exact offsets, because the renderer styles character ranges. |
| `selector.ts` | Which words should change, and in what order of preference? |
| `escalation.ts` | How hard should this page be right now? |
| `fsrs.ts` | What does the learner know? |
| `lock.ts` | Is this settings change allowed yet? |
| `sites.ts` | Should Weft touch this page at all? |
| `quiz.ts` | What can we fairly ask them? |
| `pos-guess.ts` | What part of speech is this unknown word — and should we admit we don't know? |

That boundary is not architectural tidiness for its own sake. It is why the
unit suite runs in seconds without a browser, and why five real bugs were found
before anyone loaded the extension. `tests/tools/core-purity.test.ts` holds it,
because `tsc` cannot: every file is given the DOM library and the chrome types.

## Selection

Ranking is **prefix-monotone in the difficulty ratio**: candidates are ranked
once, deterministically, then accepted greedily in that fixed order until the
budget is spent. Raising the ratio only ever appends.

Determinism comes from seeding the tie-breaker with a hash of the text itself,
so the same paragraph always weaves the same way however many times a
framework re-renders it.

That property holds for a *fixed* set of inputs, which the unit tests verify.
At runtime the inputs drift: every exposure and reveal changes a card's
retrievability, so a word ranked third before a re-weave can rank ninth after
one and fall outside the budget. In the browser that appeared as a word
flipping back to English while the page got harder around it — the one thing
attention-linked difficulty must never do. The fix is explicit rather than
emergent: when difficulty is rising, the words currently on screen are passed
in as `pinned` and accepted first, outside the budget.

Scoring is additive across factors but **multiplicative on the gates**.
Confidence and ambiguity multiply rather than add, because a low-confidence
mapping must not be rescuable by being a nice cognate: a wrong translation
teaches a wrong word, which is worse than teaching nothing.

## The escalation curve

```
ratio(m) = base + (ceiling − base) · (1 − e^(−k·m))
k        = gainPerMinute / (ceiling − base)
```

Exponential approach rather than linear, for three reasons. It cannot
overshoot the ceiling, so there is no clamping discontinuity that reads as a
bug. Its initial slope is exactly `gainPerMinute`, so the one knob a user
touches means something concrete. And diminishing returns match the intent:
the tax should bite early, because that is the nudge to close the tab, then
plateau, because a page that becomes unreadable teaches nothing.

Attention decays while you are away. Without decay the tax is a ratchet and
the only way out is to uninstall.

## What counts as attention

A second counts only when the document is visible, the window has focus, and
there has been interaction within the idle threshold. The third condition is
what stops a parked article from accumulating time. It slightly under-counts
slow readers, which is the right direction to be wrong in.

Exposure is sampled rather than assumed: a word counts as met only once its
rect has actually been inside the viewport. Weaving a word at the bottom of a
long page and calling that an exposure would inflate every statistic and, more
seriously, would tell the scheduler the learner has seen something they have
not.

## Permissions

Weft declares **no static `content_scripts` and no `<all_urls>`**. Host access
is requested per-origin from onboarding, then the content script is registered
at runtime with `chrome.scripting.registerContentScripts({ persistAcrossSessions: true })`.

That costs some code and buys three things: no "read and change all your data
on all websites" install warning, which is the single biggest conversion
killer for an extension; a clean answer to the Chrome Web Store's
narrow-permission review; and a list of sites the user chose rather than a
blanket grant.

The intersection of granted origins against wanted ones is computed **by
host**, not by comparing match-pattern strings. `http://localhost/*` and
`*://localhost/*` name the same site, and an earlier version compared the
strings — which silently registered the content script nowhere whenever the
granted scheme differed from the requested one.

## The service worker

Holds every authority a page must not have: current difficulty, whether a
cooldown has elapsed, what the learner knows. A content script asks; it never
computes.

Written on the assumption that the worker is killed roughly every thirty idle
seconds. Module state is a cache and never the source of truth, every handler
is safe on a cold start, and card writes are debounced and flushed on an
alarm.

### What is signed and what is not

Settings, lock state and attention are HMAC-signed with a key derived from the
install id. Vocabulary cards are not. That looks inconsistent and is not:
signing exists to detect edits that make the extension *easier*, and those
three objects are the only ones that could. Editing a card can only make a
word look less known, which makes the page harder — there is no incentive to
forge one, and HMAC-ing five thousand cards on every exposure would cost real
battery for nothing.

A failed signature is not treated as corruption to be discarded. Discarding
would hand the user a clean slate for editing storage, which is the thing being
guarded against. The data is kept, the event is recorded, and difficulty is
pinned at the ceiling for 12 hours from the last time it was noticed
(`TAMPER_PENALTY_HOURS` in `src/core/lock.ts`). A clock turned back is answered
the same way, being the second half of winding it forward past a cooldown.

None of this is security. The key material ships inside the extension. It is
stated plainly in [PRIVACY.md](PRIVACY.md) rather than implied otherwise.

## Build

Hand-rolled on esbuild rather than a framework plugin. MV3 has hard
constraints — content scripts must be classic scripts, the manifest must be
generated per target, Firefox uses an event page rather than a service worker
— and the failure modes of magic plugins there are much worse than a few
hundred lines of explicit build.

`--test` adds a static `host_permissions` entry for localhost, because Chrome
shows a native dialog for an optional permission request that Playwright
cannot dismiss. Everything else is identical and the dynamic registration path
still runs, so the code under test is the shipping code.

Icons are drawn by `iconPixels()` from the mark's one geometry in
`tools/brand.ts` and encoded by a PNG encoder written against `zlib`. Their
pixels are the same anywhere Node runs, being nothing but arithmetic and
rounding; their bytes are not, because the compressed data is whatever zlib the
Node binary links. So `tests/tools/brand.test.ts` holds each committed icon to
the geometry by its pixels, never by its bytes.

## Things deliberately not done

**No Public Suffix List.** Registrable-domain extraction is a heuristic with a
table of common multi-part suffixes. Shipping the PSL would add ~230 KB to a
content script that runs on every page, and the failure mode is benign: it
groups attention slightly too coarsely for a handful of country domains.

**No main-world injection.** The `nodeValue` approach makes the React
mitigation unnecessary, so nothing is injected into the page's own JavaScript
context.

**No sentence-level translation.** The unit of work is a word, everywhere,
including on the provider path: a translation service is sent single words and
a part-of-speech hint. The one exception is a switch, off by default: with
“Send the surrounding sentence” on, an OpenAI-compatible service is sent the
sentence each word appears in as well, and DeepL and Google are never sent it.
`TranslationRequest` has no field for a page, a paragraph or an address, which
is what lets the privacy guarantee be structural rather than a promise.
