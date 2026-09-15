# Privacy

Short version: everything is on your machine, there is no account, there is no
server, and there is no telemetry. If you never enable a translation service,
Weft makes no network requests at all.

This document is the long version, including the parts that are limitations
rather than features.

## What Weft stores, and where

All of it in `chrome.storage.local`, on your computer:

| | |
|---|---|
| Settings | Languages, density, site lists, friction configuration |
| Vocabulary | One record per word: how often it has appeared, how often you revealed it, and its FSRS stability and difficulty |
| Attention | Seconds per registrable domain per day, and up to 60 days of daily totals |
| Pending changes | Difficulty reductions waiting out their cooldown |
| An audit log | The last 200 difficulty changes you made |
| Provider cache | If you enable a translation service: word → translation, so a word is only ever sent once |

Settings sync is **off** by default. Turning it on uses
`chrome.storage.sync`, which is Google's or Mozilla's infrastructure, not
ours. API keys are stripped before anything is synced and before anything is
exported.

## What Weft never stores

No page content. No URLs — attention is keyed on the registrable domain, so
`twitter.com` and never `twitter.com/some/thread`. No browsing history. No
identifiers beyond a random install id used as HMAC key material. No account,
because there is nothing to have an account with.

## Telemetry

There is none, and the setting for it does not exist rather than defaulting to
off. `privacy.telemetry` is typed as the literal `false`, and validation
overwrites any other value on every load. Changing that would require changing
the type.

## The never-weave list

Weft ships a deny-list covering money, mail, credentials, health and
government, checked **before any other rule** and before a lexicon is even
loaded. A language tool that translates half the words in your online banking
is not a language tool, it is a hazard.

You can add to it. You can remove entries, but removing one is a
difficulty-reducing change and goes through the cooldown — deliberately, since
"take my bank off the safe list" is not a decision to make in a hurry.

The provider half of that list cannot be pruned at all. Validation
re-unions the shipped defaults on every load, so a translation service can
never be handed a word from a banking page because someone edited a list they
did not understand.

## Translation services, if you enable one

Off by default. Bring your own key. One rule shapes the whole interface:

> A provider receives **isolated words and a part-of-speech hint**. Never page
> text.

This is structural, not a promise. `TranslationRequest` has no `text` field
and no `html` field. There is no parameter to put a paragraph in, so a
provider cannot be handed a paragraph of your reading by accident.

What actually leaves your machine, per word, once ever: the word, its guessed
part of speech, and its number. Not the sentence. Not the page. Not the URL.
Not anything identifying. Answers are cached for as long as you configure, so
a word is sent at most once.

**Sending one sentence of context** improves accuracy for ambiguous words and
is a separate, explicit opt-in that is off by default. When it is on, one
sentence of whatever you are reading goes to your chosen provider. That is
stated in the interface in those words, because it is a real change in what
leaves your computer.

The never-send host list is enforced in the background worker, not in the page.
A content script is the wrong place to keep a privacy guarantee.

There is a daily lookup cap so a runaway page cannot drain your key.

## Speech

Pronunciation uses the browser's built-in `speechSynthesis`. On most platforms
that is local. On some, some voices are served remotely by the operating
system vendor — that is between your OS and its vendor, and Weft has no
visibility into it. Latin and Old English have no voice anywhere, so they show
IPA and never call it.

## What the integrity signing does and does not do

Weft HMAC-signs its settings, lock state and attention counters with a key
derived from your install id, and notices when they have been edited behind
its back.

**This is a tripwire, not security.** The key material ships inside the
extension. Anyone willing to read the source can forge a valid signature. The
goal is to make the lazy bypass cost more effort than doing the reading, which
is the same bargain every screen-time tool on a general-purpose computer
makes.

If you want a real guarantee, that is what [Hard Mode](HARD-MODE.md) is: it
moves enforcement into an operating-system managed policy, where the extension
cannot disable itself and neither can you without an administrator password.

Detected tampering pins difficulty at the ceiling for the day rather than
resetting anything, so editing storage is a losing move rather than a
shortcut. That response is configurable down to "just note it".

## Your data is yours

Export writes a JSON file containing your settings and your whole vocabulary,
with API keys and the install id stripped — the install id is signing key
material, and an export is a file you might attach to a bug report.

Import merges, keeping whichever record shows more learning, so moving between
machines never loses progress in either direction. Imported settings go
through the same validation and clamping as anything read from storage, and are
re-signed with this install's key.

"Start my vocabulary over" erases every word Weft knows about you and leaves
your settings alone.

## Permissions, and why each one

| Permission | Why |
|---|---|
| `storage` | Settings and vocabulary, locally |
| `alarms` | Cooldown expiry and the daily rollover must survive the service worker being killed |
| `scripting` | Registering the content script for the sites you granted |
| `tabs` | Reading the current tab's URL to decide whether to weave, and telling open tabs that settings changed |
| `idle` | Distinguishing "reading" from "walked away" |
| `contextMenus` | Right-click entries on the toolbar button |
| `notifications` | Telling you when a queued change has applied |
| `unlimitedStorage` | A large vocabulary plus the provider cache can exceed the default quota |

**No host permissions at install time.** Weft cannot read any website until
you name the sites, which is why it installs without the "read and change all
your data on all websites" warning. Host access is requested per-origin from
the first-run page, and the content script is registered at runtime for
exactly those origins.

## Reporting a problem

The whole extension is a few thousand lines and the interesting half is pure
functions with no I/O. If a claim in this document is wrong, it is checkable.
