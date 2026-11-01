/**
 * Demo product photos, keyed by stable seed product ID (never by name or list position).
 * Files live in apps/stockwell/public/seed/ and are served at /seed/<file>.
 *
 * Every file here must be a photo of that kind of product, free of watermarks and logos,
 * licensed for commercial use, and recorded in docs/MEDIA.md → "Seed media licence record"
 * (a test enforces the record). Extra photos (`-b`, `-c`) are only added when they are
 * genuinely different shots of the *same* item (same photographer, same object); a photo
 * of a different item would make the gallery lie about the product. Never duplicate or
 * re-crop a photo to pad the gallery.
 *
 * Products not listed have no verified photo yet and show the storefront placeholder.
 */
export const SEED_MEDIA: Record<string, { file: string; type: 'image' | 'video' }[]> = {
  p5: [{ file: 'p5-a.jpg', type: 'image' }], // Assorted Chocolate Hamper
  p9: [{ file: 'p9-a.jpg', type: 'image' }], // Minimalist Wall Clock
  p11: [{ file: 'p11-a.jpg', type: 'image' }], // Leather-bound Journal
  p12: [{ file: 'p12-a.jpg', type: 'image' }], // Ceramic Succulent Planter
  p13: [{ file: 'p13-a.jpg', type: 'image' }], // Silk Greeting Card Set
  p14: [{ file: 'p14-a.jpg', type: 'image' }], // Analog Wrist Watch
  p15: [{ file: 'p15-a.jpg', type: 'image' }], // Scented Reed Diffuser
  p16: [{ file: 'p16-a.jpg', type: 'image' }], // Silver Pendant Necklace
  // Wooden Chess Set: one set and board in one studio series: 3/4 angle, side, empty board.
  p18: [
    { file: 'p18-a.jpg', type: 'image' },
    { file: 'p18-b.jpg', type: 'image' },
    { file: 'p18-c.jpg', type: 'image' },
  ],
};

/** product_media rows for the given seed product IDs, in gallery order (first = cover). */
export const seedMediaRows = (productIds: string[]) =>
  productIds.flatMap((productId) =>
    (SEED_MEDIA[productId] ?? []).map((m, i) => ({
      id: `${productId}m${i + 1}`,
      productId,
      url: `/seed/${m.file}`,
      type: m.type,
      sortOrder: i,
    })),
  );
