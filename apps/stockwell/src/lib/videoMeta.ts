/*
 * Video metadata for product media (YAN-108): duration, display size and whether the
 * video has an audio track. Pure (no Node or DOM imports), so the admin browser and the
 * upload API read MP4/MOV files the same way.
 */

export type VideoMeta = {
  durationS: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean | null;
};

export const EMPTY_VIDEO_META: VideoMeta = {
  durationS: null,
  width: null,
  height: null,
  hasAudio: null,
};

const u32 = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u64 = (b: Uint8Array, i: number) => u32(b, i) * 2 ** 32 + u32(b, i + 4);
const s32 = (b: Uint8Array, i: number) => u32(b, i) | 0;
const fourcc = (b: Uint8Array, i: number) =>
  String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

type Box = { type: string; start: number; body: number; end: number };

/** The boxes directly inside `[from, to)` of an ISO-BMFF (MP4/MOV) byte range. */
function boxes(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let i = from;
  while (i + 8 <= to) {
    let size = u32(b, i);
    let header = 8;
    if (size === 1) {
      if (i + 16 > to) break;
      size = u64(b, i + 8);
      header = 16;
    } else if (size === 0) size = to - i; // runs to the end of its parent
    if (size < header || i + size > to) break; // truncated or corrupt: stop, keep what we have
    out.push({ type: fourcc(b, i + 4), start: i, body: i + header, end: i + size });
    i += size;
  }
  return out;
}

const child = (b: Uint8Array, parent: Box, type: string) =>
  boxes(b, parent.body, parent.end).find((x) => x.type === type);

/**
 * Reads a `moov` box (or a whole MP4/MOV file that contains one). Returns null when the
 * bytes are not an MP4/MOV with a movie header.
 */
export function readMp4Info(b: Uint8Array): VideoMeta | null {
  const top = boxes(b, 0, b.length);
  const moov = top.find((x) => x.type === 'moov');
  if (!moov) return null;

  const meta: VideoMeta = { ...EMPTY_VIDEO_META, hasAudio: false };
  const mvhd = child(b, moov, 'mvhd');
  if (mvhd && mvhd.body + 32 <= mvhd.end) {
    const c = mvhd.body;
    const v1 = b[c] === 1;
    const timescale = v1 ? u32(b, c + 20) : u32(b, c + 12);
    const duration = v1 ? u64(b, c + 24) : u32(b, c + 16);
    if (timescale > 0 && duration > 0)
      meta.durationS = Math.round((duration / timescale) * 100) / 100;
  }

  for (const trak of boxes(b, moov.body, moov.end).filter((x) => x.type === 'trak')) {
    const mdia = child(b, trak, 'mdia');
    const hdlr = mdia && child(b, mdia, 'hdlr');
    if (!hdlr || hdlr.body + 12 > hdlr.end) continue;
    const handler = fourcc(b, hdlr.body + 8);
    if (handler === 'soun') meta.hasAudio = true;
    if (handler !== 'vide' || meta.width != null) continue;

    const tkhd = child(b, trak, 'tkhd');
    if (!tkhd) continue;
    const c = tkhd.body;
    const v1 = b[c] === 1;
    const matrix = c + (v1 ? 52 : 40);
    const dims = c + (v1 ? 88 : 76);
    if (dims + 8 > tkhd.end) continue;
    let w = Math.round(u32(b, dims) / 65536);
    let h = Math.round(u32(b, dims + 4) / 65536);
    // A phone video recorded upright is stored sideways with a 90° rotation matrix.
    if (s32(b, matrix) === 0 && s32(b, matrix + 4) !== 0) [w, h] = [h, w];
    if (w > 0 && h > 0) {
      meta.width = w;
      meta.height = h;
    }
  }
  return meta;
}

/** Largest `moov` box read from a file (it only holds sample tables, normally < 5 MB). */
const MAX_MOOV_BYTES = 32 * 1024 * 1024;

/**
 * Same as readMp4Info, but reads only the box headers and the `moov` box through
 * `read(offset, length)`, so a 50 MB video isn't loaded whole (the browser passes a
 * `File.slice` reader).
 */
export async function readMp4InfoFrom(
  size: number,
  read: (offset: number, length: number) => Promise<Uint8Array>,
): Promise<VideoMeta | null> {
  let i = 0;
  for (let n = 0; n < 64 && i + 8 <= size; n++) {
    const head = await read(i, 16);
    if (head.length < 8) return null;
    let boxSize = u32(head, 0);
    if (boxSize === 1) {
      if (head.length < 16) return null;
      boxSize = u64(head, 8);
    } else if (boxSize === 0) boxSize = size - i;
    if (boxSize < 8) return null;
    if (fourcc(head, 4) === 'moov') {
      if (boxSize > MAX_MOOV_BYTES || i + boxSize > size) return null;
      return readMp4Info(await read(i, boxSize));
    }
    i += boxSize;
  }
  return null;
}

/** Longest video we keep metadata for; anything longer is treated as unknown. */
const MAX_SECONDS = 24 * 60 * 60;
const MAX_SIDE = 16384;

/**
 * Checks client-supplied metadata (from the admin browser or Cloudinary's upload
 * response): each field must be a sane number/boolean, otherwise it is dropped (null).
 */
export function cleanVideoMeta(input: unknown): VideoMeta {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const num = (v: unknown, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : null;
  const side = (v: unknown) => {
    const n = num(v, MAX_SIDE);
    return n == null ? null : Math.round(n);
  };
  const d = num(o.durationS, MAX_SECONDS);
  return {
    durationS: d == null ? null : Math.round(d * 100) / 100,
    width: side(o.width),
    height: side(o.height),
    hasAudio: typeof o.hasAudio === 'boolean' ? o.hasAudio : null,
  };
}

/** Fills the gaps in `primary` from `fallback` (e.g. file header first, then Cloudinary). */
export function mergeVideoMeta(primary: VideoMeta, fallback: VideoMeta): VideoMeta {
  return {
    durationS: primary.durationS ?? fallback.durationS,
    width: primary.width ?? fallback.width,
    height: primary.height ?? fallback.height,
    hasAudio: primary.hasAudio ?? fallback.hasAudio,
  };
}
