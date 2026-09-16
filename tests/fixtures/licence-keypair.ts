/**
 * A throwaway licence keypair, trusted ONLY by test builds.
 *
 * Both halves are committed deliberately, and that is safe for exactly one
 * reason: nothing that ships trusts this key. `build.mjs` substitutes it for
 * the publisher's key only when invoked with `--test`, and
 * `tools/validate-package.mjs` fails if any shipped bundle contains it.
 *
 * It exists because the end-to-end licensing tests have to mint a licence the
 * extension will actually accept, and the publisher's private key is
 * gitignored — so those tests passed locally and failed in CI on every push.
 * The alternative was skipping them, which would have removed "does a paid
 * licence unlock Pro" from the only place that runs everything.
 */
export const TEST_LICENCE_PUBLIC_JWK: JsonWebKey = {
  "key_ops": [
    "verify"
  ],
  "ext": true,
  "kty": "EC",
  "x": "8aTr5ayRbc1bFxHUZ4cOFJCJtlTR9pQSBGD4_y818e4",
  "y": "qjS2K5kI4VJJkVrOEDmJbukXIjD_AQpQMEWYtaRllL0",
  "crv": "P-256"
};

/** The signing half. Useless against a shipped build. */
export const TEST_LICENCE_PRIVATE_JWK: JsonWebKey = {
  "key_ops": [
    "sign"
  ],
  "ext": true,
  "kty": "EC",
  "x": "8aTr5ayRbc1bFxHUZ4cOFJCJtlTR9pQSBGD4_y818e4",
  "y": "qjS2K5kI4VJJkVrOEDmJbukXIjD_AQpQMEWYtaRllL0",
  "crv": "P-256",
  "d": "0jGOvZHyaNcXEGMbX6ygTO-I9K36-12aRZMGGpcUVGA"
};
