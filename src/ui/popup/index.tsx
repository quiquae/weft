import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../shared/browser.ts';
import { send } from '../../shared/rpc.ts';
import type { PageState } from '../../shared/messages.ts';
import { formatDuration, minutesToRatio } from '../../core/escalation.ts';
import { getLanguage } from '../../core/languages.ts';
import { availabilityFor, availabilityNote, loadPackIndex, type PackIndex } from '../../shared/packs.ts';
import { GlossStrip, Notice, WeaveBand, oneWordIn } from '../components/pieces.tsx';

/**
 * The popup.
 *
 * Answers three questions in the order a reader asks them: what is this page
 * doing to me, why, and how do I get out. The interlinear strip at the top is
 * built from words actually woven into the page in front of the user, which
 * makes the first answer concrete rather than a percentage.
 */

interface Sample {
  pairs: Array<{ target: string; source: string }>;
  ratio: number;
  /**
   * Why nothing was woven, when the answer is not obvious.
   *
   * The content script has several early returns — the worker did not
   * answer, the page is already in the language being learned, the lexicon
   * would not load — and each one left the reader looking at an ordinary
   * page with no explanation anywhere. Silence is the least useful failure
   * a product can have: it is indistinguishable from being broken.
   */
  reason?: string;
}

function Popup() {
  const [state, setState] = useState<PageState | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState<PackIndex | null>(null);
  const [tabUrl, setTabUrl] = useState<string>('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void loadPackIndex().then(setIndex);
  }, []);

  useEffect(() => {
    void (async () => {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url ?? '';
      setTabUrl(url);
      const next = await send({ type: 'get-page-state', url });
      setState(next);
      setLoading(false);
      if (tab?.id !== undefined) {
        try {
          const reply = (await api.tabs.sendMessage(tab.id, { type: 'weft-sample' })) as Sample;
          if (reply?.pairs) setSample(reply);
        } catch {
          // No content script here, which is the normal case on an untaxed site.
        }
      }
    })();
  }, []);

  if (loading) {
    return (
      <div class="pop">
        <p class="muted">Reading the page…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div class="pop">
        <h1 class="pop__title">Weft</h1>
        <p class="muted">Weft could not reach its background worker. Reload the page and try again.</p>
      </div>
    );
  }

  const { decision, settings } = state;
  const lang = getLanguage(decision.target);
  const woven = sample?.pairs ?? [];
  const hostLabel = (() => {
    try {
      return new URL(tabUrl).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  const availability = availabilityFor(
    index,
    settings.learning.sourceLang,
    decision.target,
    settings.providers.enabled,
  );

  const nextMilestone = (() => {
    if (!decision.escalate) return null;
    const targets = [0.25, 0.4, 0.55, 0.7];
    for (const target of targets) {
      if (target <= state.ratio + 0.01) continue;
      const minutes = minutesToRatio(target, {
        baseRatio: decision.baseRatio,
        ceilingRatio: decision.ceilingRatio,
        gainPerMinute: settings.attention.gainPerMinute,
        escalate: true,
      });
      if (!Number.isFinite(minutes)) return null;
      const remaining = Math.max(0, minutes - state.attentionSeconds / 60);
      return { target, remaining };
    }
    return null;
  })();

  /**
   * Turn this site on, from here, in one click.
   *
   * The popup used to answer "this site is not on your list" with a link to
   * the settings page, where the reader had to work out that a site is added
   * by typing a pattern into a list. That is the single most common thing
   * anyone wants from this popup and it was the one thing the popup would
   * not do.
   *
   * It has to happen here rather than in the background because
   * `permissions.request` needs a user gesture, and a click on this button
   * is one; the same call from the service worker is rejected.
   *
   * Adding a site is a *harder* change, so `request-change` applies it
   * immediately — no cooldown. Removing one is what waits, which is the
   * right way round and comes free from the existing lock rules.
   */
  async function addThisSite() {
    let host = '';
    let scheme = '';
    try {
      const u = new URL(tabUrl);
      host = u.hostname;
      // The page's own scheme, not a wildcard. Asking for *:// requests
      // http and https together, which is broader than the reader is
      // looking at and a worse thing to put in a permission prompt. Ports
      // are deliberately absent: Chrome match patterns reject them and
      // ignore them when matching.
      scheme = u.protocol.replace(':', '');
    } catch {
      setMessage('Weft could not read this page\u2019s address.');
      return;
    }
    if (!host || !scheme) return;

    setAdding(true);
    try {
      const origins = [`${scheme}://${host}/*`];
      // Ask only if Weft does not already hold it. Chrome shows its native
      // dialog for permissions.request whether or not the origin is already
      // granted, so skipping the call is the difference between one click
      // and a prompt the reader has already answered once.
      const held = await api.permissions.contains({ origins }).catch(() => false);
      if (!held) {
        const ok = await api.permissions.request({ origins });
        if (!ok) {
          setMessage('Access was not granted, so this site is unchanged.');
          return;
        }
      }

      const taxed = [...settings.sites.taxed, { pattern: host, enabled: true, escalate: true }];
      const reply = await send({ type: 'request-change', patch: { 'sites.taxed': taxed } });
      if (!reply?.applied) {
        setMessage(reply?.message ?? 'Weft could not add this site.');
        return;
      }

      // Registration is what actually puts the content script on the page,
      // and the open tab predates it, so it needs a reload to pick it up.
      await send({ type: 'reregister-scripts' });
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined) await api.tabs.reload(tab.id);
      window.close();
    } catch (err) {
      setMessage(`The browser refused: ${(err as Error).message}`);
    } finally {
      setAdding(false);
    }
  }

  async function panic() {
    const reply = await send({ type: 'use-panic' });
    setMessage(reply?.message ?? 'Could not reach Weft.');
    if (reply?.granted) {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined) await api.tabs.reload(tab.id);
    }
  }

  return (
    <div class="pop">
      <div class="pop__head">
        <h1 class="pop__title">Weft</h1>
        <span class="pop__lang">{lang.endonym}</span>
      </div>

      {woven.length ? (
        <div class="pop__gloss">
          <GlossStrip pairs={woven} />
        </div>
      ) : null}

      {availability.kind === 'unavailable' ? (
        <Notice tone="warn">{availabilityNote(availability, lang.name)}</Notice>
      ) : null}

      {/*
        A recorded reason outranks the mode, because it describes something
        that went wrong on THIS page rather than how the site is configured.
      */}
      {sample?.reason ? <Notice tone="warn">{sample.reason}</Notice> : null}

      {state.panicActive ? (
        <Notice tone="warn">A panic pass is running. This page is in plain English.</Notice>
      ) : decision.mode === 'excluded' ? (
        <p class="pop__state">
          Weft never touches this page{decision.reason ? `: ${decision.reason}` : '.'}
        </p>
      ) : decision.mode === 'off' ? (
        <>
          <p class="pop__state">
            Nothing is woven here yet.{' '}
            {hostLabel ? (
              <>
                Turn <span class="pop__host">{hostLabel}</span> on and difficulty will climb the
                longer you stay.
              </>
            ) : null}
          </p>
          <div class="pop__actions">
            <button
              type="button"
              data-variant="primary"
              disabled={adding || !hostLabel}
              onClick={() => void addThisSite()}
            >
              {adding ? 'Asking the browser…' : `Weave ${hostLabel || 'this site'}`}
            </button>
            <button
              type="button"
              data-variant="quiet"
              onClick={() => void api.runtime.openOptionsPage()}
            >
              All sites and settings
            </button>
          </div>
        </>
      ) : (
        <>
          <WeaveBand ratio={state.ratio} animate label={`${Math.round(state.ratio * 100)} percent woven`} />
          <p class="pop__state">
            <strong>{oneWordIn(state.ratio)}</strong> you could read is in {lang.name}.
          </p>

          {decision.escalate ? (
            <p class="pop__detail">
              {formatDuration(state.attentionSeconds)} of attention on{' '}
              <span class="pop__host">{decision.attentionKey}</span> today.
              {nextMilestone
                ? ` ${Math.round(nextMilestone.target * 100)}% after another ${formatDuration(
                    nextMilestone.remaining * 60,
                  )}.`
                : ' You have reached the ceiling for this site.'}
            </p>
          ) : (
            <p class="pop__detail">
              A fixed dose here. Difficulty does not climb on this site.
            </p>
          )}

          {state.penaltyActive ? (
            <Notice tone="warn">
              Stored settings failed their integrity check, so difficulty is pinned at the ceiling
              for today.
            </Notice>
          ) : null}
        </>
      )}

      {message ? <Notice>{message}</Notice> : null}

      <div class="pop__actions">
        {(decision.mode === 'taxed' || decision.mode === 'gentle') && !state.panicActive ? (
          <button type="button" onClick={() => void panic()}>
            Plain English for {settings.friction.panicMinutes} min
          </button>
        ) : null}
      </div>

      <nav class="pop__nav">
        <a href={api.runtime.getURL('dashboard.html')} target="_blank" rel="noreferrer">
          Progress
        </a>
        <a
          href={api.runtime.getURL('options.html')}
          onClick={(e) => {
            e.preventDefault();
            void api.runtime.openOptionsPage();
          }}
        >
          Settings
        </a>
      </nav>
    </div>
  );
}

const root = document.getElementById('root');
if (root) render(<Popup />, root);
