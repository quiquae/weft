/**
 * Prices, in one place.
 *
 * The extension and the website both read this, because a product whose
 * settings page and pricing page disagree about the price looks like a scam
 * even when it is an honest mistake.
 *
 * Three options rather than two: monthly for people who want to try paying
 * before committing, yearly as the one to choose, and a lifetime key because
 * a tool whose whole pitch is "no server, nothing phones home" should offer
 * the purchase that matches that promise. Someone who buys Weft to escape
 * subscriptions should not be sold a subscription.
 */

export interface Plan {
  id: 'monthly' | 'yearly' | 'lifetime';
  label: string;
  /** Price in whole currency units. */
  price: number;
  currency: 'USD';
  /** Billing cadence, for display. */
  per: string;
  /** Shown under the price. */
  note: string;
  /** Marked as the recommended option. */
  featured?: boolean;
  /** Where the buy button goes. Replace with your own checkout. */
  checkout: string;
}

export const CHECKOUT_BASE = 'https://weft.lemonsqueezy.com/checkout/buy';

export const PLANS: Plan[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: 3.5,
    currency: 'USD',
    per: 'per month',
    note: 'Cancel whenever. Your vocabulary stays either way.',
    checkout: `${CHECKOUT_BASE}/weft-pro-monthly`,
  },
  {
    id: 'yearly',
    label: 'Yearly',
    price: 24,
    currency: 'USD',
    per: 'per year',
    note: 'Works out at $2 a month.',
    featured: true,
    checkout: `${CHECKOUT_BASE}/weft-pro-yearly`,
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    price: 59,
    currency: 'USD',
    per: 'once',
    note: 'One key, no renewal, no server to outlive.',
    checkout: `${CHECKOUT_BASE}/weft-pro-lifetime`,
  },
];

export function formatPrice(plan: Plan): string {
  const whole = Number.isInteger(plan.price) ? String(plan.price) : plan.price.toFixed(2);
  return `$${whole}`;
}

export function planById(id: Plan['id']): Plan {
  const found = PLANS.find((p) => p.id === id);
  if (!found) throw new Error(`unknown plan: ${id}`);
  return found;
}

/** The single sentence that has to do the selling. */
export const PITCH =
  'Weft Free is one language, forever, with the whole lexicon and the whole idea. ' +
  'Pro adds every language at once, a different one per site, Hard Mode, and your own ' +
  'translation key for unlimited vocabulary.';

/** Where someone goes to buy. Kept here so the extension links correctly. */
export const PRICING_URL = 'https://weft.study/pricing';

/**
 * Where someone goes when something is wrong.
 *
 * Every store requires one of these, and it is the field reviewers check
 * first. Kept beside the pricing URL so both move together if the domain
 * does; the site generator reads this file too.
 */
export const SUPPORT_URL = 'https://weft.study/support';
