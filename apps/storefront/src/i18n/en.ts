/**
 * English strings for the storefront. This is the source-of-truth dictionary:
 * every other language (see te.ts) is typed against `Dict` so missing keys are
 * caught at compile time. Use `{name}` placeholders for interpolation and the
 * `_one`/`_other` suffix convention for count-sensitive strings.
 */
export const en = {
  lang: { label: 'Language', english: 'English', telugu: 'తెలుగు' },

  common: {
    retry: 'Retry',
    search: 'Search products',
    all: 'All',
    viewCart: 'View cart',
  },

  header: {
    cart: 'Your cart',
    findGift: 'Find a gift',
  },

  error: {
    unreachable: "Couldn't reach the shop. Please try again.",
  },

  home: {
    giftBannerTitle: 'Find the perfect gift',
    giftBannerSub: "Birthday, wedding, valentine's & more",
    noResults: 'No products found',
    noResultsSub: 'Try a different search or category.',
  },

  card: {
    onlyLeft: 'Only {count} left',
  },

  product: {
    inStock: 'In stock',
    onlyLeft: 'Only {count} left',
    sku: 'SKU',
    pickup: 'Pickup',
    atShop: 'At the shop',
    payment: 'Payment',
    payAtShop: 'Pay at the shop — no online payment',
    callShop: 'Call shop',
    whatsapp: 'WhatsApp',
    addToCart: 'Add to cart',
  },

  cart: {
    empty: 'Your cart is empty',
    emptySub: 'Browse the shop and add something you like.',
    browse: 'Browse products',
    items_one: '{count} item',
    items_other: '{count} items',
    orderWhatsapp: 'Order on WhatsApp',
    callToOrder: 'Call to order',
    payNote: 'No online payment — pay when you collect at the shop.',
  },

  reels: {
    title: 'Discover',
    buy: 'Buy',
    details: 'Details',
    addToCart: 'Add to cart',
    related: 'More like this',
  },

  gift: {
    title: 'Find a gift',
    intro: "Not sure what to gift? Tell us a little about them and we'll suggest something.",
    occasionQ: "What's the occasion?",
    recipientQ: 'Who is it for?',
    ageQ: 'Their age (optional)',
    agePlaceholder: 'e.g. 8',
    likesQ: 'What do they like? (optional)',
    likesPlaceholder: 'music, sports, cooking…',
    typeQ: 'Gift type (pick any)',
    budgetQ: 'Budget (optional)',
    min: 'Min',
    max: 'Max',
    find: 'Find gifts',
    refine: 'Refine filters',
    resultsCount_one: '{count} gift idea for you',
    resultsCount_other: '{count} gift ideas for you',
    noMatches: 'No matches yet',
    noMatchesSub: 'Try fewer filters, or a wider budget.',
    searchError: "Couldn't search right now — try again.",

    occasion: {
      birthday: 'Birthday',
      wedding: 'Wedding',
      anniversary: 'Anniversary',
      valentines: "Valentine's",
      'baby-shower': 'Baby Shower',
      housewarming: 'Housewarming',
      graduation: 'Graduation',
      festival: 'Festival',
      farewell: 'Farewell',
      'thank-you': 'Thank You',
    },
    recipient: { men: 'Men', women: 'Women', kids: 'Kids', anyone: 'Anyone' },
    type: {
      watch: 'Watch',
      perfume: 'Perfume',
      'photo-frame': 'Photo Frame',
      wallet: 'Wallet',
      jewelry: 'Jewelry',
      toys: 'Toys',
      'home-decor': 'Home Decor',
      electronics: 'Electronics',
      apparel: 'Apparel',
      stationery: 'Stationery',
      mug: 'Mug',
      chocolates: 'Chocolates',
    },
    reason: {
      occasion: 'Great for {occasion}',
      'recipient-kids': 'Made for kids',
      recipient: 'Popular with {recipient}',
      anyone: 'Works for anyone',
      age: 'Right age group',
      type: "It's a {types}",
      interests: 'Matches "{interests}"',
      idea: 'Gift idea',
    },
  },
};

export type Dict = typeof en;
