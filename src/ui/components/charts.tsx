import { useId, useState } from 'preact/hooks';

/**
 * Charts, in plain SVG.
 *
 * Three decisions worth recording, because each was made against a check
 * rather than by eye:
 *
 * **The headline is not a chart.** "You have read 14,300 words of French"
 * is one number doing one job, so it is a stat tile. Plotting it would add
 * nothing.
 *
 * **Vocabulary stages are sequential, not categorical.** new → learning →
 * familiar → retired is an ordered progression, so it gets one hue stepped
 * light to dark, never a set of distinct hues.
 *
 * **There are three stages in the band, not four.** A single-hue ramp of four
 * steps cannot hold adjacent pairs above the ΔE 15 legibility floor while
 * staying inside a usable lightness band — the validator said so. Rather than
 * fudge the colours, "new" moved out of the band and became its own tile,
 * which is also the better reading of the data: a word you have merely met is
 * the input to the progression, not a stage of it. The remaining three steps
 * clear the floor with ΔE 20.5 in light mode and 18.6 in dark, each stepped
 * separately against its own surface.
 */

export interface Bar {
  label: string;
  value: number;
  /** Long-form label for the tooltip. */
  title: string;
}

/**
 * Daily series. One measure, one colour, no legend — the title names it.
 * Bars rather than a line because the buckets are discrete days, and a line
 * would imply a reading between midnight and midnight.
 */
export function DailyBars({
  bars,
  format,
  height = 96,
}: {
  bars: Bar[];
  format(value: number): string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const gap = 2;
  const slot = width / Math.max(1, bars.length);
  const barWidth = Math.max(2, slot - gap);
  const peak = bars.reduce((best, b, i) => (b.value > (bars[best]?.value ?? 0) ? i : best), 0);

  return (
    <div class="chart">
      <svg
        class="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Daily attention for the last ${bars.length} days`}
      >
        {/* Recessive baseline only: no gridlines for a series this short. */}
        <line class="chart__axis" x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} />
        {bars.map((bar, i) => {
          const h = bar.value > 0 ? Math.max(3, (bar.value / max) * (height - 14)) : 0;
          const x = i * slot + gap / 2;
          const y = height - h;
          if (h === 0) return null;
          return (
            <path
              key={bar.label}
              class="chart__bar"
              data-hover={hover === i ? '1' : undefined}
              d={roundedTop(x, y, barWidth, h, 4)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              role="img"
              aria-label={`${bar.title}: ${format(bar.value)}`}
            />
          );
        })}
      </svg>

      {/* Selective direct labels: the peak and the most recent day, never every bar. */}
      <div class="chart__labels">
        <span>{bars[0]?.title ?? ''}</span>
        <span class="chart__peak">
          peak {format(bars[peak]?.value ?? 0)} on {bars[peak]?.title ?? ''}
        </span>
        <span>{bars.at(-1)?.title ?? ''}</span>
      </div>

      <p class="chart__tip" role="status">
        {hover === null
          ? ' '
          : `${bars[hover]?.title}: ${format(bars[hover]?.value ?? 0)}`}
      </p>
    </div>
  );
}

/** A bar with its data-end rounded and its base square on the axis. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ');
}

export interface Stage {
  id: string;
  label: string;
  count: number;
  detail: string;
}

/**
 * The stage band: one whole, divided.
 *
 * Drawn as a single band rather than a pie because the question is "what
 * proportion of my vocabulary has got somewhere", and a band answers that at
 * a glance. Segments are separated by a 2px surface gap so adjacent steps do
 * not need to carry the whole distinction, and every segment is directly
 * labelled, which is also what discharges the contrast warning on the
 * lightest step.
 */
export function StageBand({ stages }: { stages: Stage[] }) {
  const patternId = useId();
  const total = stages.reduce((a, s) => a + s.count, 0);
  const width = 640;
  const height = 30;
  const gap = 2;

  if (total === 0) {
    return <p class="muted">Nothing learned yet. Read a page with Weft on.</p>;
  }

  let x = 0;
  const segments = stages.map((stage, i) => {
    const w = Math.max(0, (stage.count / total) * width - (i < stages.length - 1 ? gap : 0));
    const segment = { stage, x, w, step: i + 1 };
    x += w + gap;
    return segment;
  });

  return (
    <div class="chart">
      <svg
        class="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={stages.map((s) => `${s.count} ${s.label}`).join(', ')}
      >
        <defs>
          {/* Available for forced-colors and print, where fills collapse. */}
          <pattern id={patternId} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" class="chart__texture" />
          </pattern>
        </defs>
        {segments.map(({ stage, x: sx, w, step }) =>
          w > 0 ? (
            <rect
              key={stage.id}
              class="chart__segment"
              data-step={step}
              x={sx}
              y={0}
              width={w}
              height={height}
              rx={2}
            >
              <title>{`${stage.label}: ${stage.count} — ${stage.detail}`}</title>
            </rect>
          ) : null,
        )}
      </svg>

      <ul class="legend">
        {stages.map((stage, i) => (
          <li key={stage.id} class="legend__item">
            <span class="legend__swatch" data-step={i + 1} aria-hidden="true" />
            <span class="legend__label">{stage.label}</span>
            <span class="legend__value tabular">{stage.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars with direct labels. One series, so no legend. */
export function RankedBars({
  items,
  format,
}: {
  items: Array<{ label: string; value: number }>;
  format(value: number): string;
}) {
  if (!items.length) return <p class="muted">No attention recorded today.</p>;
  const max = Math.max(...items.map((i) => i.value));
  return (
    <ul class="ranked">
      {items.slice(0, 8).map((item) => (
        <li key={item.label} class="ranked__row">
          <span class="ranked__label">{item.label}</span>
          <span class="ranked__track">
            <span class="ranked__fill" style={{ width: `${Math.max(1, (item.value / max) * 100)}%` }} />
          </span>
          <span class="ranked__value tabular">{format(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** A single number doing a single job. Not a chart. */
export function Tile({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail?: string;
}) {
  return (
    <div class="tile">
      <span class="tile__value tabular">{value}</span>
      <span class="tile__label">{label}</span>
      {detail ? <span class="tile__detail">{detail}</span> : null}
    </div>
  );
}
