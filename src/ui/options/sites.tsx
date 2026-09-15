import { useEffect, useState } from 'preact/hooks';
import type { Settings, SiteRule } from '../../core/types.ts';
import { SITE_PRESETS, originsForRules, parsePattern, rulesFromPreset } from '../../core/sites.ts';
import { api } from '../../shared/browser.ts';
import { send } from '../../shared/rpc.ts';
import { Chips, Notice, Row, Section, Slider, Switch, percent } from '../components/pieces.tsx';
import type { Controller } from './controller.ts';
import { SIGLA } from './sections.tsx';

/**
 * Site lists and host permissions.
 *
 * Weft asks for no site access at install time, so this page is where access
 * is actually granted. The grant has to happen here rather than in the
 * service worker, because Chrome only allows `permissions.request` from a
 * user gesture on an extension page — which is the right constraint: the
 * click that widens what an extension can read should be a click the user
 * made on a page that told them so.
 */

function normalizeInput(value: string): string | null {
  const parsed = parsePattern(value);
  if (!parsed) return null;
  return value.trim().toLowerCase();
}

function RuleList({
  rules,
  onChange,
  emptyText,
  escalating,
  settings,
}: {
  rules: SiteRule[];
  onChange(next: SiteRule[]): void;
  emptyText: string;
  escalating: boolean;
  settings: Settings;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function add() {
    const pattern = normalizeInput(draft);
    if (!pattern) {
      setError('That is not a host. Try twitter.com, *.reddit.com or reddit.com/r/all.');
      return;
    }
    if (rules.some((r) => r.pattern === pattern)) {
      setError('That one is already listed.');
      return;
    }
    setError(null);
    setDraft('');
    onChange([...rules, { pattern, enabled: true, escalate: escalating, origin: 'user' }]);
  }

  return (
    <div class="sites">
      <form
        class="inline"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          type="text"
          value={draft}
          placeholder="twitter.com"
          aria-label="Site to add"
          spellcheck={false}
          onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
        />
        <button type="submit">Add</button>
      </form>
      {error ? <p class="sites__error">{error}</p> : null}

      {rules.length === 0 ? (
        <p class="muted sites__empty">{emptyText}</p>
      ) : (
        <ul class="sites__list">
          {rules.map((rule) => {
            const open = expanded === rule.pattern;
            return (
              <li key={rule.pattern} class="sites__item">
                <div class="sites__row">
                  <Switch
                    checked={rule.enabled}
                    label={rule.pattern}
                    onChange={(enabled) =>
                      onChange(rules.map((r) => (r.pattern === rule.pattern ? { ...r, enabled } : r)))
                    }
                  />
                  <span class="sites__spacer" />
                  <button
                    type="button"
                    data-variant="quiet"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : rule.pattern)}
                  >
                    {open ? 'Done' : 'Tune'}
                  </button>
                  <button
                    type="button"
                    data-variant="quiet"
                    onClick={() => onChange(rules.filter((r) => r.pattern !== rule.pattern))}
                  >
                    Remove
                  </button>
                </div>

                {open ? (
                  <div class="sites__tune">
                    <Switch
                      checked={rule.escalate}
                      label="Difficulty climbs the longer you stay here"
                      onChange={(escalate) =>
                        onChange(
                          rules.map((r) => (r.pattern === rule.pattern ? { ...r, escalate } : r)),
                        )
                      }
                    />
                    <label class="sites__field">
                      <span>Resting density here</span>
                      <Slider
                        value={rule.baseRatio ?? settings.weave.baseRatio}
                        min={0}
                        max={0.8}
                        step={0.01}
                        format={percent}
                        onChange={(baseRatio) =>
                          onChange(
                            rules.map((r) =>
                              r.pattern === rule.pattern ? { ...r, baseRatio } : r,
                            ),
                          )
                        }
                      />
                    </label>
                    <label class="sites__field">
                      <span>Ceiling here</span>
                      <Slider
                        value={rule.ceilingRatio ?? settings.weave.ceilingRatio}
                        min={0}
                        max={1}
                        step={0.01}
                        format={percent}
                        onChange={(ceilingRatio) =>
                          onChange(
                            rules.map((r) =>
                              r.pattern === rule.pattern ? { ...r, ceilingRatio } : r,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SitesSection({ c, settings }: { c: Controller; settings: Settings }) {
  const [granted, setGranted] = useState<string[]>([]);
  const [permMessage, setPermMessage] = useState<string | null>(null);

  useEffect(() => {
    void send({ type: 'get-granted-origins' }).then((reply) => {
      if (reply) setGranted(reply.origins);
    });
  }, [settings]);

  const needed = [
    ...new Set([
      ...originsForRules(settings.sites.taxed.filter((r) => r.enabled)),
      ...originsForRules(settings.sites.gentle.filter((r) => r.enabled)),
    ]),
  ];
  const hasAll = granted.includes('*://*/*');
  const missing = hasAll ? [] : needed.filter((origin) => !granted.includes(origin));

  async function grant(origins: string[]) {
    try {
      const ok = await api.permissions.request({ origins });
      if (!ok) {
        setPermMessage('Access was not granted, so nothing will be woven on those sites.');
        return;
      }
      await send({ type: 'reregister-scripts' });
      const reply = await send({ type: 'get-granted-origins' });
      if (reply) setGranted(reply.origins);
      setPermMessage('Access granted. Reload any open tabs on those sites.');
    } catch (err) {
      setPermMessage(`Chrome refused the request: ${(err as Error).message}`);
    }
  }

  return (
    <Section
      siglum={SIGLA.shield}
      title="Sites"
      note="Weft has no access to any site until you grant it here, one host at a time. That is why it installs without the “read and change all your data on all websites” warning."
    >
      {missing.length ? (
        <Notice tone="warn">
          <p style={{ margin: 0 }}>
            {missing.length === 1
              ? 'One site on your list has not been granted access yet, so nothing is woven there.'
              : `${missing.length} sites on your list have not been granted access yet, so nothing is woven on them.`}
          </p>
          <button
            type="button"
            data-variant="primary"
            style={{ marginTop: '0.6rem' }}
            onClick={() => void grant(missing)}
          >
            Grant access to {missing.length === 1 ? 'it' : 'them'}
          </button>
        </Notice>
      ) : needed.length ? (
        <p class="muted">Access granted for every site on your list.</p>
      ) : null}

      {permMessage ? <Notice>{permMessage}</Notice> : null}

      <Row
        siglum={SIGLA.shield}
        title="Where Weft runs"
        detail="“Only my list” is the narrow option and the recommended one. “Everywhere except” gives every page a fixed gentle dose, and needs access to all sites."
      >
        <Chips
          multi={false}
          options={[
            { id: 'taxed-only', label: 'only my list' },
            { id: 'everywhere-except', label: 'everywhere except my exclusions' },
          ]}
          selected={[settings.sites.mode]}
          onToggle={(id) => {
            if (id === 'everywhere-except') void grant(['*://*/*']);
            void c.set('sites.mode', id);
          }}
        />
      </Row>

      <Row
        siglum={SIGLA.thread}
        title="Taxed sites"
        detail="The ones where staying costs you. Difficulty climbs with your attention here."
      >
        <RuleList
          rules={settings.sites.taxed}
          escalating
          settings={settings}
          emptyText="Nothing taxed yet. Add the sites you lose time to."
          onChange={(next) => void c.set('sites.taxed', next)}
        />
        <div class="sites__presets">
          <span class="muted">Add a set: </span>
          <Chips
            options={SITE_PRESETS.filter((p) => p.escalate).map((p) => ({
              id: p.id,
              label: p.label,
              title: p.detail,
            }))}
            selected={[]}
            onToggle={(id) => {
              const { taxed } = rulesFromPreset(id);
              const existing = new Set(settings.sites.taxed.map((r) => r.pattern));
              const merged = [...settings.sites.taxed, ...taxed.filter((r) => !existing.has(r.pattern))];
              void c.set('sites.taxed', merged);
            }}
          />
        </div>
      </Row>

      <Row
        siglum={SIGLA.thread}
        title="Gentle sites"
        detail="A fixed, low dose that never climbs. Good for long-form reading, where the surrounding context does the teaching."
      >
        <RuleList
          rules={settings.sites.gentle}
          escalating={false}
          settings={settings}
          emptyText="No gentle sites yet."
          onChange={(next) => void c.set('sites.gentle', next)}
        />
        <div class="sites__presets">
          <span class="muted">Add a set: </span>
          <Chips
            options={SITE_PRESETS.filter((p) => !p.escalate).map((p) => ({
              id: p.id,
              label: p.label,
              title: p.detail,
            }))}
            selected={[]}
            onToggle={(id) => {
              const { gentle } = rulesFromPreset(id);
              const existing = new Set(settings.sites.gentle.map((r) => r.pattern));
              const merged = [
                ...settings.sites.gentle,
                ...gentle.filter((r) => !existing.has(r.pattern)),
              ];
              void c.set('sites.gentle', merged);
            }}
          />
        </div>
      </Row>

      <Row
        siglum={SIGLA.shield}
        locked
        title="Never weave"
        detail="Beats every other rule. Weft ships this list covering money, mail, credentials and health, because a language tool has no business between you and any of those. Adding to it is a reduction in difficulty and goes through the cooldown."
      >
        <ExclusionList
          patterns={settings.sites.excluded}
          onChange={(next) => void c.set('sites.excluded', next)}
        />
      </Row>
    </Section>
  );
}

function ExclusionList({
  patterns,
  onChange,
}: {
  patterns: string[];
  onChange(next: string[]): void;
}) {
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? patterns : patterns.slice(0, 8);

  return (
    <div class="sites">
      <form
        class="inline"
        onSubmit={(e) => {
          e.preventDefault();
          const pattern = normalizeInput(draft);
          if (!pattern || patterns.includes(pattern)) return;
          setDraft('');
          onChange([...patterns, pattern]);
        }}
      >
        <input
          type="text"
          value={draft}
          placeholder="mybank.example"
          aria-label="Site to never weave"
          spellcheck={false}
          onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
        />
        <button type="submit">Add</button>
      </form>

      <ul class="sites__flat">
        {visible.map((pattern) => (
          <li key={pattern}>
            <span>{pattern}</span>
            <button
              type="button"
              data-variant="quiet"
              onClick={() => onChange(patterns.filter((p) => p !== pattern))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {patterns.length > 8 ? (
        <button type="button" data-variant="quiet" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${patterns.length}`}
        </button>
      ) : null}
    </div>
  );
}
