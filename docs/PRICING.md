# Pricing

Canonical version: <https://weft.study/pricing>, generated from
`src/core/pricing.ts` so the site and the extension cannot disagree about the
price.

## Plans

| | Price | Note |
|---|---|---|
| Monthly | $3.50 | Cancel whenever. Your vocabulary stays either way. |
| Yearly | $24 | Works out at $2 a month. The one to choose. |
| Lifetime | $59 | One key, no renewal, no server to outlive. |

Three options rather than two, and the lifetime key is not an afterthought: a
tool whose whole pitch is "no server, nothing phones home" should offer the
purchase that matches that promise. Someone buying Weft to escape
subscriptions should not be sold a subscription.

## Free is not a trial

One language, forever, with the whole lexicon for it, the whole escalation
curve, the whole tooltip, your vocabulary and progress, and export. Someone
can use Weft free for years and get the entire idea.

That is a commercial decision as much as an ethical one. A hobbled free tier
does not convert; it teaches people the product is disappointing.

## Never gated, at any price

- Accessibility. It is a floor, not a feature.
- The never-weave list. Charging for protection from your own product would
  be indefensible.
- Panic passes. The escape valve is what stops a frustrated user uninstalling,
  so paywalling it would cost more in churn than it could earn.
- Exporting your data. It is yours.
- Pronunciation and the etymologies. They are the delight.

`tests/core/entitlements.test.ts` fails if any of these moves behind the
paywall, and names which one.

## How the licence works

A licence is a signed statement, not a token checked against a server. The
payload is signed with a private key only the publisher holds and verified in
the extension against a compiled-in public key using WebCrypto (ECDSA P-256).

No account. No activation. No server. No request at purchase, at launch, or
ever. You can confirm that in the network panel, and the progress page shows a
running count of every request Weft has made.

### What that costs

**A licence cannot be revoked.** There is nowhere to publish a revocation.

- A **yearly** licence carries an expiry date and simply stops verifying when
  it passes.
- A **lifetime** key works forever. If one leaked widely the only remedy would
  be rotating the signing key, which invalidates every licence issued and means
  reissuing them all. The lifetime price reflects that risk rather than
  pretending it away.

If a licence expires nothing is deleted. One language stays active and every
word you know stays known.

## Refunds, students

Thirty days, no questions, no form. Student and low-income keys exist and the
only qualification is asking. There is no means test and nobody is going to
check.

## Issuing keys

```sh
node tools/make-licence.mjs --init                          # once, ever
node tools/make-licence.mjs --name="Ada Lovelace" --tier=pro            # lifetime
node tools/make-licence.mjs --name="Ada Lovelace" --tier=pro --days=365 # yearly
node tools/make-licence.mjs --verify="<key>"
```

`.licence-private.jwk` is gitignored. Back it up somewhere you would put a
password: losing it means every future licence needs a new public key, and
rotating the public key invalidates the licences already sold.
