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

Nothing is synced between your devices: Weft never uses
`chrome.storage.sync`. API keys never leave the machine you typed them on —
an export strips them, and an import neither brings one, removes one, nor
changes where one is sent.

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

> A provider receives **single words and a part-of-speech hint**, never the
> page. The sentence each word appears in goes to an OpenAI-compatible service
> only if you turn on “Send the surrounding sentence”, which is off by
> default; DeepL and Google are never sent it.

This is structural, not a promise. `TranslationRequest` has no `text` field
and no `html` field, so a provider cannot be handed a paragraph of your
reading by accident. Beyond the word, its part of speech and its number it has
one field, `context`, which only “Send the surrounding sentence” fills and only
an OpenAI-compatible service's request carries: the sentence the word sits
in, cut at about 220 characters.

What actually leaves your machine, per word: the word, its guessed part of
speech, and its number. Not the sentence, unless you turn on “Send the
surrounding sentence” below, and then only to an OpenAI-compatible service.
Not the page. Not the URL. Not anything identifying. Answers are cached for as long as you configure, so a word is
sent at most once in that time.

**“Send the surrounding sentence”** improves accuracy for words with several
meanings, and is a separate, explicit opt-in that is off by default. When it
is on, an OpenAI-compatible service is sent the sentence each word appears in
along with the word; DeepL and Google are never sent it. The settings page
says so above the keys while it is on, because it is a real change in what
leaves your computer.

The never-send host list is enforced in the background worker, not in the page.
A content script is the wrong place to keep a privacy guarantee.

There is a daily lookup limit, so a runaway page cannot drain your key. It
counts the words sent, a request that fails included, since those words left
your computer all the same; a word answered from the cache is not sent and
not counted. Its day starts at 4 a.m., as every day in Weft does.

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

Export writes a JSON file containing your settings, your whole vocabulary and
your reading history — seconds per site per day — with API keys, the address
of any OpenAI-compatible service and the install id stripped. The install id
is signing key material, the keys are your own accounts, and an export is a
file you might attach to a bug report. The sites you read are in it, so look
before you send it.

Import merges, keeping whichever record shows more learning, so moving between
machines never loses progress in either direction. Imported settings go
through the same validation and clamping as anything read from storage, and are
re-signed with this install's key. A setting that would make Weft easier waits
out your cooldown, as if you had changed it by hand. API keys stay where they
are, and so does the address a key is sent to: a key in the file is left out,
and a key on this machine is kept, so on a new machine you type yours in
again.

An import can make Weft send less to a translation service and never more. A
file can switch lookups or sentence context off, and that lands at once; it
cannot switch either on, add a service, take a host off the never-send list,
raise the daily lookup limit or shorten how long answers are kept. Those stay
as this machine has them, and the import says what it left out, so a
translation service is only ever switched on by you, on the machine that
holds the key.

"Start my vocabulary over" erases every word Weft knows about you and leaves
your settings alone.

## Permissions, and why each one

| Permission | Why |
|---|---|
| `storage` | Settings and vocabulary, locally |
| `alarms` | Cooldown expiry and the daily rollover must survive the service worker being killed |
| `scripting` | Registering the content script for the sites you granted |
| `tabs` | Reading the current tab's URL to decide whether to weave, and telling open tabs that settings changed |
| `contextMenus` | Right-click entries on the toolbar button |
| `notifications` | Telling you when a queued change has applied. Not requested in the Safari build, which has no notifications API; there the toolbar badge is used |

That is the whole list. Two permissions an earlier version declared have been
removed: `idle`, which had no call sites at all — attention is measured in
the content script, which needs no permission — and `unlimitedStorage`, which
was covering for two stores that grew without bound and are now capped. The
full reasoning is in
[the store listing](STORE-LISTING.md#two-permissions-that-were-removed-and-why-the-answer-matters),
recorded there because a reviewer comparing two versions will see them go.

**No host permissions at install time.** Weft cannot read any website until
you name the sites, which is why it installs without the "read and change all
your data on all websites" warning. Host access is requested per-origin from
the first-run page, and the content script is registered at runtime for
exactly those origins.

## Reporting a problem

The whole extension is a few thousand lines and the interesting half is pure
functions with no I/O. If a claim in this document is wrong, it is checkable —
and [Support](SUPPORT.md) is where to say so. The diagnostic report Weft
assembles for a bug report carries counts and settings, never which sites you
read or which words you know, and it is shown to you in full before you copy
it because nothing sends it for you.
