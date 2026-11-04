import { describe, expect, it } from 'vitest';
import { toShopMedia } from '@stockwell/shared';
import {
  cleanVideoMeta,
  mergeVideoMeta,
  readMp4Info,
  readMp4InfoFrom,
  EMPTY_VIDEO_META,
} from './videoMeta';
import {
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  checkStoredMedia,
  checkTypeAndSize,
  moveWithinKind,
} from './mediaRules';
import { fakeMp4, text } from './testImages';
import { storedAudioPresence } from '../../../storefront/src/components/videoAudio';

// YAN-108: product video upload — metadata, validation limits and the public media mapper.

describe('readMp4Info (MP4/MOV header)', () => {
  it('reads duration, display size and the audio track', () => {
    expect(readMp4Info(fakeMp4({ durationS: 12.5, width: 1080, height: 1920 }))).toEqual({
      durationS: 12.5,
      width: 1080,
      height: 1920,
      hasAudio: true,
    });
  });

  it('reports hasAudio=false for a video with no sound track', () => {
    expect(readMp4Info(fakeMp4({ audio: false }))?.hasAudio).toBe(false);
  });

  it('swaps width/height for an upright phone recording (90° matrix)', () => {
    const m = readMp4Info(fakeMp4({ width: 720, height: 1280, rotated: true }));
    expect([m?.width, m?.height]).toEqual([720, 1280]);
  });

  it('finds moov after a large mdat, and reads only headers + moov from a reader', async () => {
    const bytes = fakeMp4({ moovFirst: false, mdatBytes: 200_000, durationS: 30 });
    const reads: number[] = [];
    const meta = await readMp4InfoFrom(bytes.length, async (o, n) => {
      reads.push(n);
      return bytes.subarray(o, o + n);
    });
    expect(meta).toMatchObject({ durationS: 30, hasAudio: true });
    // Never asked for the media data itself.
    expect(Math.max(...reads)).toBeLessThan(10_000);
  });

  it('returns null for something that is not an MP4/MOV', async () => {
    expect(readMp4Info(text('definitely not a video'))).toBeNull();
    const junk = text('webm-ish bytes that are not ISO BMFF');
    expect(await readMp4InfoFrom(junk.length, async (o, n) => junk.subarray(o, o + n))).toBeNull();
  });

  it('survives a truncated file', () => {
    const full = fakeMp4();
    expect(() => readMp4Info(full.subarray(0, full.length - 40))).not.toThrow();
  });
});

describe('cleanVideoMeta / mergeVideoMeta', () => {
  it('keeps sane values and drops junk', () => {
    expect(
      cleanVideoMeta({ durationS: 9.876, width: 1080.4, height: 1920, hasAudio: false }),
    ).toEqual({
      durationS: 9.88,
      width: 1080,
      height: 1920,
      hasAudio: false,
    });
    expect(cleanVideoMeta({ durationS: -1, width: 'big', height: 1e9, hasAudio: 'yes' })).toEqual(
      EMPTY_VIDEO_META,
    );
    expect(cleanVideoMeta(null)).toEqual(EMPTY_VIDEO_META);
    expect(cleanVideoMeta({ durationS: Number.NaN }).durationS).toBeNull();
  });

  it('fills only the gaps from the fallback', () => {
    expect(
      mergeVideoMeta(
        { durationS: 5, width: null, height: null, hasAudio: false },
        { durationS: 99, width: 640, height: 360, hasAudio: true },
      ),
    ).toEqual({ durationS: 5, width: 640, height: 360, hasAudio: false });
  });
});

describe('validation limits (same in the browser, the sign step and the API)', () => {
  const f = (name: string, type: string, size: number) => ({ name, type, size });

  it('accepts MP4, MOV and WebM up to the video limit', () => {
    for (const [n, t] of [
      ['a.mp4', 'video/mp4'],
      ['a.mov', 'video/quicktime'],
      ['a.webm', 'video/webm'],
    ])
      expect(checkTypeAndSize(f(n, t, MAX_VIDEO_BYTES))).toMatchObject({ ok: true, kind: 'video' });
  });

  it('rejects an oversized video and photo with the per-type limit', () => {
    expect(checkTypeAndSize(f('big.mp4', 'video/mp4', MAX_VIDEO_BYTES + 1)).problem).toEqual({
      code: 'tooLarge',
      name: 'big.mp4',
      limitMb: 50,
    });
    expect(checkTypeAndSize(f('big.jpg', 'image/jpeg', MAX_PHOTO_BYTES + 1)).problem).toMatchObject(
      { code: 'tooLarge', limitMb: 10 },
    );
  });

  it('rejects unsupported formats, and falls back to the extension for octet-stream', () => {
    expect(checkTypeAndSize(f('clip.avi', 'video/x-msvideo', 10)).problem?.code).toBe(
      'unsupported',
    );
    expect(checkTypeAndSize(f('clip.mov', 'application/octet-stream', 10))).toMatchObject({
      ok: true,
      mime: 'video/quicktime',
    });
    expect(checkTypeAndSize(f('empty.mp4', 'video/mp4', 0)).ok).toBe(false);
  });

  it('checks a direct (Cloudinary) upload with the same limits', () => {
    const v = { name: 'v.mp4', kind: 'video' as const, format: 'mp4', bytes: 40 << 20 };
    expect(checkStoredMedia(v).ok).toBe(true);
    expect(checkStoredMedia({ ...v, format: 'mov' }).ok).toBe(true);
    expect(checkStoredMedia({ ...v, format: 'avi' }).problem?.code).toBe('unsupported');
    expect(checkStoredMedia({ ...v, bytes: MAX_VIDEO_BYTES + 1 }).problem?.code).toBe('tooLarge');
    const p = { name: 'p.jpg', kind: 'image' as const, format: 'jpg', bytes: 1 << 20 };
    expect(checkStoredMedia({ ...p, width: 1200, height: 900 }).ok).toBe(true);
    expect(checkStoredMedia({ ...p, width: 1200, height: 600 }).problem?.code).toBe('tooSmall');
    expect(checkStoredMedia({ ...p, format: 'gif', width: 1200, height: 900 }).ok).toBe(false);
    expect(checkStoredMedia(p).problem?.code).toBe('notAnImage');
  });
});

describe('moveWithinKind (separate Photos / Videos sections)', () => {
  const list = [
    { id: 'p1', type: 'image' },
    { id: 'v1', type: 'video' },
    { id: 'p2', type: 'image' },
    { id: 'v2', type: 'video' },
    { id: 'p3', type: 'image' },
  ];
  const ids = (l: { id: string }[]) => l.map((m) => m.id);

  it('reorders videos among themselves; photos keep their places', () => {
    expect(ids(moveWithinKind(list, 'video', 1, 0))).toEqual(['p1', 'v2', 'p2', 'v1', 'p3']);
  });

  it('"Set as cover" puts the photo first overall', () => {
    expect(ids(moveWithinKind(list, 'image', 2, 0))).toEqual(['p3', 'v1', 'p1', 'v2', 'p2']);
  });

  it('keeps the cover ahead of a video that was first', () => {
    const l = [
      { id: 'v1', type: 'video' },
      { id: 'p1', type: 'image' },
      { id: 'p2', type: 'image' },
    ];
    expect(ids(moveWithinKind(l, 'image', 1, 0))).toEqual(['p2', 'v1', 'p1']);
  });

  it('returns the same list when nothing moves', () => {
    expect(moveWithinKind(list, 'video', 0, 0)).toBe(list);
    expect(moveWithinKind(list, 'video', 5, 0)).toBe(list);
  });
});

describe('toShopMedia (public media mapper)', () => {
  it('keeps older rows (no metadata) as plain { id, url, type }', () => {
    expect(toShopMedia({ id: 'm1', url: '/seed/a.jpg', type: 'image' })).toEqual({
      id: 'm1',
      url: '/seed/a.jpg',
      type: 'image',
    });
    expect(
      toShopMedia({
        id: 'm2',
        url: '/u/v.mp4',
        type: 'video',
        posterUrl: null,
        durationS: null,
        width: null,
        height: null,
        hasAudio: null,
      }),
    ).toEqual({ id: 'm2', url: '/u/v.mp4', type: 'video' });
  });

  it('adds video metadata when known (incl. hasAudio=false)', () => {
    expect(
      toShopMedia({
        id: 'm3',
        url: 'https://res.cloudinary.com/x/video/upload/v1/s/a.mp4',
        type: 'video',
        posterUrl: 'https://res.cloudinary.com/x/video/upload/so_0/v1/s/a.jpg',
        durationS: 14.2,
        width: 1080,
        height: 1920,
        hasAudio: false,
      }),
    ).toEqual({
      id: 'm3',
      url: 'https://res.cloudinary.com/x/video/upload/v1/s/a.mp4',
      type: 'video',
      poster: 'https://res.cloudinary.com/x/video/upload/so_0/v1/s/a.jpg',
      duration: 14.2,
      width: 1080,
      height: 1920,
      hasAudio: false,
    });
  });

  it('unknown types fall back to image', () => {
    expect(toShopMedia({ id: 'x', url: '/a', type: 'gif' }).type).toBe('image');
  });
});

describe('storefront: stored hasAudio drives the reel speaker before the video loads', () => {
  it('maps hasAudio to a presence', () => {
    expect(storedAudioPresence(true)).toBe('yes');
    expect(storedAudioPresence(false)).toBe('no');
    expect(storedAudioPresence(undefined)).toBe('unknown');
    expect(storedAudioPresence(null)).toBe('unknown');
  });
});
