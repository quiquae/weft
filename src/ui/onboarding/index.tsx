import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { LexPack, Settings } from '../../core/types.ts';
import { getLanguage, historicalLanguages, modernLanguages } from '../../core/languages.ts';
import { DIFFICULTY_PRESETS, defaultSettings } from '../../core/settings.ts';
import { SITE_PRESETS, originsForRules, rulesFromPreset } from '../../core/sites.ts';
import { applyPatch } from '../../core/patch.ts';
import { api } from '../../shared/browser.ts';
import { send } from '../../shared/rpc.ts';
import { availabilityFor, availabilityNote, loadPackIndex, type PackIndex } from '../../shared/packs.ts';
import { Notice, WeaveBand, oneWordIn } from '../components/pieces.tsx';
import { Preview } from './preview.tsx';

/**
 * First run.
 *
 * Three questions, one at a time, each with a visible consequence. The
 * density step runs the real engine on a real paragraph, because nobody can
 * choose between "6%" and "35%" as numbers.
 *
 * The site step is also where host access is granted, which is the one thing
 * that cannot be done anywhere else: Chrome only allows a permission request
 * from a user gesture on an extension page.
 */

type Step = 'language' | 'density' | 'sites' | 'done';

function Onboarding() {
  const [step, setStep] = useState<Step>('language');
  const [settings, setSettings] = useState<Settings>(() => defaultSettings(Date.now(), 'pending'));
  const [presetId, setPresetId] = useState('standard');
  const [chosenSites, setChosenSites] = useState<string[]>(['social']);
  const [pack, setPack] = useState<LexPack | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [granted, setGranted] = useState(false);
  const [index, setIndex] = useState<PackIndex | null>(null);

  useEffect(() => {
    void loadPackIndex().then(setIndex);
  }, []);

  const target = settings.learning.activeTarget;
  const lang = getLanguage(target);

  useEffect(() => {
    setPack(null);
    void send({ type: 'get-pack', source: 'en', target }).then((reply) => {
      if (reply?.pack) setPack(reply.pack);
    });
  }, [target]);

  function chooseLanguage(code: string) {
    setSettings(
      applyPatch(settings, {
        'learning.activeTarget': code,
        'learning.targetLangs': [code],
      }),
    );
  }

  function choosePreset(id: string) {
    const preset = DIFFICULTY_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setSettings(applyPatch(settings, preset.patch));
  }

  const rules = chosenSites.flatMap((id) => rulesFromPreset(id).taxed.concat(rulesFromPreset(id).gentle));
  const origins = originsForRules(rules);

  async function finish() {
    if (origins.length) {
      try {
        const ok = await api.permissions.request({ origins });
        setGranted(ok);
        if (!ok) {
          setMessage(
            'Access was not granted, so nothing will be woven yet. You can grant it later in settings.',
          );
        }
      } catch (err) {
        setMessage(`Chrome refused the request: ${(err as Error).message}`);
      }
    }

    const taxed = chosenSites.flatMap((id) => rulesFromPreset(id).taxed);
    const gentle = chosenSites.flatMap((id) => rulesFromPreset(id).gentle);
    const preset = DIFFICULTY_PRESETS.find((p) => p.id === presetId);

    await send({
      type: 'complete-onboarding',
      patch: {
        ...(preset?.patch ?? {}),
        'learning.activeTarget': target,
        'learning.targetLangs': [target],
        'sites.taxed': taxed,
        'sites.gentle': gentle,
      },
      origins,
    });
    setStep('done');
  }

  return (
    <main class="page onboard">
      <header class="masthead">
        <h1 class="masthead__title">Weft</h1>
        <p class="masthead__line">
          Some of the words on the pages you read will be in another language. The longer you stay
          on a page, the more of them there will be.
        </p>
      </header>

      {step === 'language' ? (
        <section class="step">
          <h2 class="step__q">What are you learning?</h2>

          <div class="step__group">
            <p class="step__hint">Modern languages</p>
            <div class="chips">
              {modernLanguages().map((l) => {
                const availability = availabilityFor(index, 'en', l.code, false);
                const off = availability.kind === 'unavailable';
                return (
                  <button
                    key={l.code}
                    type="button"
                    class="chip"
                    data-on={target === l.code ? '1' : undefined}
                    disabled={off}
                    title={`${l.name}. ${availabilityNote(availability, l.name)}`}
                    onClick={() => chooseLanguage(l.code)}
                  >
                    {off ? `${l.endonym} — no lexicon` : l.endonym}
                  </button>
                );
              })}
            </div>
          </div>

          <div class="step__group">
            <p class="step__hint">Historical languages</p>
            <div class="chips">
              {historicalLanguages().map((l) => {
                const availability = availabilityFor(index, 'en', l.code, false);
                const off = availability.kind === 'unavailable';
                return (
                  <button
                    key={l.code}
                    type="button"
                    class="chip"
                    data-on={target === l.code ? '1' : undefined}
                    disabled={off}
                    title={`${l.name}, ${l.era ?? ''}. ${availabilityNote(availability, l.name)}`}
                    onClick={() => chooseLanguage(l.code)}
                  >
                    {off ? `${l.endonym} — no lexicon` : l.endonym}
                  </button>
                );
              })}
            </div>
            <p class="step__aside">
              These work better than you would guess. In Old English the word Weft puts on the page
              is usually the literal ancestor of the one it replaced — <em>hūs</em> for house,{' '}
              <em>stān</em> for stone, <em>cyning</em> for king — and the tooltip tells you so. In
              Latin it is the word your English borrowed from: <em>vacca</em> gave us vaccine.
            </p>
          </div>

          <p class="step__chosen">
            {lang.name}
            {lang.era ? `, ${lang.era}. ` : '. '}
            {lang.historical
              ? `No speech synthesis exists for ${lang.name}, so Weft shows a reconstructed pronunciation instead.`
              : 'Weft ships a checked core lexicon and needs no network.'}
          </p>

          <button type="button" data-variant="primary" onClick={() => setStep('density')}>
            Next
          </button>
        </section>
      ) : null}

      {step === 'density' ? (
        <section class="step">
          <h2 class="step__q">How much of a page?</h2>

          <div class="chips step__group">
            {DIFFICULTY_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                class="chip"
                data-on={presetId === p.id ? '1' : undefined}
                onClick={() => choosePreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <p class="step__aside">{DIFFICULTY_PRESETS.find((p) => p.id === presetId)?.detail}</p>

          <div class="step__group">
            <p class="step__hint">
              At rest — {oneWordIn(settings.weave.baseRatio)} of the words Weft knows
            </p>
            <WeaveBand ratio={settings.weave.baseRatio} height={20} />
            <Preview pack={pack} settings={settings} ratio={settings.weave.baseRatio} />
          </div>

          <div class="step__group">
            <p class="step__hint">
              After a long scroll — {oneWordIn(settings.weave.ceilingRatio)}
            </p>
            <WeaveBand ratio={settings.weave.ceilingRatio} height={20} />
            <Preview pack={pack} settings={settings} ratio={settings.weave.ceilingRatio} />
          </div>

          <div class="inline">
            <button type="button" onClick={() => setStep('language')}>
              Back
            </button>
            <button type="button" data-variant="primary" onClick={() => setStep('sites')}>
              Next
            </button>
          </div>
        </section>
      ) : null}

      {step === 'sites' ? (
        <section class="step">
          <h2 class="step__q">Which sites should cost you something?</h2>

          <div class="step__group step__sites">
            {SITE_PRESETS.map((preset) => {
              const on = chosenSites.includes(preset.id);
              return (
                <label key={preset.id} class="switch step__site">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setChosenSites(
                        on
                          ? chosenSites.filter((id) => id !== preset.id)
                          : [...chosenSites, preset.id],
                      )
                    }
                  />
                  <span class="switch__track" />
                  <span>
                    <strong>{preset.label}</strong>
                    <span class="step__siteDetail">{preset.detail}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <p class="step__aside">
            Weft has no access to any website until you say yes to the browser prompt on the next
            click. It only ever asks for the sites you chose here — that is why it installs without
            the warning about reading all your data.
          </p>

          <Notice>
            Money, mail, credentials and health sites are never woven, whatever you pick. That list
            ships with Weft and is checked before anything else.
          </Notice>

          {message ? <Notice tone="warn">{message}</Notice> : null}

          <div class="inline">
            <button type="button" onClick={() => setStep('density')}>
              Back
            </button>
            <button
              type="button"
              data-variant="primary"
              disabled={!chosenSites.length}
              onClick={() => void finish()}
            >
              {chosenSites.length
                ? `Grant access to ${chosenSites.length} ${chosenSites.length === 1 ? 'set' : 'sets'} and start`
                : 'Pick at least one'}
            </button>
          </div>
        </section>
      ) : null}

      {step === 'done' ? (
        <section class="step">
          <h2 class="step__q">Ready.</h2>
          <p>
            Open one of the sites you chose and read for a minute. Words will start appearing in{' '}
            {lang.name}. Hover one to see the English back.
          </p>
          {!granted && origins.length ? (
            <Notice tone="warn">
              Site access was not granted, so nothing is woven yet. Open settings to grant it.
            </Notice>
          ) : null}
          <p class="muted">
            Two things worth knowing now. Anything that makes Weft easier waits out a cooldown, so
            set that to something you can live with. And there is a panic pass in the toolbar menu
            for the moment you genuinely need plain English.
          </p>
          <div class="inline">
            <button
              type="button"
              data-variant="primary"
              onClick={() => void api.runtime.openOptionsPage()}
            >
              Open settings
            </button>
            <a class="button" href={api.runtime.getURL('dashboard.html')}>
              See progress
            </a>
          </div>
        </section>
      ) : null}

      <ol class="progress" aria-label="Setup progress">
        {(['language', 'density', 'sites'] as Step[]).map((s, i) => (
          <li key={s} data-done={['language', 'density', 'sites'].indexOf(step) >= i ? '1' : undefined}>
            {['Language', 'Density', 'Sites'][i]}
          </li>
        ))}
      </ol>
    </main>
  );
}

const root = document.getElementById('root');
if (root) render(<Onboarding />, root);
