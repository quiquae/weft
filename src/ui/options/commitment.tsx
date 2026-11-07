import { useState } from 'preact/hooks';
import type { Settings } from '../../core/types.ts';
import { describeWait } from '../../core/lock.ts';
import { send } from '../../shared/rpc.ts';
import { has } from '../../core/entitlements.ts';
import {
  HARD_MODE_PLATFORMS,
  MISSING_PLATFORMS,
  hardModeHere,
  noPolicyHere,
  type Platform,
  type PolicyBrowser,
} from '../../core/hard-mode.ts';
import { uaBrands, updateUrl } from '../../shared/browser.ts';
import { Locked } from './pro.tsx';
import { Chips, Notice, Row, Section, Slider, Switch, minutes } from '../components/pieces.tsx';
import type { Controller } from './controller.ts';
import { SIGLA } from './sections.tsx';

/**
 * Commitment.
 *
 * The settings in this section are the ones that make Weft more than a
 * vocabulary toy, and they are also the settings most likely to be loosened
 * in a weak moment — so loosening them is itself governed by the cooldown.
 * Raising the cooldown takes effect at once; lowering it has to wait out the
 * cooldown you already set.
 */
export function CommitmentSection({ c, settings }: { c: Controller; settings: Settings }) {
  const here = hardModeHere(__WEFT_TARGET__, uaBrands(), updateUrl());
  return (
    <Section
      siglum={SIGLA.locked}
      title="Commitment"
      note="Anything that makes Weft easier waits. Cancelling a waiting change is always instant and free — friction on the way out of a commitment would be coercion, not commitment."
    >
      <Row
        siglum={SIGLA.locked}
        locked
        title="Cooldown"
        detail="How long a difficulty-reducing change waits before it applies. The clock is stored, not scheduled: closing the browser neither cancels it nor restarts it."
        value={settings.friction.cooldownMinutes === 0 ? 'none' : minutes(settings.friction.cooldownMinutes)}
      >
        <Slider
          value={settings.friction.cooldownMinutes}
          min={0}
          max={1440}
          step={5}
          onChange={(v) => void c.set('friction.cooldownMinutes', v)}
          format={(v) => (v === 0 ? 'no wait' : minutes(v))}
        />
      </Row>

      <Row
        siglum={SIGLA.locked}
        locked
        title="Vocabulary check"
        detail="Require a short check before an easier setting unlocks. Questions are drawn only from words you have already been shown, so it is never a test of unseen material — and the answers count as practice whether or not you pass."
      >
        {has(c.tier, 'unlock-quiz') ? (
          <Switch
            checked={settings.friction.requireQuizToUnlock}
            label={
              settings.friction.requireQuizToUnlock
                ? 'A check is required to unlock'
                : 'The cooldown alone is enough'
            }
            onChange={(v) => void c.set('friction.requireQuizToUnlock', v)}
          />
        ) : (
          <Locked feature="unlock-quiz" />
        )}
      </Row>

      {settings.friction.requireQuizToUnlock ? (
        <>
          <Row
            siglum={SIGLA.locked}
            locked
            title="Words per check"
            value={String(settings.friction.quizWordCount)}
          >
            <Slider
              value={settings.friction.quizWordCount}
              min={3}
              max={25}
              step={1}
              onChange={(v) => void c.set('friction.quizWordCount', v)}
            />
          </Row>
          <Row
            siglum={SIGLA.locked}
            locked
            title="Pass mark"
            value={`${Math.round(settings.friction.quizPassThreshold * 100)}%`}
          >
            <Slider
              value={settings.friction.quizPassThreshold}
              min={0.3}
              max={1}
              step={0.05}
              onChange={(v) => void c.set('friction.quizPassThreshold', v)}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </Row>
        </>
      ) : null}

      <Row
        siglum={SIGLA.locked}
        locked
        title="Panic passes"
        detail="Plain English for a few minutes, a fixed number of times a day. This exists because a tool with no escape hatch gets uninstalled the first time someone genuinely needs to read something, and an uninstalled tool teaches nothing. Each use is logged."
        value={
          settings.friction.panicPassesPerDay === 0
            ? 'none'
            : `${settings.friction.panicPassesPerDay} a day, ${minutes(settings.friction.panicMinutes)} each`
        }
      >
        <div class="stack">
          <Slider
            value={settings.friction.panicPassesPerDay}
            min={0}
            max={10}
            step={1}
            onChange={(v) => void c.set('friction.panicPassesPerDay', v)}
            format={(v) => (v === 0 ? 'no passes' : `${v} a day`)}
          />
          <Slider
            value={settings.friction.panicMinutes}
            min={1}
            max={60}
            step={1}
            onChange={(v) => void c.set('friction.panicMinutes', v)}
            format={(v) => `${v} min each`}
          />
        </div>
      </Row>

      <Row
        siglum={SIGLA.locked}
        title="If stored settings are edited"
        detail="Weft signs its own difficulty settings and notices when they have been changed behind its back, or the clock has been turned back. Escalating pins difficulty at the ceiling for 12 hours from the last time it noticed, which makes editing storage a losing move rather than a shortcut."
      >
        <Chips
          multi={false}
          options={[
            { id: 'escalate', label: 'pin at the ceiling for 12 hours' },
            { id: 'ignore', label: 'just note it' },
          ]}
          selected={[settings.friction.tamperResponse]}
          onToggle={(id) => void c.set('friction.tamperResponse', id)}
        />
      </Row>

      {here.file === null ? (
        // A file nothing obeys would look like Hard Mode and hold nothing, so
        // where the browser reads no policy Weft writes, or Edge would not
        // hold it for this copy, the row says so on either tier rather than
        // offering one or selling one.
        <Row siglum={SIGLA.locked} title="Hard Mode" detail={noPolicyHere(here)} />
      ) : has(c.tier, 'hard-mode') ? (
        <HardMode settings={settings} c={c} file={here.file} />
      ) : (
        <Row siglum={SIGLA.locked} title="Hard Mode">
          <Locked feature="hard-mode" />
        </Row>
      )}
    </Section>
  );
}

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: 'macos', label: 'macOS' },
  { id: 'windows', label: 'Windows' },
  { id: 'linux', label: 'Linux' },
];

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return 'macos';
  if (/Win/i.test(ua)) return 'windows';
  return 'linux';
}

/**
 * Hard Mode.
 *
 * Everything else here is friction a user could walk past by opening
 * chrome://extensions and clicking Remove. That is an honest limit of a
 * browser extension, and rather than pretend otherwise this generates the one
 * mechanism that does work — a managed policy marking the extension
 * force-installed — and hands over the removal instructions in the same file.
 * The file is the policy of the browser running Weft, Chrome's or Edge's, and
 * the platforms offered are the ones that browser has a file for.
 */
function HardMode({ settings, c, file }: { settings: Settings; c: Controller; file: PolicyBrowser }) {
  const platforms = PLATFORMS.filter((option) => HARD_MODE_PLATFORMS[file].includes(option.id));
  const detected = detectPlatform();
  const [platform, setPlatform] = useState<Platform>(
    platforms.some((option) => option.id === detected) ? detected : (platforms[0]?.id ?? 'macos'),
  );
  const [profile, setProfile] = useState<{ filename: string; contents: string; instructions: string } | null>(
    null,
  );

  async function generate() {
    const reply = await send({ type: 'hard-mode-profile', platform });
    if (reply) setProfile(reply);
  }

  function download() {
    if (!profile) return;
    const blob = new Blob([profile.contents], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = profile.filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Row
      siglum={SIGLA.locked}
      locked={settings.friction.hardMode}
      title="Hard Mode"
      detail="Generates a browser policy that stops Weft being disabled or removed without an administrator password. You install it yourself, on your own machine, and the file you download contains its own removal instructions."
    >
      <div class="stack">
        <Switch
          checked={settings.friction.hardMode}
          label={
            settings.friction.hardMode
              ? 'Hard Mode is on in your settings'
              : 'Mark my settings as Hard Mode'
          }
          onChange={(v) => void c.set('friction.hardMode', v)}
        />
        <p class="row__detail" style={{ margin: 0 }}>
          The switch above only records your intent. Enforcement comes from the policy file.
        </p>

        <div class="inline">
          <Chips
            multi={false}
            options={platforms}
            selected={[platform]}
            onToggle={(id) => {
              setPlatform(id);
              setProfile(null);
            }}
          />
          <button type="button" onClick={() => void generate()}>
            {profile ? 'Regenerate' : 'Generate the policy file'}
          </button>
        </div>
        {MISSING_PLATFORMS[file] ? (
          <p class="row__detail" style={{ margin: 0 }}>
            {MISSING_PLATFORMS[file]}
          </p>
        ) : null}

        {profile ? (
          <div class="hardmode">
            <div class="inline">
              <button type="button" data-variant="primary" onClick={download}>
                Download {profile.filename}
              </button>
            </div>
            <details>
              <summary>Read it first</summary>
              <textarea readOnly rows={12} value={profile.contents} aria-label="Policy file contents" />
            </details>
            <pre class="hardmode__instructions">{profile.instructions}</pre>
          </div>
        ) : null}

        <Notice tone="warn">
          Read the instructions before installing. Hard Mode is genuinely hard to undo without the
          administrator password for this machine — that is the whole point, and it is a bad idea on
          a computer you do not control.
        </Notice>
      </div>
    </Row>
  );
}

/** Pending-change panel. Shown at the top of the page when anything is waiting. */
export function PendingPanel({
  c,
  now,
  onQuiz,
}: {
  c: Controller;
  now: number;
  onQuiz(id: string, summary: string): void;
}) {
  const pending = c.lock?.pending ?? [];
  if (!pending.length) return null;
  const settings = c.settings;

  return (
    <div class="pending">
      <h2 class="pending__title">
        {pending.length === 1 ? 'One change is waiting' : `${pending.length} changes are waiting`}
      </h2>
      <ul class="pending__list">
        {[...pending]
          .sort((a, b) => a.unlocksAt - b.unlocksAt)
          .map((change) => {
            const remaining = change.unlocksAt - now;
            const needsQuiz = Boolean(settings?.friction.requireQuizToUnlock) && !change.quizPassedAt;
            return (
              <li key={change.id} class="pending__item">
                <div>
                  <p class="pending__summary">{change.summary}</p>
                  <p class="pending__when muted">
                    {remaining > 0 ? `Unlocks ${describeWait(remaining)}.` : 'Cooldown finished.'}
                    {needsQuiz ? ' A vocabulary check is still needed.' : ''}
                    {!needsQuiz && remaining <= 0 ? ' It will apply within the minute.' : ''}
                  </p>
                </div>
                <div class="pending__actions">
                  {needsQuiz ? (
                    <button
                      type="button"
                      data-variant="primary"
                      onClick={() => onQuiz(change.id, change.summary)}
                    >
                      Take the check
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void c.cancel(change.id)}>
                    Cancel
                  </button>
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
