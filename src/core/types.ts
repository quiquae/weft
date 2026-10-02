/**
 * Weft core types.
 *
 * Everything in src/core/ is pure: no DOM, no chrome.* APIs, no I/O. That is
 * what makes the interesting logic (which word to swap, how hard it should get,
 * whether a settings change is allowed yet) unit-testable without a browser.
 */

/** Language identifier. Modern languages use ISO 639-1; historical use 639-3. */
export type LangCode = string;

export type Pos =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'adv'
  | 'num'
  | 'pron'
  | 'prep'
  | 'conj'
  | 'det'
  | 'intj'
  | 'phrase';

export type Gender = 'm' | 'f' | 'n' | 'c';
export type GramNumber = 'sg' | 'pl';

/**
 * How the target language forms the word we drop into an English sentence.
 *
 * 'agreeing'  — modern languages: we try to match number, and gender where the
 *               source gives us something to agree with.
 * 'citation'  — heavily inflected historical languages: we use the dictionary
 *               headword (Latin nominative singular, Old English nominative).
 *               English marks case with word order rather than endings, so a
 *               nominative Latin noun reads correctly in an English frame:
 *               "the rex was angry" is unambiguous where "the regis" is not.
 */
export type MorphologyStrategy = 'agreeing' | 'citation';

export interface LanguageMeta {
  code: LangCode;
  /** English name, e.g. "Old English". */
  name: string;
  /** Name in the language itself, e.g. "Englisc". */
  endonym: string;
  /** True for languages with no living native speakers. */
  historical: boolean;
  /**
   * True for a stage of English itself — Old and Middle English — whose
   * words English inherited rather than borrowed. Not the same as
   * `historical`: Latin is dead, and English borrowed from it.
   */
  ancestorOfEnglish?: boolean;
  rtl: boolean;
  morphology: MorphologyStrategy;
  /** BCP-47 tag for speechSynthesis, or null when no voice exists. */
  ttsLang: string | null;
  /** Shown instead of audio for historical languages. */
  pronunciationNote?: string;
  /**
   * Letterform transforms this language supports, in the order they are
   * offered in settings. Used to soften unfamiliar orthography for beginners.
   */
  letterforms?: LetterformId[];
  /** Roughly how close the writing system is to Latin script, 0..1. */
  scriptFamiliarity: number;
  /** Era label for historical languages, shown in the picker. */
  era?: string;
}

export type LetterformId = 'macrons' | 'thorn' | 'eth' | 'ash' | 'wynn' | 'yogh' | 'longS';

/** One dictionary mapping from a source surface form to a target surface form. */
export interface LexEntry {
  /** Source surface form as it appears in text, lowercased. */
  src: string;
  /** Source lemma (dictionary headword). */
  lemma: string;
  pos: Pos;
  /** Target surface form to display. */
  tgt: string;
  /**
   * Target headword; the identity used for the vocabulary list and scheduling.
   * The second of two words with one spelling ends in a homograph number —
   * `hund²`, the hundred, beside `hund`, the dog — so print `tgt`, or
   * `spelling()` from `./lexicon.ts`, and never this as it stands.
   */
  tgtLemma: string;
  gender?: Gender;
  num?: GramNumber;
  /** Zipf frequency of the source word, 1 (rare) .. 7 (the/of/and). */
  zipf: number;
  /** Distinct senses on the source side. High = risky to swap out of context. */
  senses: number;
  /** Confidence in this particular mapping, 0..1. */
  conf: number;
  /** Difficulty band, 1 (easiest) .. 6. Roughly CEFR A1..C2. */
  band: number;
  ipa?: string;
  /**
   * Set when the target word is the actual etymological ancestor of an English
   * word: Old English "hūs" -> "house". Powers the etymon badge, which is the
   * single most motivating thing about historical-language mode.
   */
  etymonOf?: string;
  /** Short usage note shown in the tooltip. */
  note?: string;
  /** Example sentence in the target language, with the word in place. */
  example?: string;
  /** Translation of `example`. */
  exampleGloss?: string;
}

export interface PackMeta {
  source: LangCode;
  target: LangCode;
  /** Pack format version, bumped on breaking shape changes. */
  format: number;
  /** Pack content version, e.g. "2026.09.1". */
  version: string;
  entryCount: number;
  lemmaCount: number;
  /** Data provenance, required for CC-BY-SA compliance. */
  attribution: string[];
  license: string;
  /** Bands actually present, so the UI can show honest coverage. */
  bands: number[];
  builtAt: string;
}

export interface LexPack {
  meta: PackMeta;
  /**
   * Keyed on lowercased source surface form. Stored pre-grouped so the content
   * script does zero index-building work after JSON.parse: a page can start
   * weaving in the same tick the pack lands.
   */
  entries: Record<string, LexEntry[]>;
}

/* ------------------------------------------------------------------ tokens */

export type TokenKind = 'word' | 'space' | 'punct' | 'digit' | 'other';

export interface Token {
  text: string;
  /** Offset into the string the token came from. */
  start: number;
  end: number;
  kind: TokenKind;
  /** Index of the sentence this token belongs to, within the tokenized string. */
  sentence: number;
  /** True when the token starts with an uppercase letter. */
  capitalized: boolean;
  /** True when every letter is uppercase and the token is longer than 1 char. */
  allCaps: boolean;
}

/* --------------------------------------------------------------- memory */

/** FSRS card state for one target-language lemma. */
export interface MemoryCard {
  /** `${target}:${tgtLemma}` */
  id: string;
  target: LangCode;
  /** The pack's `tgtLemma`, homograph number and all: print `spelling(lemma)`. */
  lemma: string;
  /** FSRS stability, in days. */
  stability: number;
  /** FSRS difficulty, 1..10. */
  difficulty: number;
  /** Epoch ms of the last review. */
  lastReview: number;
  /** Number of reviews recorded. */
  reps: number;
  /** Number of times the learner had to reveal the English. */
  lapses: number;
  /** Total times the word has been woven into a page. */
  exposures: number;
  /** Set once the word is treated as known and left in L2 permanently. */
  retiredAt?: number;
  /** Epoch ms when first introduced. */
  firstSeen: number;
}

export type Grade = 1 | 2 | 3 | 4;

export const GRADE = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
} as const satisfies Record<string, Grade>;

/* ------------------------------------------------------------- selection */

/** A candidate swap the selector is considering. */
export interface Candidate {
  token: Token;
  entry: LexEntry;
  card: MemoryCard | undefined;
  /** Composite desirability, higher is better. Populated by scoreCandidate. */
  score: number;
  /** Per-factor breakdown, kept for the "why this word?" debug panel. */
  factors: Record<string, number>;
}

/** A swap the selector has committed to. */
export interface Swap {
  /** Index into the token list. */
  tokenIndex: number;
  start: number;
  end: number;
  /** Original source text, exactly as it appeared (case preserved). */
  original: string;
  /** Replacement text, case-matched to the original. */
  replacement: string;
  entry: LexEntry;
  /**
   * True for a word the learner has already mastered, woven outside the
   * difficulty budget. Styled more faintly, because it is not a demand on
   * the reader — it is the part of the page they can already read.
   */
  retired: boolean;
  /**
   * Per-factor scores, when the selector was asked to explain itself. Turned
   * into one sentence for the tooltip so a reader can see the choice was
   * reasoned rather than random.
   */
  factors?: Record<string, number>;
  /** True when this is the first time the learner has met the word. */
  firstMeeting?: boolean;
}

/* ------------------------------------------------------------- attention */

export interface SiteAttention {
  /** eTLD+1-ish key, e.g. "twitter.com". */
  host: string;
  /** Accumulated attention seconds for the current day. */
  seconds: number;
  /** Epoch ms of the most recent attention tick. */
  lastTick: number;
  /** Local date string (YYYY-MM-DD) the counter belongs to. */
  day: string;
  /** Seconds accumulated per previous day, most recent last. Capped at 60. */
  history: Array<{ day: string; seconds: number }>;
}

/* ------------------------------------------------------------------ lock */

export type PendingChangeKind =
  | 'reduce-difficulty'
  | 'disable-site'
  | 'disable-all'
  | 'change-target'
  | 'lower-ceiling'
  | 'reduce-friction';

export interface PendingChange {
  id: string;
  kind: PendingChangeKind;
  /** JSON patch-ish: dotted path -> new value. */
  patch: Record<string, unknown>;
  requestedAt: number;
  /** Epoch ms after which the change may be applied. */
  unlocksAt: number;
  /** Human-readable summary shown in the countdown UI. */
  summary: string;
  /** Set when a quiz gate is required and has been passed. */
  quizPassedAt?: number;
}

export interface PanicState {
  /** Local day the counter belongs to. */
  day: string;
  used: number;
  /** Epoch ms when the current pass expires, if one is active. */
  activeUntil?: number;
}

/* -------------------------------------------------------------- settings */

export type RenderMode = 'auto' | 'highlight' | 'wrapped';
export type RevealTrigger = 'hover' | 'click' | 'both';
export type ProviderId = 'deepl' | 'google' | 'openai';

export interface SiteRule {
  /** Host pattern: "twitter.com" matches subdomains; "*.example.com" explicit. */
  pattern: string;
  enabled: boolean;
  /** Overrides weave.baseRatio for this site when set. */
  baseRatio?: number;
  /** Overrides weave.ceilingRatio for this site when set. */
  ceilingRatio?: number;
  /** When false, attention does not escalate difficulty here. */
  escalate: boolean;
  /** Optional per-site target language override, for multi-language study. */
  target?: LangCode;
  /** Set by presets so the UI can show where a rule came from. */
  origin?: 'preset' | 'user' | 'imported';
}

export interface Settings {
  schemaVersion: number;
  installId: string;
  onboarded: boolean;
  createdAt: number;

  learning: {
    sourceLang: LangCode;
    targetLangs: LangCode[];
    activeTarget: LangCode;
    level: number;
    posPreference: Pos[];
    minConfidence: number;
    maxSenses: number;
    cognateWeight: number;
    frequencyWeight: number;
    dueWeight: number;
    retireKnownWords: boolean;
    retireStabilityDays: number;
    introduceNewPerDay: number;
    phrasesEnabled: boolean;
  };

  weave: {
    baseRatio: number;
    ceilingRatio: number;
    minWordGap: number;
    maxPerSentence: number;
    protectShortSentences: number;
    renderMode: RenderMode;
    style: {
      underline: 'dotted' | 'dashed' | 'solid' | 'none';
      tint: string;
      tintOpacity: number;
      weight: 'inherit' | '500' | '600';
      italic: boolean;
    };
    letterforms: Record<LetterformId, boolean>;
  };

  attention: {
    enabled: boolean;
    gainPerMinute: number;
    decayPerHourAway: number;
    dailyReset: boolean;
    rolloverHour: number;
    idleThresholdSec: number;
    /** Hard ceiling on daily attention counted, in minutes. Prevents runaway. */
    dailyCapMinutes: number;
  };

  sites: {
    mode: 'taxed-only' | 'everywhere-except';
    taxed: SiteRule[];
    gentle: SiteRule[];
    excluded: string[];
  };

  friction: {
    cooldownMinutes: number;
    requireQuizToUnlock: boolean;
    quizWordCount: number;
    quizPassThreshold: number;
    panicPassesPerDay: number;
    panicMinutes: number;
    tamperResponse: 'escalate' | 'ignore';
    hardMode: boolean;
    /** When true, even raising difficulty is confirmed (prevents misclicks). */
    confirmIncreases: boolean;
  };

  reveal: {
    trigger: RevealTrigger;
    hoverDelayMs: number;
    holdToReveal: boolean;
    showPos: boolean;
    showGender: boolean;
    showIpa: boolean;
    showEtymon: boolean;
    showExample: boolean;
    showBand: boolean;
    /** Show one sentence explaining why this word was chosen. */
    showWhy: boolean;
    tts: boolean;
    grading: 'auto' | 'manual' | 'off';
  };

  a11y: {
    respectReducedMotion: boolean;
    keyboardCursor: boolean;
    highContrast: boolean;
    announceSwaps: boolean;
    /** Force 'wrapped' rendering so swapped words carry lang= for screen readers. */
    preferWrappedForAT: boolean;
    minTooltipFontPx: number;
  };

  providers: {
    enabled: boolean;
    order: ProviderId[];
    deepl: { key: string; free: boolean };
    google: { key: string };
    openai: { baseUrl: string; key: string; model: string };
    cacheDays: number;
    /** Never send text from these hosts to a provider, whatever the settings. */
    neverSendHosts: string[];
    /**
     * When false (the default), a provider only ever receives isolated words
     * and a part-of-speech hint — never a sentence, never page content. That
     * is a hard privacy guarantee rather than a preference, so improving
     * translation quality with surrounding context is a separate, explicit
     * opt-in rather than something that happens quietly.
     */
    sendContext: boolean;
    /** Maximum provider lookups per day, so a key cannot be drained. */
    dailyLookupCap: number;
  };

  privacy: {
    telemetry: false;
    syncSettings: boolean;
  };
}
