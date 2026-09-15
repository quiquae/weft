import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { api } from '../../shared/browser.ts';
import { send } from '../../shared/rpc.ts';
import type { PageState } from '../../shared/messages.ts';
import { formatDuration, minutesToRatio } from '../../core/escalation.ts';
import { getLanguage } from '../../core/languages.ts';
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
}

function Popup() {
  const [state, setState] = useState<PageState | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [tab] = await api.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url ?? '';
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

      {state.panicActive ? (
        <Notice tone="warn">A panic pass is running. This page is in plain English.</Notice>
      ) : decision.mode === 'excluded' ? (
        <p class="pop__state">
          Weft never touches this page{decision.reason ? `: ${decision.reason}` : '.'}
        </p>
      ) : decision.mode === 'off' ? (
        <>
          <p class="pop__state">This site is not on your list, so nothing is woven here.</p>
          <button
            type="button"
            data-variant="quiet"
            onClick={() => void api.runtime.openOptionsPage()}
          >
            Add it in settings
          </button>
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
        {decision.mode !== 'excluded' && !state.panicActive ? (
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
