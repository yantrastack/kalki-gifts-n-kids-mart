import { MIN_PHOTO_SIDE } from '@stockwell/shared';

/*
 * Product media rules (YAN-109), shared by the admin upload controls (browser) and
 * POST /api/products/[id]/media (server), so both accept and reject the same files.
 * Pure: no Node or DOM imports.
 */

/** Photo formats accepted for upload. GIF is no longer accepted (animated, low quality). */
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export const UPLOAD_ACCEPT = [...PHOTO_TYPES, ...VIDEO_TYPES].join(',');
/** File-picker `accept` for a single type — used by the per-type replace pickers. */
export const PHOTO_ACCEPT = PHOTO_TYPES.join(',');
export const VIDEO_ACCEPT = VIDEO_TYPES.join(',');

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
/** Most photos / videos one product can have. */
export const MAX_PRODUCT_PHOTOS = 10;
export const MAX_PRODUCT_VIDEOS = 3;
export const maxFor = (kind: 'image' | 'video') =>
  kind === 'video' ? MAX_PRODUCT_VIDEOS : MAX_PRODUCT_PHOTOS;

const EXT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};
const ACCEPTED = new Set<string>([...PHOTO_TYPES, ...VIDEO_TYPES]);

/** Declared type of a file, falling back to its extension (some clients send octet-stream). */
export function declaredType(f: { type: string; name: string }): string | null {
  if (ACCEPTED.has(f.type)) return f.type;
  const dot = f.name.lastIndexOf('.');
  return dot >= 0 ? (EXT_TYPES[f.name.slice(dot).toLowerCase()] ?? null) : null;
}

export type ImageInfo = { mime: (typeof PHOTO_TYPES)[number]; width: number; height: number };

/**
 * Real format and pixel size of a JPEG, PNG or WebP, read from the file's own header
 * (not its name), or null when the bytes are not one of those images.
 */
export function readImageInfo(b: Uint8Array): ImageInfo | null {
  const u16be = (i: number) => (b[i] << 8) | b[i + 1];
  const u32be = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

  // PNG: signature, then the IHDR chunk with width/height.
  if (b.length >= 24 && u32be(0) === 0x89504e47 && u32be(4) === 0x0d0a1a0a) {
    if (ascii(12, 4) !== 'IHDR') return null;
    return { mime: 'image/png', width: u32be(16), height: u32be(20) };
  }

  // JPEG: walk the segments to the first start-of-frame marker.
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker === 0xff) {
        i++; // fill byte
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2; // markers without a length
        continue;
      }
      // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
        return { mime: 'image/jpeg', width: u16be(i + 7), height: u16be(i + 5) };
      if (marker === 0xd9 || marker === 0xda) return null; // end / scan before any frame
      i += 2 + u16be(i + 2);
    }
    return null;
  }

  // WebP: RIFF container with a VP8 (lossy), VP8L (lossless) or VP8X (extended) chunk.
  if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a)
      return {
        mime: 'image/webp',
        width: (b[26] | (b[27] << 8)) & 0x3fff,
        height: (b[28] | (b[29] << 8)) & 0x3fff,
      };
    if (chunk === 'VP8L' && b[20] === 0x2f) {
      const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return {
        mime: 'image/webp',
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === 'VP8X')
      return { mime: 'image/webp', width: u24le(24) + 1, height: u24le(27) + 1 };
    return null;
  }
  return null;
}

/** Why a file can't be uploaded. Each code has a translated message in the admin. */
export type MediaProblem =
  | { code: 'unsupported'; name: string }
  | { code: 'tooLarge'; name: string; limitMb: number }
  | { code: 'notAnImage'; name: string }
  | { code: 'tooSmall'; name: string; width: number; height: number; min: number }
  | { code: 'typeMismatch'; name: string; expected: 'image' | 'video' }
  | { code: 'tooManyVideos'; name: string; max: number }
  | { code: 'tooManyPhotos'; name: string; max: number }
  | { code: 'storage'; name: string }
  | { code: 'network'; name: string };

// Flat (not a union): this app compiles without strictNullChecks, where `!res.ok` doesn't narrow.
export type MediaCheck = {
  ok: boolean;
  mime?: string;
  kind?: 'image' | 'video';
  problem?: MediaProblem;
};

/**
 * Format and size-per-type check only (no bytes). Used before a direct-to-storage upload
 * is allowed to start, and as the first step of checkMediaFile.
 */
export function checkTypeAndSize(f: { name: string; type: string; size: number }): MediaCheck {
  const declared = declaredType(f);
  if (!declared) return { ok: false, problem: { code: 'unsupported', name: f.name } };
  const kind = declared.startsWith('video/') ? 'video' : 'image';
  const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
  if (!(f.size > 0) || f.size > limit)
    return {
      ok: false,
      problem:
        f.size > limit
          ? { code: 'tooLarge', name: f.name, limitMb: limit >> 20 }
          : { code: 'unsupported', name: f.name },
    };
  return { ok: true, mime: declared, kind };
}

/** Storage formats (as Cloudinary reports them) allowed for each media type. */
export const STORED_FORMATS = {
  image: ['jpg', 'jpeg', 'png', 'webp'],
  video: ['mp4', 'mov', 'webm'],
} as const;

/**
 * Checks a file that the browser already uploaded straight to storage (Cloudinary), from
 * the facts storage reported back: format, size and, for photos, pixel size. Same limits
 * as checkMediaFile, so a direct upload can't get around them.
 */
export function checkStoredMedia(s: {
  name: string;
  kind: 'image' | 'video';
  format: string;
  bytes: number;
  width?: number | null;
  height?: number | null;
}): MediaCheck {
  const formats: readonly string[] = STORED_FORMATS[s.kind];
  if (!formats.includes(String(s.format).toLowerCase()))
    return { ok: false, problem: { code: 'unsupported', name: s.name } };
  const limit = s.kind === 'video' ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
  if (!(s.bytes > 0) || s.bytes > limit)
    return { ok: false, problem: { code: 'tooLarge', name: s.name, limitMb: limit >> 20 } };
  if (s.kind === 'image') {
    const w = Number(s.width) || 0;
    const h = Number(s.height) || 0;
    if (!w || !h) return { ok: false, problem: { code: 'notAnImage', name: s.name } };
    if (Math.min(w, h) < MIN_PHOTO_SIDE)
      return {
        ok: false,
        problem: { code: 'tooSmall', name: s.name, width: w, height: h, min: MIN_PHOTO_SIDE },
      };
  }
  return { ok: true, kind: s.kind };
}

/**
 * Checks one file for upload: format, size per type, and for photos that the bytes are a
 * real JPEG/PNG/WebP (so a renamed file is caught) at least MIN_PHOTO_SIDE px on its short
 * side. `bytes` is the file content (photos only; pass null for videos).
 */
export function checkMediaFile(
  f: { name: string; type: string; size: number },
  bytes: Uint8Array | null,
): MediaCheck {
  const head = checkTypeAndSize(f);
  if (!head.ok || head.kind === 'video') return head;
  const info = bytes ? readImageInfo(bytes) : null;
  if (!info) return { ok: false, problem: { code: 'notAnImage', name: f.name } };
  if (Math.min(info.width, info.height) < MIN_PHOTO_SIDE)
    return {
      ok: false,
      problem: {
        code: 'tooSmall',
        name: f.name,
        width: info.width,
        height: info.height,
        min: MIN_PHOTO_SIDE,
      },
    };
  // Store with the type the bytes really are (a PNG renamed to .jpg is still a PNG).
  return { ok: true, mime: info.mime, kind: 'image' };
}

/**
 * Validates a reorder request for a product's media: `order` must list each of the
 * product's media ids exactly once. Ids from another product, duplicates or gaps are
 * rejected, so a stale or tampered list can't drop or steal media.
 */
export function checkReorder(
  existingIds: string[],
  order: unknown,
): { ok: boolean; order?: string[]; error?: string } {
  if (!Array.isArray(order) || !order.every((x) => typeof x === 'string'))
    return { ok: false, error: 'order must be a list of media ids' };
  const known = new Set(existingIds);
  const seen = new Set<string>();
  for (const id of order as string[]) {
    if (!known.has(id)) return { ok: false, error: `Media ${id} does not belong to this product` };
    if (seen.has(id)) return { ok: false, error: `Media ${id} is listed twice` };
    seen.add(id);
  }
  if (seen.size !== known.size)
    return { ok: false, error: 'order must list every media item of this product' };
  return { ok: true, order: order as string[] };
}

/**
 * Moves an item inside one section (Photos or Videos) of a mixed, ordered media list.
 * `from`/`to` are positions among items of `kind` only; items of the other kind keep their
 * places. Photo position 0 is the cover, so "Set as cover" = move a photo to 0.
 */
export function moveWithinKind<T extends { type: string }>(
  list: T[],
  kind: 'image' | 'video',
  from: number,
  to: number,
): T[] {
  const slots: number[] = [];
  list.forEach((m, i) => {
    if ((m.type === 'video' ? 'video' : 'image') === kind) slots.push(i);
  });
  const moved = moveItem(
    slots.map((i) => list[i]),
    from,
    to,
  );
  if (moved.every((m, j) => m === list[slots[j]])) return list;
  const next = [...list];
  slots.forEach((slot, j) => {
    next[slot] = moved[j];
  });
  // The cover is the first photo overall: keep it ahead of any video.
  if (kind === 'image' && slots.length && moved[0] !== list[slots[0]]) {
    const cover = next.indexOf(moved[0]);
    if (cover > 0) return moveItem(next, cover, 0);
  }
  return next;
}

/** `list` with the item at `from` moved to `to` (both clamped). "Set as cover" = move to 0. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/**
 * Keeps at most maxFor(kind) photos or videos per product: `have` already exist, so only
 * the first few of `files` fit. The rest come back as `tooManyPhotos` / `tooManyVideos` problems.
 */
export function limitMedia<T extends { name: string }>(
  kind: 'image' | 'video',
  have: number,
  files: T[],
): { accepted: T[]; problems: MediaProblem[] } {
  const max = maxFor(kind);
  const room = Math.max(0, max - have);
  const code = kind === 'video' ? ('tooManyVideos' as const) : ('tooManyPhotos' as const);
  return {
    accepted: files.slice(0, room),
    problems: files.slice(room).map((f) => ({ code, name: f.name, max })),
  };
}
