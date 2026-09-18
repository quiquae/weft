/**
 * Telling a screen reader that the page changed language under it.
 *
 * `a11y.announceSwaps` existed as a setting for some time and did nothing at
 * all — no live region was ever created, so a reader who found the toggle,
 * understood exactly what they needed, and switched it on got silence. A
 * dead accessibility control is worse than an absent one: it answers the
 * question "is this usable for me" with a lie.
 *
 * Two rules shape what gets said.
 *
 * **Announce actions, not the page load.** Weaving forty words and reading
 * forty announcements is not information, it is a denial of service. The
 * page gets one summary; individual words are announced only when the reader
 * deliberately reveals one, which they did on purpose and are waiting to
 * hear.
 *
 * **The region is created empty and reused.** A live region inserted into
 * the DOM at the same moment its text appears is announced unreliably across
 * screen readers — the region has to exist first for the change to register
 * as a change. So it is added once, empty, at start.
 */

/** Marks the region so the walker and the renderers leave it alone. */
export const ANNOUNCER_ATTR = 'data-weft-announcer';

/**
 * Off-screen but readable.
 *
 * Not `display: none` and not `visibility: hidden`: both remove the element
 * from the accessibility tree, which is exactly the thing being asked for
 * here. The clip-rect pattern keeps it in the tree and out of sight.
 */
const HIDDEN_STYLE = [
  'position:absolute',
  'width:1px',
  'height:1px',
  'margin:-1px',
  'padding:0',
  'overflow:hidden',
  'clip:rect(0 0 0 0)',
  'clip-path:inset(50%)',
  'white-space:nowrap',
  'border:0',
].join(';');

export class Announcer {
  private region: HTMLElement | null = null;
  private enabled: boolean;
  /** Cleared between pages so one summary is not repeated on every reweave. */
  private summarised = false;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Create the region, empty.
   *
   * Idempotent, and safe to call before anything has been woven.
   */
  start(): void {
    if (!this.enabled || this.region || typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.setAttribute(ANNOUNCER_ATTR, '');
    // role=status carries an implicit aria-live=polite, but both are set
    // because some combinations of browser and screen reader honour only one.
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    // Announce the whole message rather than a diff: the text is replaced
    // each time, and a partial reading of "rivière — river" is useless.
    el.setAttribute('aria-atomic', 'true');
    el.setAttribute('style', HIDDEN_STYLE);
    document.body?.appendChild(el);
    this.region = el;
  }

  /** Follow a settings change without a reload. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (enabled) this.start();
    else this.stop();
  }

  /**
   * One line about the page, at most once per weave.
   *
   * Phrased as a count rather than a list, because the list is the page and
   * the reader is about to read it anyway.
   */
  summarise(count: number, languageName: string): void {
    if (!this.enabled || count <= 0 || this.summarised) return;
    this.summarised = true;
    this.say(
      count === 1
        ? `1 word on this page is in ${languageName}.`
        : `${count} words on this page are in ${languageName}.`,
    );
  }

  /**
   * A single revealed word.
   *
   * Target first, then English, matching the order the tooltip shows and the
   * order the reader met them in: they heard the unfamiliar word, and the
   * gloss is the answer.
   */
  reveal(target: string, english: string): void {
    if (!this.enabled) return;
    this.say(`${target} — ${english}`);
  }

  /** Allow the next weave to summarise again. */
  resetSummary(): void {
    this.summarised = false;
  }

  /**
   * Replace the region's text.
   *
   * Cleared first because setting the same string twice is not a mutation
   * and would not be announced — a reader revealing the same word twice
   * should hear it twice.
   */
  private say(message: string): void {
    if (!this.region) this.start();
    const region = this.region;
    if (!region) return;
    region.textContent = '';
    // A microtask is enough for the clear to register as a separate mutation;
    // a timeout would risk the message arriving after the reader has moved on.
    queueMicrotask(() => {
      if (this.region === region) region.textContent = message;
    });
  }

  stop(): void {
    this.region?.remove();
    this.region = null;
    this.summarised = false;
  }
}
