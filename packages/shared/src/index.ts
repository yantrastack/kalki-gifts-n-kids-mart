/**
 * Shared contract between the Stockwell backend (apps/stockwell) and the
 * customer storefront (apps/storefront).
 *
 * The backend's public endpoints (`/api/shop/products`, `/api/brand`) shape
 * their JSON to these types; the storefront consumes them. Change them here
 * so both sides stay in sync.
 */

/** One image or video attached to a product. `url` is relative to the backend origin. */
export type ShopMedia = {
  id: string;
  url: string;
  type: 'image' | 'video';
};

/** A sellable product as exposed by GET /api/shop/products (no cost/supplier data). */
export type ShopProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  category: string;
  brand: string | null;
  inStock: number;
  tag?: string | null;
  media: ShopMedia[];
  gift: GiftAttributes;
};

/** Public branding as exposed by GET /api/brand. */
export type ShopBrand = {
  appName: string;
  brandInitial: string;
  accentColor: string;
  tagline: string;
  currency: string;
  phone: string;
  whatsapp: string;
  address: string;
};

/* ---------------------------------------------------------------- gift finder */

/** Occasions the admin can tag a product with and users can filter by. */
export const GIFT_OCCASIONS = [
  'birthday',
  'wedding',
  'anniversary',
  'valentines',
  'baby-shower',
  'housewarming',
  'graduation',
  'festival',
  'farewell',
  'thank-you',
] as const;
export type GiftOccasion = (typeof GIFT_OCCASIONS)[number];

/** Who the gift is for. */
export const GIFT_RECIPIENTS = ['men', 'women', 'kids', 'anyone'] as const;
export type GiftRecipient = (typeof GIFT_RECIPIENTS)[number];

/** Common gift categories offered as quick filters (admin can also type custom ones). */
export const GIFT_TYPES = [
  'watch',
  'perfume',
  'photo-frame',
  'wallet',
  'jewelry',
  'toys',
  'home-decor',
  'electronics',
  'apparel',
  'stationery',
  'mug',
  'chocolates',
] as const;

/** Gift attributes attached to a ShopProduct (empty arrays = not tagged for gifting). */
export type GiftAttributes = {
  occasions: string[];
  recipients: string[];
  ageMin: number | null;
  ageMax: number | null;
  types: string[];
  interests: string[];
};

/** What the storefront sends to GET /api/shop/gift-finder (all fields optional). */
export type GiftQuery = {
  occasion?: string;
  recipient?: string;
  age?: number;
  types?: string[];
  likes?: string; // free text, e.g. "cricket, music"
  minPrice?: number;
  maxPrice?: number;
};

/**
 * A structured, translatable reason a product matched. The storefront renders
 * each with its own i18n dictionary (see apps/storefront/src/i18n) so reasons
 * appear in the user's language — never build these as English sentences.
 *   - `value` on `occasion`/`recipient` is the enum key (e.g. "birthday").
 *   - `value` on `type` is a comma-joined list of gift-type keys.
 *   - `value` on `interests` is the user's own free text (shown as-is).
 */
export type GiftReason =
  | { code: 'occasion'; value: string }
  | { code: 'recipient-kids' }
  | { code: 'recipient'; value: string }
  | { code: 'anyone' }
  | { code: 'age' }
  | { code: 'type'; value: string }
  | { code: 'interests'; value: string }
  | { code: 'idea' };

/** One ranked result from the gift finder. */
export type GiftMatch = {
  product: ShopProduct;
  score: number;
  reasons: GiftReason[];
};

/* ----------------------------------------------------- discover feed + events */

/** A compact related-product suggestion shown in the reels feed ("More like this"). */
export type FeedRelated = { id: string; name: string; price: number; thumb: string | null };

/** A product in the Discover reels feed: full product + social counts + related. */
export type FeedProduct = ShopProduct & {
  likes: number;
  shares: number;
  related: FeedRelated[];
};

/** GET /api/shop/feed response (cursor pagination; `nextCursor` null = end). */
export type FeedResponse = { items: FeedProduct[]; nextCursor: string | null };

/** Engagement events the storefront records via POST /api/shop/events. */
export const PRODUCT_EVENT_TYPES = ['view', 'like', 'unlike', 'share', 'buy', 'open'] as const;
export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];
export type ProductEventInput = { productId: string; type: ProductEventType; sessionId?: string };

/** Per-product engagement rollup for the admin Engagement page. */
export type EngagementRow = {
  id: string;
  name: string;
  category: string;
  views: number;
  likes: number;
  shares: number;
  buys: number;
  score: number;
};
export type EngagementSummary = {
  totals: { views: number; likes: number; shares: number; buys: number; sessions: number };
  products: EngagementRow[];
};

/** Turn a CSV column into a clean lowercase list. */
export const csvToList = (s: string | null | undefined): string[] =>
  (s ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

export const DEFAULT_BRAND: ShopBrand = {
  appName: 'Shop',
  brandInitial: 'S',
  accentColor: '#2f9e8f',
  tagline: 'Local store',
  currency: '₹',
  phone: '',
  whatsapp: '',
  address: '',
};

/**
 * Format an amount with the shop's currency symbol using Indian digit grouping
 * (lakh/crore), e.g. money("₹", 125000) → "₹1,25,000.00".
 */
export const money = (currency: string, amount: number): string =>
  currency +
  (amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Up to two initials from a name, for avatar/thumbnail placeholders. */
export const initials = (name: string): string =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
