import { render } from 'preact';
import { useState } from 'preact/hooks';
import { api } from '../../shared/browser.ts';
import { useNow } from '../lib/hooks.ts';
import { Notice } from '../components/pieces.tsx';
import { useController } from './controller.ts';
import {
  AccessibilitySection,
  DensitySection,
  LanguageSection,
  RevealSection,
} from './sections.tsx';
import { SitesSection } from './sites.tsx';
import { CommitmentSection, PendingPanel } from './commitment.tsx';
import { SourcesSection } from './data.tsx';
import { Quiz } from './quiz.tsx';

function Options() {
  const c = useController();
  const now = useNow(1000);
  const [quiz, setQuiz] = useState<{ id: string; summary: string } | null>(null);

  if (c.loading) {
    return (
      <main class="page">
        <p class="muted">Reading your settings…</p>
      </main>
    );
  }

  if (!c.settings) {
    return (
      <main class="page">
        <h1>Weft</h1>
        <Notice tone="warn">
          Weft could not reach its background worker. Reload this page; if it keeps happening,
          disable and re-enable the extension.
        </Notice>
      </main>
    );
  }

  const settings = c.settings;

  return (
    <main class="page">
      <header class="masthead">
        <h1 class="masthead__title">Weft</h1>
        <p class="masthead__line">
          Some of the words on the pages you read are in another language. The longer you stay, the
          more of them there are.
        </p>
      </header>

      <PendingPanel c={c} now={now} onQuiz={(id, summary) => setQuiz({ id, summary })} />

      {quiz ? (
        <div class="quiz-host">
          <Quiz
            changeId={quiz.id}
            summary={quiz.summary}
            onPassed={() => void c.reload()}
            onClose={() => {
              setQuiz(null);
              void c.reload();
            }}
          />
        </div>
      ) : null}

      {c.message ? (
        <div class="flash" role="status">
          <span>{c.message}</span>
          <button type="button" data-variant="quiet" onClick={c.clearMessage}>
            Dismiss
          </button>
        </div>
      ) : null}

      <LanguageSection c={c} settings={settings} />
      <DensitySection c={c} settings={settings} />
      <SitesSection c={c} settings={settings} />
      <CommitmentSection c={c} settings={settings} />
      <RevealSection c={c} settings={settings} />
      <AccessibilitySection c={c} settings={settings} />
      <SourcesSection c={c} settings={settings} />

      <footer class="colophon">
        <p>
          Weft {__WEFT_VERSION__}. Lexicons for Latin and Old English are checked against Lewis &amp;
          Short and Bosworth–Toller, both public domain; frequency bands derive from SUBTLEX by way
          of the wordfreq project. <a href={api.runtime.getURL('dashboard.html')}>See your progress</a>.
        </p>
      </footer>
    </main>
  );
}

const root = document.getElementById('root');
if (root) render(<Options />, root);
