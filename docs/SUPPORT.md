# Support

Weft has no account and no server, so there is nothing to be locked out of
and nobody holding a ticket queue. What there is: an extension that tells you
what it is doing, a diagnostic report it assembles for you, and one place to
send that report.

## Start with the Weft button

Nearly every "it isn't working" has its answer in the popup, on the page it
is not working on. Open that page and click Weft in the toolbar. One of these
is showing:

- **"Nothing is woven here yet."** The site is not on your list. The button
  below that line adds it — it asks the browser for access to that one
  origin, and nothing else. Weft ships with access to no website at all, so
  a site that has never been named is the ordinary state, not a fault.
- **"Weft never touches this page."** The page matched the never-weave list,
  and the line names the pattern it matched. The list ships covering mail,
  money, passwords and sign-in, health and government, checkouts and forms
  you cannot take back, and the places you write rather than read, such as
  Google Docs and Notion; the browser's own pages are never woven either.
  That check runs before every other rule and before a lexicon is even
  loaded. You can edit the list in Settings → **Sites** → **Never weave**.
  Adding a site to the never-weave list makes Weft easier, so it waits out a
  cooldown; taking one off applies at once.
- **"A panic pass is running."** Plain English, deliberately, until the pass
  expires.
- **A warning naming what went wrong.** The background worker did not
  answer, the page declares a language other than English, so there is
  nothing to weave from, or the word list failed to load. Silence would be
  the least useful failure a product can have, so each of those is reported
  rather than left to look like nothing happening.

If the popup says a percentage and the page still looks like English, read it
again more slowly. At low density a few percent of the words is a handful per
screen, which is the intended dose for the first few days.

## The ones that come up most

### Nothing is woven on any site

Open Settings → **Sites** and check that at least one site is listed and
that the browser has actually granted it: the section says which listed
sites it has not, and asks for them in one click. A site can be on your list
with its permission declined; the popup on that site says so too.

### A site is on my list and still does nothing

Being on the list and being granted are two separate things: a permission
prompt can be dismissed, and Weft records the site either way rather than
silently dropping it. The popup on that site says which state it is in, and
offers to ask the browser again.

### A word looks wrong

Three different things wear that description:

- **A wrong gloss.** Each lexicon has 356 checked English lemmas, and the
  five modern ones about 2,200 more drafted from English Wiktionary, which
  the tooltip marks "Wiktionary, unreviewed"; Latin has 785 drafted, glossed
  from Lewis & Short and marked "Lewis & Short, unreviewed". Any word can still be the
  wrong sense for your sentence. Report it; it is a one-line fix in `tools/seed/`.
- **A word that will not revert.** Difficulty only ever rises inside a page.
  Whatever is on screen stays, so a word you have just decoded cannot flip
  back to English while you are reading it. Reload for a fresh selection.
- **A word Weft should never have touched.** Function words — "the", "of",
  "and" — are never woven. If you are seeing one, that is a bug worth a
  report.

### Pronunciation is silent

Weft uses the browser's built-in `speechSynthesis`. Latin and Old English
have no voice on any platform, so those two show IPA and never call it. For
the five modern languages, a silent button usually means the operating system
has no voice installed for that language; the browser's own settings are
where that is fixed.

### A setting will not change yet

Anything that makes Weft *harder* applies at once. Anything that makes it
easier waits out a cooldown you configured earlier. That is the product, not
a fault — and cancelling a queued change is instant and free, because
friction on the way out of a commitment would be coercion rather than
support. Settings shows what is queued and when it lands.

If you need plain English right now, use a panic pass: the popup offers one,
and it is also on a keyboard shortcut you can bind at your browser's
extension-shortcuts page. Weft ships with `Alt+Shift+R` to reveal the word
under the cursor and `Alt+Shift+N` to move to the next woven word; the panic
pass is deliberately left unbound so it cannot be hit by accident.

## Reporting a problem

Settings → **Help** → **Gather the details**.

Weft assembles the version, the build, the browser, and counts: how many
sites are configured, how many words are known, which tier. Never which
sites, never which words, never a key you have entered. The report is shown
in full on the page before you copy it, so that you read it rather than
trusting a summary of it.

**Nothing is transmitted.** The report exists only on that page until you
copy it somewhere yourself. A support form that quietly posted a diagnostic
bundle would make a liar of the dashboard one screen over, which counts every
network request Weft has ever made.

Then open an issue with it attached, at
[the Weft issue tracker](https://github.com/quiquae/weft/issues).

A report that says what you expected, what happened, and which page it
happened on is worth ten that say it is broken. The decisions that matter —
which word to weave, how hard the page should be, whether a change may land
yet — are pure functions with no I/O, so a specific claim is usually
checkable in minutes.

## What Weft will never ask you for

There is no account, so there is no password and nobody can ask you to
confirm one. Weft will never ask you to install a build from anywhere but its
own release page, and never for the contents of your storage — the export
strips your API keys and install id before it writes the file, and anyone
telling you to turn that off is not helping you.

## What it costs

Nothing. Every feature Weft has is free, and there is nothing to buy.

See [Privacy](PRIVACY.md) for what leaves your machine, which is nothing
unless you go out of your way.

## Taking your data with you

Settings → **Your data** → **Export everything** writes a JSON file of your
settings, your whole vocabulary and your reading history, with API keys and
the install id stripped. Import
merges, keeping whichever record shows more learning, so moving between
machines never loses progress in either direction. Your API keys, and the
address of any OpenAI-compatible service, stay on the machine you typed them
on, so type them in again on a new one. Switch the translation service on
there yourself too: an import can turn lookups and sentence context off, but
never on.

Export is never a paid feature, and neither are accessibility, the
never-weave list, panic passes, pronunciation or the etymologies. A test
fails by name if one of them moves behind the paywall.

Uninstalling removes everything Weft stored, because everything Weft stored
was in your browser. Export first if you want to keep it.
