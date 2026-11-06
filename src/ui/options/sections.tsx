import type { LetterformId, Pos, Settings } from '../../core/types.ts';
import {
  LETTERFORM_LABELS,
  getLanguage,
  historicalLanguages,
  modernLanguages,
} from '../../core/languages.ts';
import { DIFFICULTY_PRESETS } from '../../core/settings.ts';
import { letterformsFor } from '../../core/letterforms.ts';
import { useEffect, useState } from 'preact/hooks';
import {
  availabilityFor,
  availabilityNote,
  loadPackIndex,
  type PackIndex,
} from '../../shared/packs.ts';
import { Chips, Notice, Row, Section, Slider, Switch, WeaveBand, oneWordIn, percent } from '../components/pieces.tsx';
import type { Controller } from './controller.ts';

/** Sigla used in the margin column. Each one means something. */
export const SIGLA = {
  /** Governed by the cooldown: lowering it will take time. */
  locked: '⊘',
  /** Difficulty. */
  thread: '⁄⁄',
  /** Language. */
  tongue: '¶',
  /** Protected from weaving. */
  shield: '§',
  /** Reveal and display. */
  eye: '◦',
  /** Data. */
  leaf: '†',
} as const;

const LEVELS = [
  { id: '1', label: 'A1 — first words' },
  { id: '2', label: 'A2 — getting by' },
  { id: '3', label: 'B1 — conversational' },
  { id: '4', label: 'B2 — comfortable' },
  { id: '5', label: 'C1 — fluent' },
  { id: '6', label: 'C2 — near-native' },
];

const POS_OPTIONS: Array<{ id: Pos; label: string; title: string }> = [
  { id: 'noun', label: 'nouns', title: 'Concrete nouns are the easiest to recover from context.' },
  { id: 'adj', label: 'adjectives', title: 'Usually guessable from the noun they modify.' },
  { id: 'verb', label: 'verbs', title: 'Woven as infinitives; inflected English forms are skipped.' },
  { id: 'adv', label: 'adverbs', title: 'Often recoverable, sometimes load-bearing.' },
  { id: 'num', label: 'numbers', title: 'Quick wins, and useful everywhere.' },
  { id: 'intj', label: 'greetings', title: 'Hello, please, sorry.' },
  { id: 'det', label: 'articles', title: 'Not recommended: these hold the sentence together.' },
  { id: 'prep', label: 'prepositions', title: 'Not recommended: they carry the grammar.' },
  { id: 'conj', label: 'conjunctions', title: 'Not recommended.' },
  { id: 'pron', label: 'pronouns', title: 'Not recommended.' },
];

export function LanguageSection({ c, settings }: { c: Controller; settings: Settings }) {
  const target = settings.learning.activeTarget;
  const meta = getLanguage(target);
  const forms = letterformsFor(target);
  const [index, setIndex] = useState<PackIndex | null>(null);

  useEffect(() => {
    void loadPackIndex().then(setIndex);
  }, []);

  const source = settings.learning.sourceLang;
  const providers = settings.providers.enabled;

  /**
   * The registry knows more languages than Weft ships lexicons for. Offering
   * one that would silently do nothing is worse than not offering it, so the
   * chips carry their availability and the unavailable ones cannot be chosen.
   */
  const chipsFor = (languages: ReturnType<typeof modernLanguages>) =>
    languages
      // Hidden rather than disabled, matching onboarding. Eight of the
      // fifteen registered languages have no lexicon, so listing them all
      // greyed out made both the first-run screen and this page look
      // mostly broken in exchange for advertising languages nobody can
      // pick. What is missing is said once, below.
      .filter((l) => availabilityFor(index, source, l.code, providers).kind !== 'unavailable')
      .map((l) => ({
        id: l.code,
        label: l.endonym,
        title: `${l.name}${l.era ? `, ${l.era}` : ''}`,
      }));

  /** Registered but unshippable, for the one honest line about them. */
  const notYet = [...modernLanguages(), ...historicalLanguages()].filter(
    (l) => availabilityFor(index, source, l.code, providers).kind === 'unavailable',
  );

  const activeAvailability = availabilityFor(index, source, target, providers);

  return (
    <Section
      siglum={SIGLA.tongue}
      title="Language"
      note="Pick what you are learning. Historical languages behave differently, and better than you might expect: the word Weft puts on the page is often the literal ancestor of the one it replaced."
    >
      {activeAvailability.kind !== 'packed' ? (
        <Notice tone={activeAvailability.kind === 'unavailable' ? 'warn' : 'info'}>
          {availabilityNote(activeAvailability, meta.name)}
        </Notice>
      ) : null}

      <Row siglum={SIGLA.tongue} title="Modern languages">
        <Chips
          multi={false}
          options={chipsFor(modernLanguages())}
          selected={[target]}
          onToggle={(id) => void c.setMany({ 'learning.activeTarget': id, 'learning.targetLangs': [id] })}
        />
      </Row>

      <Row
        siglum={SIGLA.tongue}
        title="Historical languages"
        detail="No speech synthesis exists for these, so the tooltip shows a reconstructed pronunciation instead of offering audio."
      >
        <Chips
          multi={false}
          options={chipsFor(historicalLanguages())}
          selected={[target]}
          onToggle={(id) => void c.setMany({ 'learning.activeTarget': id, 'learning.targetLangs': [id] })}
        />
      </Row>

      {notYet.length ? (
        <Row siglum={SIGLA.tongue} title="Not yet">
          <p class="muted">
            {notYet.map((l) => l.name).join(', ')} are in the registry but have no checked
            lexicon, so they are not offered. Weft will not put a machine gloss on your page and
            call it a language.
          </p>
        </Row>
      ) : null}

      {meta.historical ? (
        <Row
          siglum={SIGLA.thread}
          title="Letterforms"
          detail="Orthography is a difficulty axis of its own. Turning thorn and macrons off makes the same vocabulary far easier to read on day one; turning them on is how you learn to read an edition."
        >
          <div class="stack">
            {forms.map((id: LetterformId) => (
              <Switch
                key={id}
                checked={settings.weave.letterforms[id]}
                label={`${LETTERFORM_LABELS[id].label} — ${LETTERFORM_LABELS[id].detail}`}
                onChange={(next) => void c.set(`weave.letterforms.${id}`, next)}
              />
            ))}
          </div>
        </Row>
      ) : null}

      <Row
        siglum={SIGLA.locked}
        locked
        title="Your level"
        detail="Sets which difficulty band of words you meet. Lowering it is a reduction in difficulty, so it goes through the cooldown."
        value={LEVELS[settings.learning.level - 1]?.label.split(' —')[0] ?? ''}
      >
        <Chips
          multi={false}
          options={LEVELS}
          selected={[String(settings.learning.level)]}
          onToggle={(id) => void c.set('learning.level', Number(id))}
        />
      </Row>

      <Row
        siglum={SIGLA.thread}
        title="Which kinds of word"
        detail="Function words are off by default, and should stay off. Replacing “the” and “of” removes the scaffolding you are using to decode everything else, for almost no vocabulary gained."
      >
        <Chips
          options={POS_OPTIONS}
          selected={settings.learning.posPreference}
          onToggle={(id) => {
            const current = settings.learning.posPreference;
            const next = current.includes(id)
              ? current.filter((p) => p !== id)
              : [...current, id];
            void c.set('learning.posPreference', next.length ? next : current);
          }}
        />
      </Row>

      <Row
        siglum={SIGLA.locked}
        locked
        title="New words per day"
        detail="A cap on how many words Weft introduces to you in a day. Everything you already know keeps appearing regardless."
        value={String(settings.learning.introduceNewPerDay)}
      >
        <Slider
          value={settings.learning.introduceNewPerDay}
          min={0}
          max={60}
          step={1}
          onChange={(v) => void c.set('learning.introduceNewPerDay', v)}
        />
      </Row>

      <Row
        siglum={SIGLA.thread}
        title="Retire words you know"
        detail="Once a word is genuinely learned it stays in the target language permanently and stops counting towards the difficulty budget. It is no longer a demand on you."
      >
        <Switch
          checked={settings.learning.retireKnownWords}
          label={settings.learning.retireKnownWords ? 'Retiring learned words' : 'Never retire'}
          onChange={(next) => void c.set('learning.retireKnownWords', next)}
        />
      </Row>
    </Section>
  );
}

export function DensitySection({ c, settings }: { c: Controller; settings: Settings }) {
  return (
    <Section
      siglum={SIGLA.thread}
      title="Density"
      note="How much of a page is woven, and how fast that rises while you stay on it."
    >
      <Row
        siglum={SIGLA.thread}
        title="Start from a preset"
        detail="Every knob below stays reachable. These are starting points, not modes."
      >
        <Chips
          multi={false}
          options={DIFFICULTY_PRESETS.map((p) => ({ id: p.id, label: p.label, title: p.detail }))}
          selected={[]}
          onToggle={(id) => {
            const preset = DIFFICULTY_PRESETS.find((p) => p.id === id);
            if (preset) void c.setMany(preset.patch);
          }}
        />
      </Row>

      <Row
        siglum={SIGLA.locked}
        locked
        title="Resting density"
        detail="What a page looks like the moment you arrive, before any attention has accumulated."
        value={`${percent(settings.weave.baseRatio)} of content words — ${oneWordIn(settings.weave.baseRatio)}`}
      >
        <WeaveBand ratio={settings.weave.baseRatio} height={20} />
        <Slider
          value={settings.weave.baseRatio}
          min={0}
          max={0.6}
          step={0.01}
          onChange={(v) => void c.set('weave.baseRatio', v)}
          format={percent}
        />
      </Row>

      <Row
        siglum={SIGLA.locked}
        locked
        title="Ceiling"
        detail="The most a page will ever be woven, however long you stay. Difficulty approaches this and never passes it."
        value={`${percent(settings.weave.ceilingRatio)} of content words — ${oneWordIn(settings.weave.ceilingRatio)}`}
      >
        <WeaveBand ratio={settings.weave.ceilingRatio} height={20} />
        <Slider
          value={settings.weave.ceilingRatio}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => void c.set('weave.ceilingRatio', v)}
          format={percent}
        />
      </Row>

      <Row
        siglum={SIGLA.locked}
        locked
        title="The attention tax"
        detail="When this is on, density climbs with the time you actually spend looking at a taxed page. Off, every site holds at its resting density."
      >
        <Switch
          checked={settings.attention.enabled}
          label={settings.attention.enabled ? 'Difficulty climbs with attention' : 'Fixed density everywhere'}
          onChange={(next) => void c.set('attention.enabled', next)}
        />
      </Row>

      <Row
        siglum={SIGLA.locked}
        locked
        title="How fast it bites"
        detail="Density added per minute at the start of a session. The curve flattens as it approaches the ceiling, so this number is the initial slope rather than a constant rate."
        value={`+${percent(settings.attention.gainPerMinute)} per minute`}
      >
        <Slider
          value={settings.attention.gainPerMinute}
          min={0}
          max={0.15}
          step={0.005}
          onChange={(v) => void c.set('attention.gainPerMinute', v)}
          format={(v) => `+${percent(v)}/min`}
        />
      </Row>

      <Row
        siglum={SIGLA.thread}
        title="Recovery while you are away"
        detail="How much accumulated attention drains per hour once you leave. Without this the tax would only ever ratchet upwards."
        value={`${percent(settings.attention.decayPerHourAway)} per hour`}
      >
        <Slider
          value={settings.attention.decayPerHourAway}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => void c.set('attention.decayPerHourAway', v)}
          format={percent}
        />
      </Row>

      <Row
        siglum={SIGLA.locked}
        locked
        title="Spacing"
        detail="Minimum words between two woven words. Wider spacing makes each one easier to decode from its neighbours."
        value={`${settings.weave.minWordGap} words apart`}
      >
        <Slider
          value={settings.weave.minWordGap}
          min={0}
          max={8}
          step={1}
          onChange={(v) => void c.set('weave.minWordGap', v)}
        />
      </Row>

      <Row
        siglum={SIGLA.locked}
        locked
        title="Most per sentence"
        detail="A hard cap, whatever the density says. Three woven words in one sentence is a lesson; six is a wall."
        value={String(settings.weave.maxPerSentence)}
      >
        <Slider
          value={settings.weave.maxPerSentence}
          min={1}
          max={10}
          step={1}
          onChange={(v) => void c.set('weave.maxPerSentence', v)}
        />
      </Row>

      <Row
        siglum={SIGLA.locked}
        locked
        title="Protect short sentences"
        detail="Sentences shorter than this are left alone. A four-word sentence has no spare context to guess from."
        value={`under ${settings.weave.protectShortSentences} words`}
      >
        <Slider
          value={settings.weave.protectShortSentences}
          min={0}
          max={15}
          step={1}
          onChange={(v) => void c.set('weave.protectShortSentences', v)}
        />
      </Row>
    </Section>
  );
}

export function RevealSection({ c, settings }: { c: Controller; settings: Settings }) {
  const meta = getLanguage(settings.learning.activeTarget);
  return (
    <Section
      siglum={SIGLA.eye}
      title="Revealing a word"
      note="What happens when you want the English back."
    >
      <Row siglum={SIGLA.eye} title="Reveal on">
        <Chips
          multi={false}
          options={[
            { id: 'hover', label: 'hover' },
            { id: 'click', label: 'click' },
            { id: 'both', label: 'hover or click' },
          ]}
          selected={[settings.reveal.trigger]}
          onToggle={(id) => void c.set('reveal.trigger', id)}
        />
      </Row>

      <Row
        siglum={SIGLA.eye}
        title="Hover delay"
        detail="A short delay stops the tooltip flickering open as the pointer crosses the page. A longer one makes you try to read the word first."
        value={`${settings.reveal.hoverDelayMs} ms`}
      >
        <Slider
          value={settings.reveal.hoverDelayMs}
          min={0}
          max={1500}
          step={20}
          onChange={(v) => void c.set('reveal.hoverDelayMs', v)}
          format={(v) => `${v} ms`}
        />
      </Row>

      <Row siglum={SIGLA.eye} title="Show in the tooltip">
        <div class="stack">
          <Switch
            checked={settings.reveal.showPos}
            label="Part of speech"
            onChange={(v) => void c.set('reveal.showPos', v)}
          />
          <Switch
            checked={settings.reveal.showGender}
            label="Grammatical gender"
            onChange={(v) => void c.set('reveal.showGender', v)}
          />
          <Switch
            checked={settings.reveal.showIpa}
            label={
              meta.ttsLang
                ? 'Pronunciation, in IPA'
                : `Pronunciation, in IPA — the only option for ${meta.name}, which has no voice`
            }
            onChange={(v) => void c.set('reveal.showIpa', v)}
          />
          <Switch
            checked={settings.reveal.showEtymon}
            label="Where your English word came from"
            onChange={(v) => void c.set('reveal.showEtymon', v)}
          />
          <Switch
            checked={settings.reveal.showBand}
            label="Difficulty band"
            onChange={(v) => void c.set('reveal.showBand', v)}
          />
        </div>
      </Row>

      <Row
        siglum={SIGLA.eye}
        title="Speak the word"
        detail={
          meta.ttsLang
            ? 'Uses your system voices. Nothing is sent anywhere.'
            : `${meta.name} has no speech voice on any platform, so this does nothing while it is your target language.`
        }
      >
        <Switch
          checked={settings.reveal.tts}
          label={settings.reveal.tts ? 'Offer audio' : 'No audio'}
          onChange={(v) => void c.set('reveal.tts', v)}
          disabled={!meta.ttsLang}
        />
      </Row>

      <Row
        siglum={SIGLA.eye}
        title="Grading"
        detail="Whether the tooltip asks how well you knew the word. Your answers drive which words appear next; without them Weft infers from whether you needed to reveal it at all."
      >
        <Chips
          multi={false}
          options={[
            { id: 'auto', label: 'infer it', title: 'A reveal counts as not knowing the word.' },
            { id: 'manual', label: 'ask me', title: 'Show “I knew it” and “Not sure” buttons.' },
            { id: 'off', label: 'never ask' },
          ]}
          selected={[settings.reveal.grading]}
          onToggle={(id) => void c.set('reveal.grading', id)}
        />
      </Row>
    </Section>
  );
}

export function AccessibilitySection({ c, settings }: { c: Controller; settings: Settings }) {
  return (
    <Section
      siglum={SIGLA.eye}
      title="Accessibility and rendering"
      note="How the woven words are put on the page. This is a real trade-off, not a preference: the two modes are good at different things."
    >
      <Row
        siglum={SIGLA.eye}
        title="Rendering"
        detail="Ranges change no page structure, so nothing can break — but the words carry no language tag and cannot be focused. Elements can be read aloud in the right language and reached with Tab, at the cost of altering the page's structure, which a few web applications dislike."
      >
        <Chips
          multi={false}
          options={[
            { id: 'auto', label: 'decide per page', title: 'Prefers the safe mode; wraps only where nothing suggests a framework.' },
            { id: 'highlight', label: 'styled ranges', title: 'No DOM changes at all.' },
            { id: 'wrapped', label: 'wrapped elements', title: 'Carries lang and is keyboard reachable.' },
          ]}
          selected={[settings.weave.renderMode]}
          onToggle={(id) => void c.set('weave.renderMode', id)}
        />
      </Row>

      <Row
        siglum={SIGLA.eye}
        title="Always wrap, for a screen reader"
        detail="Forces wrapped rendering everywhere, so each woven word carries a lang attribute and your screen reader pronounces it in the right language rather than reading French as mangled English."
      >
        <Switch
          checked={settings.a11y.preferWrappedForAT}
          label={settings.a11y.preferWrappedForAT ? 'Wrapping everywhere' : 'Decide per page'}
          onChange={(v) => void c.set('a11y.preferWrappedForAT', v)}
        />
      </Row>

      <Row siglum={SIGLA.eye} title="Keyboard reading">
        <Switch
          checked={settings.a11y.keyboardCursor}
          label="Woven words are reachable with Tab, and Alt-Shift-N steps through them"
          onChange={(v) => void c.set('a11y.keyboardCursor', v)}
        />
      </Row>

      <Row siglum={SIGLA.eye} title="Higher contrast">
        <Switch
          checked={settings.a11y.highContrast}
          label="Stronger tint and a solid underline"
          onChange={(v) => void c.set('a11y.highContrast', v)}
        />
      </Row>

      <Row
        siglum={SIGLA.eye}
        title="Tooltip text size"
        value={`${settings.a11y.minTooltipFontPx} px`}
      >
        <Slider
          value={settings.a11y.minTooltipFontPx}
          min={11}
          max={24}
          step={1}
          onChange={(v) => void c.set('a11y.minTooltipFontPx', v)}
          format={(v) => `${v} px`}
        />
      </Row>

      <Row siglum={SIGLA.eye} title="Underline style">
        <Chips
          multi={false}
          options={[
            { id: 'dotted', label: 'dotted' },
            { id: 'dashed', label: 'dashed' },
            { id: 'solid', label: 'solid' },
            { id: 'none', label: 'none' },
          ]}
          selected={[settings.weave.style.underline]}
          onToggle={(id) => void c.set('weave.style.underline', id)}
        />
      </Row>

      <Row siglum={SIGLA.eye} title="Accent colour" detail="Used for the underline and the tint behind a woven word.">
        <div class="inline">
          <input
            type="text"
            value={settings.weave.style.tint}
            aria-label="Accent colour, as a hex value"
            style={{ maxWidth: '8rem' }}
            onChange={(e) => {
              const value = (e.currentTarget as HTMLInputElement).value.trim();
              if (/^#[0-9a-f]{6}$/i.test(value)) void c.set('weave.style.tint', value);
            }}
          />
          <span
            aria-hidden="true"
            style={{
              width: '1.4rem',
              height: '1.4rem',
              borderRadius: '2px',
              background: settings.weave.style.tint,
              border: '1px solid var(--thread)',
            }}
          />
        </div>
      </Row>
    </Section>
  );
}
