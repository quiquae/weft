import { render } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { LexEntry, MemoryCard } from '../../core/types.ts';
import { getLanguage } from '../../core/languages.ts';
import { attentionSummary, stageOf, vocabStats, wordsRead } from '../../core/stats.ts';
import { cardRetrievability, daysUntilDue } from '../../core/fsrs.ts';
import { formatDuration } from '../../core/escalation.ts';
import { buildDiscoveries } from '../../core/discoveries.ts';
import { earnedMilestones, nextMilestone } from '../../core/milestones.ts';
import { historyDays } from '../../core/entitlements.ts';
import { api } from '../../shared/browser.ts';
import { useRequest } from '../lib/hooks.ts';
import { Gloss, Notice, Section, WeaveBand } from '../components/pieces.tsx';
import { DailyBars, RankedBars, StageBand, Tile } from '../components/charts.tsx';

/**
 * The progress page.
 *
 * Built around one claim, because it is the claim that makes someone keep the
 * extension: you have read this many words of another language without
 * setting out to. Everything else on the page supports or qualifies that.
 *
 * The vocabulary list uses the same interlinear gloss as the rest of the
 * product, so the page reads the way the woven text reads.
 */

const STAGE_LABELS = {
  learning: 'Learning',
  familiar: 'Familiar',
  retired: 'Known',
} as const;

function Dashboard() {
  const stats = useRequest({ type: 'get-stats' });
  const [sort, setSort] = useState<'urgent' | 'seen' | 'alpha' | 'stable'>('urgent');
  const [showTable, setShowTable] = useState(false);
  const [filter, setFilter] = useState('');
  const now = Date.now();

  const packRequest = useRequest(
    stats.data
      ? {
          type: 'get-pack' as const,
          source: stats.data.settings.learning.sourceLang,
          target: stats.data.settings.learning.activeTarget,
        }
      : null,
  );

  const glosses = useMemo(() => {
    const entries = packRequest.data?.pack?.entries;
    if (!entries) return new Map<string, LexEntry>();
    const byLemma = new Map<string, LexEntry>();
    for (const list of Object.values(entries)) {
      for (const entry of list) {
        if (!byLemma.has(entry.tgtLemma)) byLemma.set(entry.tgtLemma, entry);
      }
    }
    return byLemma;
  }, [packRequest.data]);

  if (stats.loading) {
    return (
      <main class="page">
        <p class="muted">Reading your progress…</p>
      </main>
    );
  }

  if (!stats.data) {
    return (
      <main class="page">
        <h1>Progress</h1>
        <Notice tone="warn">
          Weft could not reach its background worker. Reload this page and try again.
        </Notice>
      </main>
    );
  }

  const { settings, cards, attention, lock, tier, network } = stats.data;
  const target = settings.learning.activeTarget;
  const lang = getLanguage(target);
  const mine = cards.filter((c) => c.target === target);
  const v = vocabStats(mine, settings, now);
  const days = historyDays(tier);
  const attn = attentionSummary(attention, now, settings.attention.rolloverHour, Math.max(days, 7));

  const discoveries = buildDiscoveries({
    cards: mine,
    entriesByLemma: glosses,
    historical: lang.historical,
    limit: 24,
  });
  const milestoneInput = { cards: mine, settings, now, streakDays: attn.streakDays };
  const earned = earnedMilestones(milestoneInput);
  const next = nextMilestone(milestoneInput);

  const stages = [
    {
      id: 'learning',
      label: STAGE_LABELS.learning,
      count: v.learning,
      detail: 'met and being scheduled, but not yet holding',
    },
    {
      id: 'familiar',
      label: STAGE_LABELS.familiar,
      count: v.familiar,
      detail: 'holding for a week or more',
    },
    {
      id: 'retired',
      label: STAGE_LABELS.retired,
      count: v.retired,
      detail: 'left in the target language permanently',
    },
  ];

  const visible = mine
    .filter((c) => {
      if (!filter.trim()) return true;
      const q = filter.trim().toLowerCase();
      return c.lemma.toLowerCase().includes(q) || (glosses.get(c.lemma)?.lemma ?? '').includes(q);
    })
    .sort((a, b) => {
      switch (sort) {
        case 'seen':
          return b.exposures - a.exposures;
        case 'alpha':
          return a.lemma.localeCompare(b.lemma);
        case 'stable':
          return b.stability - a.stability;
        case 'urgent':
        default:
          return cardRetrievability(a, now) - cardRetrievability(b, now);
      }
    });

  return (
    <main class="page">
      <header class="masthead">
        <h1 class="masthead__title">Progress</h1>
        <p class="masthead__line">
          Everything here is on this machine. Weft has no account and sends nothing anywhere.
        </p>
      </header>

      <p class="headline">
        You have read <strong>{wordsRead(mine).toLocaleString()}</strong> words of{' '}
        {lang.name} without setting out to.
      </p>

      <div class="tiles">
        <Tile
          value={String(v.total)}
          label={`${lang.name} words met`}
          detail={`${v.new} seen but not yet reviewed`}
        />
        <Tile
          value={String(v.retired)}
          label="words you now simply read"
          detail="left in the target language for good"
        />
        <Tile
          value={`${Math.round(v.comprehensionRate * 100)}%`}
          label="read without revealing"
          detail={`${v.totalReveals.toLocaleString()} reveals in ${v.totalExposures.toLocaleString()} sightings`}
        />
        <Tile
          value={formatDuration(attn.todaySeconds)}
          label="taxed attention today"
          detail={attn.streakDays > 1 ? `${attn.streakDays}-day run` : 'first day'}
        />
      </div>

      {discoveries.length ? (
        <Section
          siglum="¶"
          title="What you have found out"
          note="Things the words themselves told you, as you met them. This is the part nobody expects."
        >
          <ul class="finds">
            {discoveries.map((d) => (
              <li key={d.id} class="finds__row" data-kind={d.kind}>
                <span class="finds__text">{d.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {earned.length || next ? (
        <Section
          siglum="†"
          title="Milestones"
          note="Facts about reading you have actually done. Nothing here decays, and there is no streak to break."
        >
          <div class="plot">
            {earned.length ? (
              <ul class="marks">
                {earned.map((m) => (
                  <li key={m.id} class="marks__row">
                    <span class="marks__tick" aria-hidden="true">
                      ✓
                    </span>
                    <span>
                      <strong>{m.label}</strong>
                      <span class="marks__detail">{m.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {next ? (
              <div class="marks__next">
                <p class="marks__nextLabel">
                  Next: <strong>{next.label}</strong>{' '}
                  <span class="muted tabular">{next.measure}</span>
                </p>
                <WeaveBand ratio={next.progress} height={14} warps={30} label={next.measure} />
                <p class="marks__detail">{next.detail}</p>
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section
        siglum="⁄⁄"
        title="Where your vocabulary stands"
        note="A word moves right as it holds. Once it is known, Weft stops counting it against the difficulty of a page — you are no longer being asked to do anything."
      >
        <div class="plot">
          <StageBand stages={stages} />
          {v.dueNow > 0 ? (
            <p class="muted plot__note">
              {v.dueNow} {v.dueNow === 1 ? 'word is' : 'words are'} slipping and will be put in
              front of you sooner.
            </p>
          ) : null}
        </div>
      </Section>

      <Section
        siglum="⁄⁄"
        title={`Attention, last ${days === 1 ? "day" : `${days} days`}`}
        note="Time counted only while a taxed page was visible, focused, and you were actually doing something. A tab left open overnight is not attention."
      >
        <div class="plot">
          <DailyBars
            bars={attn.series.map((d) => ({
              label: d.day,
              value: d.seconds,
              title: new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              }),
            }))}
            format={(v2) => formatDuration(v2)}
          />
          <button type="button" data-variant="quiet" onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Hide the numbers' : 'Show the numbers'}
          </button>
          {showTable ? (
            <table class="table">
              <caption class="sr-only">Attention per day, in seconds</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Attention</th>
                </tr>
              </thead>
              <tbody>
                {[...attn.series].reverse().map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{d.day}</th>
                    <td class="tabular">{d.seconds ? formatDuration(d.seconds) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </Section>

      <Section siglum="§" title="Today, by site">
        <div class="plot">
          <RankedBars
            items={attn.today.map((h) => ({ label: h.host, value: h.seconds }))}
            format={(v2) => formatDuration(v2)}
          />
        </div>
      </Section>

      <Section
        siglum="¶"
        title={`Your ${lang.name}`}
        note="Every word Weft has put in front of you, and how well it is holding."
      >
        <div class="vocab__controls">
          <input
            type="search"
            value={filter}
            placeholder="Find a word"
            aria-label="Find a word"
            onInput={(e) => setFilter((e.currentTarget as HTMLInputElement).value)}
          />
          <div class="inline">
            {(
              [
                ['urgent', 'slipping first'],
                ['seen', 'most seen'],
                ['stable', 'best held'],
                ['alpha', 'alphabetical'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                class="chip"
                data-on={sort === id ? '1' : undefined}
                onClick={() => setSort(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p class="empty">
            No {lang.name} words yet. Open a site on your taxed list and read for a minute — Weft
            introduces up to {settings.learning.introduceNewPerDay} new words a day.
          </p>
        ) : (
          <ul class="vocab">
            {visible.slice(0, 400).map((card) => (
              <VocabRow key={card.id} card={card} entry={glosses.get(card.lemma)} now={now} settings={settings} />
            ))}
          </ul>
        )}
        {visible.length > 400 ? (
          <p class="muted">Showing the first 400 of {visible.length}.</p>
        ) : null}
      </Section>

      <Section
        siglum="§"
        title="What has left this machine"
        note="Counted, not promised. Every request Weft has made since you installed it."
      >
        <div class="plot">
          <p class="transparency">
            <span class="transparency__number tabular">{network.requests.toLocaleString()}</span>
            <span class="transparency__label">
              {network.requests === 0
                ? 'network requests, ever. Nothing has left this machine.'
                : `network requests, carrying ${network.words.toLocaleString()} individual words to ${network.hosts.join(', ')}.`}
            </span>
          </p>
          <p class="muted plot__note">
            {network.requests === 0
              ? 'Weft has no account and no server. It only ever goes to the network if you give it your own translation API key, and you have not.'
              : 'Only isolated words are ever sent, never page text. Turn this off under Vocabulary in settings.'}
          </p>
        </div>
      </Section>

      {lock.log.length ? (
        <Section
          siglum="⊘"
          title="What you have changed"
          note="An append-only record of every difficulty change, so a slow drift towards easier is visible rather than invisible."
        >
          <ul class="log">
            {[...lock.log]
              .reverse()
              .slice(0, 40)
              .map((entry, i) => (
                <li key={`${entry.at}-${i}`} class="log__row">
                  <span class="log__when muted tabular">
                    {new Date(entry.at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span class="log__what">{entry.summary}</span>
                  <span class="log__how muted">
                    {entry.direction === 'easier' ? 'easier' : entry.direction === 'harder' ? 'harder' : 'neutral'}
                    {entry.via === 'cooldown' ? ', after a wait' : entry.via === 'cancelled' ? ', cancelled' : ''}
                  </span>
                </li>
              ))}
          </ul>
        </Section>
      ) : null}

      <footer class="colophon">
        <p>
          <a
            href={api.runtime.getURL('options.html')}
            onClick={(e) => {
              e.preventDefault();
              void api.runtime.openOptionsPage();
            }}
          >
            Settings
          </a>
        </p>
      </footer>
    </main>
  );
}

function VocabRow({
  card,
  entry,
  now,
  settings,
}: {
  card: MemoryCard;
  entry: LexEntry | undefined;
  now: number;
  settings: Parameters<typeof stageOf>[1];
}) {
  const stage = stageOf(card, settings, now);
  const retention = cardRetrievability(card, now);
  const due = daysUntilDue(card);

  return (
    <li class="vocab__row" data-stage={stage}>
      <span class="vocab__gloss">
        <Gloss target={entry?.tgt ?? card.lemma} source={entry?.lemma ?? '—'} />
      </span>
      <span class="vocab__hold" aria-hidden="true">
        <WeaveBand ratio={retention} height={12} warps={16} label="" />
      </span>
      <span class="vocab__meta muted">
        {stage === 'retired'
          ? 'known'
          : card.reps === 0
            ? `seen ${card.exposures}×`
            : `${Math.round(retention * 100)}% held${due > 0.9 ? `, due in ${Math.round(due)}d` : ', due now'}`}
      </span>
      {entry?.etymonOf ? (
        <span class="vocab__etymon">
          → English <em>{entry.etymonOf}</em>
        </span>
      ) : (
        <span />
      )}
    </li>
  );
}

const root = document.getElementById('root');
if (root) render(<Dashboard />, root);
