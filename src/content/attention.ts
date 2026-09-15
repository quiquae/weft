/**
 * Attention tracking.
 *
 * "How long have you been looking at this page" is not the same question as
 * "how long has this tab been open", and the difference is the entire product.
 * A tab left open overnight must not cost you anything; forty minutes of
 * actual scrolling must.
 *
 * A second counts only when all three hold:
 *   - the document is visible (not a background tab, not a minimised window),
 *   - the window has focus (you are not in another application),
 *   - you have interacted within the idle threshold (not walked away).
 *
 * The third condition is what stops a parked article from accumulating time.
 * Scroll, keypress, pointer movement and touch all count as interaction;
 * reading without moving for 45 seconds does not, which slightly
 * under-counts slow readers and that is the right direction to be wrong in.
 */

const ACTIVITY_EVENTS = [
  'pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart', 'focus',
] as const;

export interface AttentionOptions {
  idleThresholdSec: number;
  /** Seconds between reports to the background. */
  reportEverySec: number;
  onReport(seconds: number): void;
}

export class AttentionTracker {
  private timer: number | null = null;
  private lastActivity = Date.now();
  private pending = 0;
  private sinceReport = 0;
  private running = false;
  private readonly onActivity = () => {
    this.lastActivity = Date.now();
  };
  private readonly onVisibility = () => {
    // Report immediately on hide so a closed tab does not lose its seconds.
    if (document.visibilityState === 'hidden') this.report(true);
  };

  constructor(private opts: AttentionOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, this.onActivity, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onVisibility);
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, this.onActivity, { capture: true });
    }
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onVisibility);
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.report(true);
  }

  updateOptions(opts: Partial<AttentionOptions>): void {
    this.opts = { ...this.opts, ...opts };
  }

  /** Is the user paying attention to this page right now? */
  isAttending(): boolean {
    if (document.visibilityState !== 'visible') return false;
    if (!document.hasFocus()) return false;
    return Date.now() - this.lastActivity < this.opts.idleThresholdSec * 1000;
  }

  private tick(): void {
    if (!this.isAttending()) return;
    this.pending += 1;
    this.sinceReport += 1;
    if (this.sinceReport >= this.opts.reportEverySec) this.report(false);
  }

  private report(force: boolean): void {
    if (this.pending <= 0) return;
    if (!force && this.sinceReport < this.opts.reportEverySec) return;
    const seconds = this.pending;
    this.pending = 0;
    this.sinceReport = 0;
    this.opts.onReport(seconds);
  }
}
