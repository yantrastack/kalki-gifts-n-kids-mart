import { MIN_PHOTO_SIDE, photoCount } from '@stockwell/shared';
import { describe, expect, it } from 'vitest';
import {
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  checkMediaFile,
  checkReorder,
  moveItem,
  readImageInfo,
} from './mediaRules';
import { fakeJpeg, fakePng, fakeWebpVp8x, text } from './testImages';

// YAN-109: product photo rules (format, size, resolution) and media reordering.

describe('readImageInfo', () => {
  it('reads PNG, JPEG and WebP sizes from the file bytes', () => {
    expect(readImageInfo(fakePng(1200, 900))).toEqual({
      mime: 'image/png',
      width: 1200,
      height: 900,
    });
    expect(readImageInfo(fakeJpeg(1600, 1000))).toEqual({
      mime: 'image/jpeg',
      width: 1600,
      height: 1000,
    });
    expect(readImageInfo(fakeWebpVp8x(1000, 1000))).toEqual({
      mime: 'image/webp',
      width: 1000,
      height: 1000,
    });
  });

  it('returns null for bytes that are not an image', () => {
    expect(readImageInfo(text('hello, I am a text file'))).toBeNull();
    expect(readImageInfo(new Uint8Array(0))).toBeNull();
    expect(readImageInfo(text('GIF89a........'))).toBeNull();
  });
});

describe('checkMediaFile', () => {
  const photo = (name: string, bytes: Uint8Array, type = 'image/jpeg', size = bytes.length) => ({
    file: { name, type, size },
    bytes,
  });

  it('accepts a big enough JPG/PNG/WebP photo', () => {
    for (const { file, bytes } of [
      photo('a.jpg', fakeJpeg(1200, 800)),
      photo('b.png', fakePng(800, 800), 'image/png'),
      photo('c.webp', fakeWebpVp8x(900, 1600), 'image/webp'),
    ])
      expect(checkMediaFile(file, bytes)).toMatchObject({ ok: true, kind: 'image' });
  });

  it('rejects a photo smaller than the minimum on its short side', () => {
    const { file, bytes } = photo('small.jpg', fakeJpeg(1920, MIN_PHOTO_SIDE - 1));
    expect(checkMediaFile(file, bytes)).toEqual({
      ok: false,
      problem: {
        code: 'tooSmall',
        name: 'small.jpg',
        width: 1920,
        height: MIN_PHOTO_SIDE - 1,
        min: MIN_PHOTO_SIDE,
      },
    });
  });

  it('rejects a renamed file whose bytes are not an image', () => {
    const { file, bytes } = photo('notes.jpg', text('just some text'));
    expect(checkMediaFile(file, bytes).problem?.code).toBe('notAnImage');
  });

  it('stores a photo with the type its bytes really are', () => {
    const { file, bytes } = photo('really-a-png.jpg', fakePng(1000, 1000), 'image/jpeg');
    expect(checkMediaFile(file, bytes)).toMatchObject({ ok: true, mime: 'image/png' });
  });

  it('rejects GIFs and other formats', () => {
    expect(checkMediaFile({ name: 'a.gif', type: 'image/gif', size: 10 }, null).problem?.code).toBe(
      'unsupported',
    );
    expect(
      checkMediaFile({ name: 'a.pdf', type: 'application/pdf', size: 10 }, null).problem?.code,
    ).toBe('unsupported');
  });

  it('applies a size limit per type', () => {
    const big = checkMediaFile(
      { name: 'big.jpg', type: 'image/jpeg', size: MAX_PHOTO_BYTES + 1 },
      fakeJpeg(1000, 1000),
    );
    expect(big.problem).toEqual({ code: 'tooLarge', name: 'big.jpg', limitMb: 10 });
    expect(
      checkMediaFile({ name: 'v.mp4', type: 'video/mp4', size: MAX_PHOTO_BYTES + 1 }, null),
    ).toMatchObject({ ok: true, kind: 'video' });
    expect(
      checkMediaFile({ name: 'v.mp4', type: 'video/mp4', size: MAX_VIDEO_BYTES + 1 }, null).problem
        ?.code,
    ).toBe('tooLarge');
  });

  it('falls back to the extension when the browser sends octet-stream', () => {
    expect(
      checkMediaFile({ name: 'clip.MOV', type: 'application/octet-stream', size: 10 }, null),
    ).toMatchObject({ ok: true, mime: 'video/quicktime' });
  });
});

describe('checkReorder', () => {
  const ids = ['m1', 'm2', 'm3'];

  it('accepts every id exactly once', () => {
    expect(checkReorder(ids, ['m3', 'm1', 'm2'])).toEqual({ ok: true, order: ['m3', 'm1', 'm2'] });
  });

  it('rejects an id from another product', () => {
    expect(checkReorder(ids, ['m1', 'm2', 'other']).ok).toBe(false);
  });

  it('rejects duplicates, missing ids and bad input', () => {
    expect(checkReorder(ids, ['m1', 'm1', 'm2']).ok).toBe(false);
    expect(checkReorder(ids, ['m1', 'm2']).ok).toBe(false);
    expect(checkReorder(ids, 'm1,m2,m3').ok).toBe(false);
    expect(checkReorder(ids, undefined).ok).toBe(false);
  });
});

describe('moveItem (drag, ← / → buttons, Set as cover)', () => {
  it('moves an item and keeps the rest in order', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 2, 0)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });

  it('clamps the target and ignores no-op moves', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 1, 5)).toBe(list);
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 4, 0)).toBe(list);
  });
});

describe('photoCount', () => {
  it('counts photos, not videos', () => {
    expect(photoCount([{ type: 'image' }, { type: 'video' }, { type: 'image' }])).toBe(2);
  });
});
