import { useState } from 'preact/hooks';
import { send } from '../../shared/rpc.ts';
import type { QuizQuestion, QuizResult } from '../../core/quiz.ts';
import { gradeAnswer } from '../../core/quiz.ts';
import { Notice } from '../components/pieces.tsx';

/**
 * The unlock check.
 *
 * Drawn only from words the learner has already been shown, so it is never a
 * test of unseen material — it is a check that the exposure did something.
 * Answers are graded locally and sent as review results whether or not the
 * gate opens, because the retrieval practice is worth more than the setting
 * being unlocked.
 */
export function Quiz({
  changeId,
  summary,
  onPassed,
  onClose,
}: {
  changeId: string;
  summary: string;
  onPassed(): void;
  onClose(): void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState<QuizResult[]>([]);
  const [verdict, setVerdict] = useState<{ passed: boolean; message: string } | null>(null);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

  async function begin() {
    const reply = await send({ type: 'build-quiz', changeId });
    if (!reply || reply.error || !reply.questions.length) {
      setError(reply?.error ?? 'Could not build a check right now.');
      return;
    }
    setQuestions(reply.questions);
    setIndex(0);
    setResults([]);
    setVerdict(null);
  }

  async function submit(given: string) {
    if (!questions) return;
    const question = questions[index];
    if (!question) return;
    const correct = gradeAnswer(question, given);
    const next = [...results, { questionId: question.id, lemma: question.lemma, correct, given }];
    setResults(next);
    setLastCorrect(correct);
    setAnswer('');

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }

    const reply = await send({ type: 'submit-quiz', changeId, results: next });
    if (!reply) {
      setError('Could not submit the check.');
      return;
    }
    setVerdict({ passed: reply.passed, message: reply.message });
    if (reply.passed) onPassed();
  }

  if (verdict) {
    return (
      <div class="quiz">
        <Notice tone={verdict.passed ? 'info' : 'warn'}>{verdict.message}</Notice>
        <div class="inline">
          {!verdict.passed ? (
            <button type="button" data-variant="primary" onClick={() => void begin()}>
              Try again
            </button>
          ) : null}
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="quiz">
        <Notice tone="warn">{error}</Notice>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  if (!questions) {
    return (
      <div class="quiz">
        <p>
          To unlock <em>{summary}</em>, answer a short check on words Weft has already shown you.
          Nothing here will be new.
        </p>
        <div class="inline">
          <button type="button" data-variant="primary" onClick={() => void begin()}>
            Start the check
          </button>
          <button type="button" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  const question = questions[index];
  if (!question) return null;

  return (
    <div class="quiz">
      <p class="quiz__progress muted">
        {index + 1} of {questions.length}
        {lastCorrect === null ? '' : lastCorrect ? ' — last answer right' : ' — last answer wrong'}
      </p>

      <p class="quiz__prompt" lang={question.promptLang}>
        {question.prompt}
      </p>
      <p class="quiz__ask muted">
        {question.kind === 'target-to-source'
          ? 'What does this mean?'
          : question.kind === 'source-to-target'
            ? 'Which is the translation?'
            : 'Type the translation.'}
        {question.hint ? ` ${question.hint}.` : ''}
      </p>

      {question.options ? (
        <div class="quiz__options">
          {question.options.map((option) => (
            <button key={option} type="button" onClick={() => void submit(option)} lang={question.answerLang}>
              {option}
            </button>
          ))}
        </div>
      ) : (
        <form
          class="inline"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(answer);
          }}
        >
          <input
            type="text"
            value={answer}
            autoFocus
            autocomplete="off"
            spellcheck={false}
            lang={question.answerLang}
            onInput={(e) => setAnswer((e.currentTarget as HTMLInputElement).value)}
            aria-label="Your answer"
          />
          <button type="submit" data-variant="primary">
            Answer
          </button>
        </form>
      )}

      <button type="button" data-variant="quiet" onClick={() => void submit('')}>
        Skip this word
      </button>
    </div>
  );
}
