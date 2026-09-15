import type { ComponentChildren } from 'preact';

/**
 * Shared interface pieces.
 *
 * Two of these carry the product's identity and are used everywhere:
 * `Gloss`, which sets the target word above the English with a hairline
 * between it — the convention of a glossed manuscript, and a literal picture
 * of what Weft does to a page — and `WeaveBand`, which draws the current
 * density as cloth rather than as a progress bar.
 */

export function Gloss({ target, source }: { target: string; source: string }) {
  return (
    <span class="gloss">
      <span class="gloss__target" lang="und">
        {target}
      </span>
      <span class="gloss__source">{source}</span>
    </span>
  );
}

export function GlossStrip({ pairs }: { pairs: Array<{ target: string; source: string }> }) {
  if (!pairs.length) return null;
  return (
    <span class="gloss-strip">
      {pairs.map((p) => (
        <Gloss key={`${p.source}-${p.target}`} target={p.target} source={p.source} />
      ))}
    </span>
  );
}

/**
 * The density meter as cloth.
 *
 * Warp threads run vertically; the weft crosses a proportion of them equal to
 * the current ratio. `animate` draws the weft once on mount, which is the
 * single piece of non-interactive motion in the whole interface.
 */
export function WeaveBand({
  ratio,
  animate = false,
  height = 26,
  warps = 44,
  label,
}: {
  ratio: number;
  animate?: boolean;
  height?: number;
  warps?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const width = 300;
  const step = width / warps;
  const crossed = Math.round(warps * clamped);

  const lines = [];
  for (let i = 0; i < warps; i++) {
    const x = i * step + step / 2;
    lines.push(<line key={i} class="band__warp" x1={x} y1={2} x2={x} y2={height - 2} />);
  }

  return (
    <svg
      class="band"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label ?? `${Math.round(clamped * 100)} percent woven`}
    >
      {lines}
      {crossed > 0 && (
        <line
          class={`band__weft${animate ? ' band__weft--drawing' : ''}`}
          x1={0}
          y1={height / 2}
          x2={crossed * step}
          y2={height / 2}
          style={{ transformOrigin: '0 50%' }}
        />
      )}
    </svg>
  );
}

export function Section({
  siglum,
  title,
  note,
  children,
}: {
  siglum: string;
  title: string;
  note?: string;
  children: ComponentChildren;
}) {
  return (
    <section class="section">
      <div class="section__head">
        <span class="section__siglum" aria-hidden="true">
          {siglum}
        </span>
        <h2>{title}</h2>
        {note ? <p class="section__note">{note}</p> : null}
      </div>
      <div class="rows">{children}</div>
    </section>
  );
}

/**
 * A setting row.
 *
 * The margin column carries a siglum that means something rather than
 * decorating: a lock for any setting the cooldown governs, a thread mark for
 * difficulty, a shield for the never-weave list. Seeing the lock is how a
 * user knows, before touching a control, that lowering it will take time.
 */
export function Row({
  siglum,
  locked,
  title,
  detail,
  value,
  children,
}: {
  siglum?: string;
  locked?: boolean;
  title: string;
  detail?: string;
  value?: string;
  children?: ComponentChildren;
}) {
  return (
    <div class="row">
      <span class="row__siglum" data-locked={locked ? '1' : undefined} aria-hidden="true">
        {siglum ?? ''}
      </span>
      <div class="row__body">
        <div class="row__label">
          <span class="row__title">{title}</span>
          {value ? <span class="row__value tabular">{value}</span> : null}
        </div>
        {detail ? <p class="row__detail">{detail}</p> : null}
        {children ? <div class="row__control">{children}</div> : null}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label class="switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      <span class="switch__track" />
      <span>{label}</span>
    </label>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
  id,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(next: number): void;
  format?(v: number): string;
  id?: string;
}) {
  return (
    <div class="inline">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
      />
      <span class="row__value tabular">{format ? format(value) : String(value)}</span>
    </div>
  );
}

export function Chips<T extends string>({
  options,
  selected,
  onToggle,
  multi = true,
}: {
  options: Array<{ id: T; label: string; title?: string }>;
  selected: T[];
  onToggle(id: T): void;
  multi?: boolean;
}) {
  return (
    <div class="chips" role={multi ? 'group' : 'radiogroup'}>
      {options.map((option) => {
        const on = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            class="chip"
            data-on={on ? '1' : undefined}
            aria-pressed={multi ? on : undefined}
            aria-checked={multi ? undefined : on}
            role={multi ? undefined : 'radio'}
            title={option.title}
            onClick={() => onToggle(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn';
  children: ComponentChildren;
}) {
  return (
    <div class="notice" data-tone={tone === 'warn' ? 'warn' : undefined} role={tone === 'warn' ? 'alert' : undefined}>
      {children}
    </div>
  );
}

export const percent = (v: number): string => `${Math.round(v * 100)}%`;

export function minutes(v: number): string {
  if (v < 1) return `${Math.round(v * 60)}s`;
  if (v < 60) return `${Math.round(v)} min`;
  const h = Math.floor(v / 60);
  const m = Math.round(v % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "1 word in 16" reads better than "6%" for a density. */
export function oneWordIn(ratio: number): string {
  if (ratio <= 0) return 'none';
  if (ratio >= 1) return 'every word';
  return `1 word in ${Math.max(2, Math.round(1 / ratio))}`;
}
