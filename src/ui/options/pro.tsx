import { useState } from 'preact/hooks';
import { FEATURES, featureInfo, type Feature } from '../../core/entitlements.ts';
import { describeLicence, needsAttention } from '../../core/licence.ts';
import { PLANS, PRICING_URL, formatPrice } from '../../core/pricing.ts';
import { Notice, Row, Section } from '../components/pieces.tsx';
import type { Controller } from './controller.ts';
import { SIGLA } from './sections.tsx';

/**
 * Licence entry and the Pro section.
 *
 * The tone here is the whole point. A locked feature is explained, once,
 * where it lives — not behind a modal, not with a countdown, not with a badge
 * on every row. Someone using Weft free is using the product as designed, and
 * the interface should not spend their attention telling them otherwise.
 *
 * So: one section, the features listed with what they actually do, and a
 * quiet link. No nagging.
 */
export function ProSection({ c }: { c: Controller }) {
  const [key, setKey] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const licence = c.licence;
  const isPro = c.tier === 'pro';
  // Read once, so the nudge and the sentence in it agree about how long is left.
  const now = Date.now();

  async function submit() {
    if (!key.trim()) return;
    const message = await c.applyLicence(key);
    setResult(message);
    setKey('');
  }

  return (
    <Section
      siglum={SIGLA.leaf}
      title={isPro ? 'Your licence' : 'Weft Pro'}
      note={
        isPro
          ? 'Verified on this machine against a key compiled into the extension. Weft makes no request to check it — there is no activation server and nothing to phone home.'
          : 'Free is one language, forever, with the whole lexicon for it and the whole idea. Pro is for using several at once.'
      }
    >
      {licence && licence.kind !== 'none' ? (
        <Row siglum={SIGLA.leaf} title="Status">
          <div class="stack">
            {needsAttention(licence, now) ? (
              <Notice tone="warn">{describeLicence(licence, now)}</Notice>
            ) : (
              <p class="row__detail" style={{ margin: 0 }}>
                {describeLicence(licence, now)}
              </p>
            )}
            <div class="inline">
              <button type="button" onClick={() => void c.clearLicence()}>
                Remove this licence
              </button>
            </div>
          </div>
        </Row>
      ) : null}

      {!isPro ? (
        <>
          <Row
            siglum={SIGLA.leaf}
            title="What Pro adds"
            detail="Everything below is off on Free. Nothing below is something Weft needs in order to work."
          >
            <ul class="pro__list">
              {FEATURES.filter((f) => f.tier === 'pro').map((f) => (
                <li key={f.id}>
                  <strong>{f.label}</strong>
                  <span>{f.detail}</span>
                </li>
              ))}
            </ul>
          </Row>

          <Row siglum={SIGLA.leaf} title="Price">
            <div class="pro__plans">
              {PLANS.map((plan) => (
                <a
                  key={plan.id}
                  class="pro__plan"
                  data-featured={plan.featured ? '1' : undefined}
                  href={plan.checkout}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span class="pro__planLabel">{plan.label}</span>
                  <span class="pro__planPrice">{formatPrice(plan)}</span>
                  <span class="pro__planPer">{plan.per}</span>
                  <span class="pro__planNote">{plan.note}</span>
                </a>
              ))}
            </div>
            <p class="row__detail">
              <a href={PRICING_URL} target="_blank" rel="noreferrer">
                Compare the plans
              </a>
              . Student and low-income keys exist; ask.
            </p>
          </Row>
        </>
      ) : null}

      <Row
        siglum={SIGLA.leaf}
        title={isPro ? 'Replace the licence key' : 'Already bought it?'}
        detail="Paste the key from your receipt. It is verified here on your machine, offline."
      >
        <form
          class="inline"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="text"
            value={key}
            placeholder="WEFT-..."
            spellcheck={false}
            autocomplete="off"
            aria-label="Licence key"
            onInput={(e) => setKey((e.currentTarget as HTMLInputElement).value)}
          />
          <button type="submit" data-variant="primary" disabled={!key.trim() || c.busy}>
            {c.busy ? 'Checking…' : 'Activate'}
          </button>
        </form>
        {result ? <Notice>{result}</Notice> : null}
      </Row>

      {c.exceeds.length ? (
        <Row siglum={SIGLA.leaf} title="Waiting for a licence">
          <p class="row__detail" style={{ margin: 0 }}>
            You have {c.exceeds.length === 1 ? 'a setting' : `${c.exceeds.length} settings`}{' '}
            configured that Pro would switch back on:{' '}
            {c.exceeds.map((f) => featureInfo(f).label.toLowerCase()).join(', ')}. Nothing was
            deleted — it is all still stored and comes straight back.
          </p>
        </Row>
      ) : null}
    </Section>
  );
}

/**
 * The inline affordance for a locked control.
 *
 * Renders the reason in place of the control, so the row still explains what
 * the feature is. Showing a disabled switch with no explanation is how you
 * make someone feel cheated by software they have not paid for.
 */
export function Locked({ feature }: { feature: Feature }) {
  const info = featureInfo(feature);
  return (
    <p class="locked">
      <span class="locked__mark" aria-hidden="true">
        {SIGLA.leaf}
      </span>
      {/*
        One element for the whole message, because .locked is a flex
        container: without this every inline piece — the text, the link, the
        full stop — becomes its own flex item, and the link collapses into a
        narrow column reading "Part / of / Pro" with a stray period beside
        it. Visible on every locked row, which for a free reader is most of
        this page.
      */}
      <span class="locked__body">
        {info.detail}{' '}
        <a href={PRICING_URL} target="_blank" rel="noreferrer">
          Part of Pro
        </a>
        .
      </span>
    </p>
  );
}
