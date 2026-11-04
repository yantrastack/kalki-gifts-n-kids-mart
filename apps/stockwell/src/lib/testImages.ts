// Test helpers (YAN-109): minimal image file headers for the media upload rules.

/** Minimal file headers: just enough bytes for the format and pixel size. */
export const fakePng = (w: number, h: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};
export const fakeJpeg = (w: number, h: number) => {
  // SOI, an APP0 segment (length 16) to skip, then SOF0 with height/width.
  const b = new Uint8Array(2 + 18 + 19);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
  b.set([0xff, 0xc0, 0, 17, 8], 20);
  new DataView(b.buffer).setUint16(25, h);
  new DataView(b.buffer).setUint16(27, w);
  return b;
};
export const fakeWebpVp8x = (w: number, h: number) => {
  const b = new Uint8Array(30);
  b.set(
    [...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
  );
  b.set(
    [...'WEBPVP8X'].map((c) => c.charCodeAt(0)),
    8,
  );
  const put24 = (i: number, v: number) => b.set([v & 255, (v >> 8) & 255, (v >> 16) & 255], i);
  put24(24, w - 1);
  put24(27, h - 1);
  return b;
};
export const text = (s: string) => new TextEncoder().encode(s);

/* YAN-108: a minimal MP4/MOV (ftyp, mdat, moov with one video and optionally one audio track). */

const box = (type: string, ...parts: Uint8Array[]) => {
  const size = 8 + parts.reduce((n, p) => n + p.length, 0);
  const b = new Uint8Array(size);
  new DataView(b.buffer).setUint32(0, size);
  b.set(new TextEncoder().encode(type), 4);
  let i = 8;
  for (const p of parts) {
    b.set(p, i);
    i += p.length;
  }
  return b;
};

const hdlr = (handler: 'vide' | 'soun') => {
  const c = new Uint8Array(25);
  c.set(new TextEncoder().encode(handler), 8);
  return box('hdlr', c);
};

export const fakeMp4 = ({
  durationS = 12.5,
  width = 1080,
  height = 1920,
  audio = true,
  rotated = false,
  moovFirst = true,
  mdatBytes = 64,
}: {
  durationS?: number;
  width?: number;
  height?: number;
  audio?: boolean;
  /** Stored sideways with a 90° matrix, like an upright phone recording. */
  rotated?: boolean;
  moovFirst?: boolean;
  mdatBytes?: number;
} = {}) => {
  const mvhd = new Uint8Array(100);
  const mv = new DataView(mvhd.buffer);
  mv.setUint32(12, 1000); // timescale
  mv.setUint32(16, Math.round(durationS * 1000)); // duration

  const tkhd = new Uint8Array(84);
  const tk = new DataView(tkhd.buffer);
  // Matrix: identity, or 90° (a=0, b=1, c=-1, d=0) in 16.16 fixed point.
  const [a, b, c, d] = rotated ? [0, 0x10000, -0x10000, 0] : [0x10000, 0, 0, 0x10000];
  tk.setInt32(40, a);
  tk.setInt32(44, b);
  tk.setInt32(52, c);
  tk.setInt32(56, d);
  // A rotated file stores the sensor size (landscape); the display size is swapped.
  tk.setUint32(76, (rotated ? height : width) * 65536);
  tk.setUint32(80, (rotated ? width : height) * 65536);

  const video = box('trak', box('tkhd', tkhd), box('mdia', hdlr('vide')));
  const sound = box('trak', box('tkhd', new Uint8Array(84)), box('mdia', hdlr('soun')));
  const moov = box('moov', box('mvhd', mvhd), video, ...(audio ? [sound] : []));
  const ftyp = box('ftyp', new TextEncoder().encode('isom\0\0\0\0isommp41'));
  const mdat = box('mdat', new Uint8Array(mdatBytes));
  const parts = moovFirst ? [ftyp, moov, mdat] : [ftyp, mdat, moov];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};
