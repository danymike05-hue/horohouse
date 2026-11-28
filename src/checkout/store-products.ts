// Hosting plans and listing boosts bought inside the phone apps go through Apple's and
// Google's own billing (their rules for digital features). Each is a one-time product (no
// store auto-renewal: plans never renew on their own, as on the website). Same ids in App
// Store Connect, in Google Play Console and in the app (app/utils/store-products.ts).
//
//   plan:  com.horohouse.app.plan.<plan>.<cycle>     e.g. com.horohouse.app.plan.host_growth.monthly
//   boost: com.horohouse.app.boost.<type>.<hours>    e.g. com.horohouse.app.boost.featured.168

export const STORE_PRODUCT_PREFIX = 'com.horohouse.app';

export const STORE_PLANS = ['host_starter', 'host_growth', 'host_pro', 'host_elite'] as const;
export const STORE_CYCLES = ['monthly', 'quarterly', 'yearly'] as const;
export const STORE_BOOSTS = ['standard', 'featured', 'homepage', 'social_media'] as const;
export const STORE_BOOST_HOURS = [24, 168, 720] as const;

export type StoreProduct =
  | { purpose: 'subscription'; planName: string; billingCycle: string }
  | { purpose: 'boost'; boostType: string; duration: number };

export function storeProductId(p: StoreProduct): string {
  return p.purpose === 'subscription'
    ? `${STORE_PRODUCT_PREFIX}.plan.${p.planName}.${p.billingCycle}`
    : `${STORE_PRODUCT_PREFIX}.boost.${p.boostType}.${p.duration}`;
}

/** The product a store id stands for, or null when it isn't one of ours */
export function parseStoreProductId(id: string): StoreProduct | null {
  const plan = new RegExp(`^${STORE_PRODUCT_PREFIX.replace(/\./g, '\\.')}\\.plan\\.([a-z_]+)\\.([a-z]+)$`).exec(id);
  if (plan && (STORE_PLANS as readonly string[]).includes(plan[1]) && (STORE_CYCLES as readonly string[]).includes(plan[2])) {
    return { purpose: 'subscription', planName: plan[1], billingCycle: plan[2] };
  }
  const boost = new RegExp(`^${STORE_PRODUCT_PREFIX.replace(/\./g, '\\.')}\\.boost\\.([a-z_]+)\\.(\\d+)$`).exec(id);
  if (boost && (STORE_BOOSTS as readonly string[]).includes(boost[1]) && (STORE_BOOST_HOURS as readonly number[]).includes(Number(boost[2]))) {
    return { purpose: 'boost', boostType: boost[1], duration: Number(boost[2]) };
  }
  return null;
}

/** Every product to create in the stores (the setup guide lists the same) */
export function allStoreProducts(): string[] {
  return [
    ...STORE_PLANS.flatMap((planName) => STORE_CYCLES.map((billingCycle) => storeProductId({ purpose: 'subscription', planName, billingCycle }))),
    ...STORE_BOOSTS.flatMap((boostType) => STORE_BOOST_HOURS.map((duration) => storeProductId({ purpose: 'boost', boostType, duration }))),
  ];
}
