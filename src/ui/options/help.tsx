import { useState } from 'preact/hooks';
import { api } from '../../shared/browser.ts';
import { send } from '../../shared/rpc.ts';
import { buildDiagnostics } from '../../core/diagnostics.ts';
import { SUPPORT_URL } from '../../core/pricing.ts';
import { SIGLA } from './sections.tsx';
import { Notice, Row, Section } from '../components/pieces.tsx';
import type { Controller } from './controller.ts';

/**
 * Getting help, and giving enough information to be helped.
 *
 * Every store requires a support URL, and every support conversation opens
 * with "what version, which browser, what were you doing". Asking a reader
 * to find that out is how you collect bug reports nobody can act on — and
 * how you lose the ones from people who reasonably cannot be bothered.
 *
 * So Weft assembles it. What it must not do is *send* it: the dashboard
 * tells this reader that nothing has ever left their machine, and a support
 * form that quietly posts a diagnostic bundle would make that a lie. The
 * report is built locally, shown in full before it is copied, and goes
 * nowhere unless the reader pastes it somewhere themselves.
 *
 * Shown in full, specifically. A collapsed "diagnostic data will be
 * included" is how people end up sending things they did not mean to; the
 * text is right there to read first.
 */
export function HelpSection({ c }: { c: Controller }) {
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function gather() {
    setError(null);
    setCopied(false);
    try {
      const [stats, lock] = await Promise.all([
        send({ type: 'get-stats' }),
        send({ type: 'get-lock-state' }),
      ]);
      if (!stats) {
        setError('Weft could not reach its background worker, so there is nothing to report yet.');
        return;
      }
      setReport(
        buildDiagnostics({
          version: __WEFT_VERSION__,
          engine: __WEFT_TARGET__,
          userAgent: navigator.userAgent,
          settings: stats.settings,
          cards: stats.cards,
          tier: stats.tier,
          networkRequests: stats.network?.requests ?? 0,
          tamperCount: stats.lock?.tamperCount ?? 0,
          pendingChanges: lock?.lock?.pending?.length ?? 0,
        }),
      );
    } catch (err) {
      setError(`Could not gather the details: ${(err as Error).message}`);
    }
  }

  async function copy() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch {
      // Clipboard permission can be refused. The text is already on screen
      // and selectable, so say that rather than failing silently.
      setError('The browser refused clipboard access. Select the text above and copy it.');
    }
  }

  return (
    <Section
      siglum={SIGLA.leaf}
      title="Help"
      note="Something wrong, or something missing? This is how to say so."
    >
      <Row siglum={SIGLA.leaf} title="Report a problem">
        <p class="muted">
          Bug reports are far easier to act on with the version and browser attached. Weft can
          assemble that for you — counts and settings only, never which sites you read, which words
          you know, or any key you have entered.
        </p>
        <div class="help__actions">
          <button type="button" onClick={() => void gather()}>
            {report ? 'Rebuild the details' : 'Gather the details'}
          </button>
          <a class="button" href={SUPPORT_URL} target="_blank" rel="noreferrer">
            Open the support page
          </a>
        </div>

        {report ? (
          <>
            <p class="muted">
              Read it before you send it. Nothing has been transmitted — this text exists only on
              this page until you copy it.
            </p>
            <pre class="help__report" tabIndex={0} aria-label="Diagnostic details">
              {report}
            </pre>
            <div class="help__actions">
              <button type="button" data-variant="primary" onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy to clipboard'}
              </button>
            </div>
          </>
        ) : null}

        {error ? <Notice tone="warn">{error}</Notice> : null}
      </Row>

      <Row siglum={SIGLA.leaf} title="If a page is not being woven">
        <p class="muted">
          Open the Weft button on that page. It says what is happening there and why — the site not
          being on your list, a panic pass running, the page already being in the language you are
          learning, or the word list failing to load. It is quicker than guessing.
        </p>
        <div class="help__actions">
          <a class="button" href={api.runtime.getURL('dashboard.html')}>
            See your progress
          </a>
        </div>
      </Row>

      <Row siglum={SIGLA.leaf} title="Version">
        <p class="muted">
          Weft {__WEFT_VERSION__}, {__WEFT_TARGET__} build, {c.tier === 'pro' ? 'Pro' : 'Free'}.
        </p>
      </Row>
    </Section>
  );
}
