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
