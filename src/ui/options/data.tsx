import { useRef, useState } from 'preact/hooks';
import type { Settings } from '../../core/types.ts';
import { getLanguage } from '../../core/languages.ts';
import { send } from '../../shared/rpc.ts';
import { exportFilename } from '../../core/escalation.ts';
import { has } from '../../core/entitlements.ts';
import { Locked } from './pro.tsx';
import { Notice, Row, Section, Slider, Switch } from '../components/pieces.tsx';
import type { Controller } from './controller.ts';
import { SIGLA } from './sections.tsx';

/**
 * Vocabulary sources and your data.
 *
 * The packs Weft ships cover a curated core and need no network. A provider
 * extends that to anything, and the privacy story is the reason it can be
 * offered at all: a provider receives isolated words and a part-of-speech
 * hint, never page text. There is no parameter in the interface to put a
 * paragraph in, and the never-send host list is enforced in the background
 * worker rather than in the page.
 */
export function SourcesSection({ c, settings }: { c: Controller; settings: Settings }) {
  const meta = getLanguage(settings.learning.activeTarget);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const keyField = (
    id: 'deepl' | 'google' | 'openai',
    label: string,
    path: string,
    value: string,
    note: string,
  ) => (
    <Row siglum={SIGLA.leaf} title={label} detail={note}>
      <div class="inline">
        <input
          type={reveal[id] ? 'text' : 'password'}
          value={value}
          spellcheck={false}
          autocomplete="off"
          placeholder="not set"
          aria-label={`${label} key`}
          onChange={(e) => void c.set(path, (e.currentTarget as HTMLInputElement).value.trim())}
        />
        <button type="button" data-variant="quiet" onClick={() => setReveal({ ...reveal, [id]: !reveal[id] })}>
          {reveal[id] ? 'Hide' : 'Show'}
        </button>
      </div>
    </Row>
  );

  return (
    <Section
      siglum={SIGLA.leaf}
      title="Vocabulary beyond the packs"
      note="Weft ships a checked core lexicon for every language it supports, and works entirely offline with it. A translation service extends that to any word, using a key you provide."
    >
      <Row
        siglum={SIGLA.leaf}
        title="Use a translation service"
        detail="Off by default. When on, Weft looks up the most frequent words on a page that its packs do not contain, caches each answer, and prefers a checked gloss over a machine one wherever both exist."
      >
        {has(c.tier, 'providers') ? (
          <Switch
            checked={settings.providers.enabled}
            label={settings.providers.enabled ? 'Looking up unknown words' : 'Packs only, fully offline'}
            onChange={(v) => void c.set('providers.enabled', v)}
          />
        ) : (
          <Locked feature="providers" />
        )}
      </Row>

      {settings.providers.enabled ? (
        <>
          <Notice>
            Weft sends single words and a part-of-speech hint. It does not send the page, the
            sentence, the URL or anything identifying. Words from the never-weave list are never
            sent at all.
          </Notice>

          {keyField(
            'deepl',
            'DeepL key',
            'providers.deepl.key',
            settings.providers.deepl.key,
            'The best quality for the languages it covers. It has no Latin or Old English.',
          )}
          <Row siglum={SIGLA.leaf} title="DeepL plan">
            <Switch
              checked={settings.providers.deepl.free}
              label={settings.providers.deepl.free ? 'Free tier endpoint' : 'Pro endpoint'}
              onChange={(v) => void c.set('providers.deepl.free', v)}
            />
          </Row>

          {keyField(
            'google',
            'Google Cloud Translation key',
            'providers.google.key',
            settings.providers.google.key,
            'The widest language coverage, used as a fallback.',
          )}

          {keyField(
            'openai',
            'OpenAI-compatible key',
            'providers.openai.key',
            settings.providers.openai.key,
            `The only one that can answer for ${meta.historical ? meta.name : 'Latin and Old English'}, and the only one that returns grammatical gender. Any compatible endpoint works.`,
          )}
          <Row siglum={SIGLA.leaf} title="Endpoint and model">
            <div class="stack">
              <input
                type="url"
                value={settings.providers.openai.baseUrl}
                spellcheck={false}
                aria-label="Base URL"
                onChange={(e) =>
                  void c.set('providers.openai.baseUrl', (e.currentTarget as HTMLInputElement).value.trim())
                }
              />
              <input
                type="text"
                value={settings.providers.openai.model}
                spellcheck={false}
                aria-label="Model"
                onChange={(e) =>
                  void c.set('providers.openai.model', (e.currentTarget as HTMLInputElement).value.trim())
                }
              />
            </div>
          </Row>

          <Row
            siglum={SIGLA.shield}
            title="Send the surrounding sentence"
            detail="Improves accuracy for words with several meanings, and means a sentence of whatever you are reading leaves your machine. Off by default, and a deliberate choice rather than a default you can be talked out of."
          >
            <Switch
              checked={settings.providers.sendContext}
              label={
                settings.providers.sendContext
                  ? 'Sending one sentence of context'
                  : 'Single words only'
              }
              onChange={(v) => void c.set('providers.sendContext', v)}
            />
          </Row>

          <Row
            siglum={SIGLA.leaf}
            title="Keep answers for"
            detail="A word is only ever sent once. Longer caching means fewer calls and a smaller bill."
            value={`${settings.providers.cacheDays} days`}
          >
            <Slider
              value={settings.providers.cacheDays}
              min={1}
              max={365}
              step={1}
              onChange={(v) => void c.set('providers.cacheDays', v)}
              format={(v) => `${v} days`}
            />
          </Row>

          <Row
            siglum={SIGLA.leaf}
            title="Daily lookup limit"
            detail="A ceiling on the words sent each day, so a runaway page cannot drain your key."
            value={String(settings.providers.dailyLookupCap)}
          >
            <Slider
              value={settings.providers.dailyLookupCap}
              min={0}
              max={20000}
              step={100}
              onChange={(v) => void c.set('providers.dailyLookupCap', v)}
            />
          </Row>
        </>
      ) : null}

      <DataRow />
    </Section>
  );
}

function DataRow() {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  async function exportData() {
    const reply = await send({ type: 'export-data' });
    if (!reply) {
      setMessage('Could not read your data.');
      return;
    }
    const blob = new Blob([JSON.stringify(reply.payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFilename(Date.now());
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(
      'Exported. The file contains your settings, vocabulary and reading history, and no keys.',
    );
  }

  async function importData(file: File) {
    try {
      const payload = JSON.parse(await file.text());
      const reply = await send({ type: 'import-data', payload });
      setMessage(reply?.message ?? 'Could not import that file.');
    } catch {
      setMessage('That file is not valid JSON.');
    }
  }

  return (
    <Row
      siglum={SIGLA.leaf}
      title="Your data"
      detail="Everything Weft knows lives on this machine. Nothing is uploaded, there is no account, and there is no telemetry — the setting for it does not exist rather than defaulting to off."
    >
      <div class="stack">
        <div class="inline">
          <button type="button" onClick={() => void exportData()}>
            Export everything
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Import a file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            class="sr-only"
            onChange={(e) => {
              const file = (e.currentTarget as HTMLInputElement).files?.[0];
              if (file) void importData(file);
            }}
          />
        </div>

        <div class="inline">
          {confirmReset ? (
            <>
              <span class="muted">This erases every word Weft has learned about you.</span>
              <button
                type="button"
                data-variant="danger"
                onClick={async () => {
                  await send({ type: 'reset-vocabulary', confirm: 'yes' });
                  setConfirmReset(false);
                  setMessage('Vocabulary cleared. Your settings are untouched.');
                }}
              >
                Erase it
              </button>
              <button type="button" data-variant="quiet" onClick={() => setConfirmReset(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button type="button" data-variant="quiet" onClick={() => setConfirmReset(true)}>
              Start my vocabulary over
            </button>
          )}
        </div>

        {message ? <Notice>{message}</Notice> : null}
      </div>
    </Row>
  );
}
