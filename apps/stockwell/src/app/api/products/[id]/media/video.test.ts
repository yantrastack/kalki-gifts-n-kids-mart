import crypto from 'node:crypto';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { fakeMp4, fakePng } from '@/lib/testImages';

// YAN-108: product video upload — sign step, direct (Cloudinary) registration, multipart
// video metadata, replace in place, and production storage safety.
process.env.DATABASE_URL = ':memory:';

const CLOUD = {
  CLOUDINARY_CLOUD_NAME: 'kalki-test',
  CLOUDINARY_API_KEY: 'key123',
  CLOUDINARY_API_SECRET: 'shh',
};
const withEnv = (vars: Record<string, string>) => {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
};
const cdn = (kind: 'image' | 'video', file: string) =>
  `https://res.cloudinary.com/kalki-test/${kind}/upload/v1700000000/stockwell/${file}`;

describe('product video upload (YAN-108)', () => {
  let media: any;
  let sign: any;
  let replace: any;
  let db: any;
  let schema: any;
  let adminCookie: string;
  let staffCookie: string;
  const created: string[] = [];

  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (url: string, method: string, body: BodyInit, cookie = adminCookie, json = false) =>
    new NextRequest(`http://localhost${url}`, {
      method,
      body,
      headers: { cookie, ...(json ? { 'content-type': 'application/json' } : {}) },
    });
  const signFor = (id: string, file: object, cookie?: string) =>
    sign.POST(
      req(`/api/products/${id}/media/sign`, 'POST', JSON.stringify(file), cookie, true),
      params(id),
    );
  const register = (id: string, uploads: object[]) =>
    media.POST(
      req(`/api/products/${id}/media`, 'POST', JSON.stringify({ uploads }), adminCookie, true),
      params(id),
    );
  const multipart = (id: string, file: File, meta?: object) => {
    const fd = new FormData();
    fd.append('files', file);
    if (meta) fd.append('meta', JSON.stringify(meta));
    return media.POST(req(`/api/products/${id}/media`, 'POST', fd), params(id));
  };
  const rowsOf = async (id: string) =>
    db
      .select()
      .from(schema.productMedia)
      .where(eq(schema.productMedia.productId, id))
      .orderBy(schema.productMedia.sortOrder)
      .all();

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    ({ db, schema } = await import('@/db/client'));
    const { createSession, SESSION_COOKIE } = await import('@/lib/session');
    const cookie = async (role: string) =>
      `${SESSION_COOKIE}=${await createSession({ sub: `u-${role}`, email: `${role}@t`, name: role, role } as any)}`;
    adminCookie = await cookie('admin');
    staffCookie = await cookie('staff');
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    for (const id of ['pv', 'pw', 'px'])
      await db.insert(schema.products).values({ id, name: id, sku: id.toUpperCase() } as any);
    media = await import('./route');
    sign = await import('./sign/route');
    replace = await import('./[mediaId]/route');
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    const { removeMedia } = await import('@/lib/storage');
    for (const url of created.splice(0)) await removeMedia(url);
  });

  describe('sign step', () => {
    it('without Cloudinary: tells the browser to post the file to the API', async () => {
      const res = await signFor('pv', { name: 'a.mp4', type: 'video/mp4', size: 30 << 20 });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ mode: 'server', kind: 'video' });
    });

    it('with Cloudinary: a signed direct-upload ticket limited to video formats', async () => {
      withEnv(CLOUD);
      const res = await signFor('pv', { name: 'a.mov', type: 'video/quicktime', size: 45 << 20 });
      const body = await res.json();
      expect(body.mode).toBe('direct');
      expect(body.uploadUrl).toBe('https://api.cloudinary.com/v1_1/kalki-test/video/upload');
      const { api_key, signature, ...signed } = body.fields;
      expect(api_key).toBe('key123');
      expect(signed.allowed_formats).toBe('mp4,mov,webm');
      expect(JSON.stringify(body)).not.toContain('shh'); // the secret never leaves the server
      const expected = crypto
        .createHash('sha1')
        .update(
          `${Object.keys(signed)
            .sort()
            .map((k) => `${k}=${signed[k]}`)
            .join('&')}shh`,
        )
        .digest('hex');
      expect(signature).toBe(expected);
    });

    it('refuses unsupported, empty and oversized files before any upload', async () => {
      const bad = async (file: object) => (await (await signFor('pv', file)).json()).problem.code;
      expect(await bad({ name: 'a.avi', type: 'video/x-msvideo', size: 10 })).toBe('unsupported');
      expect(await bad({ name: 'a.mp4', type: 'video/mp4', size: (50 << 20) + 1 })).toBe(
        'tooLarge',
      );
      expect(await bad({ name: 'a.jpg', type: 'image/jpeg', size: (10 << 20) + 1 })).toBe(
        'tooLarge',
      );
      expect(await bad({ name: 'a.mp4', type: 'video/mp4', size: 0 })).toBe('unsupported');
    });

    it('404s for an unknown product, 403s for staff', async () => {
      const f = { name: 'a.mp4', type: 'video/mp4', size: 10 };
      expect((await signFor('nope', f)).status).toBe(404);
      expect((await signFor('pv', f, staffCookie)).status).toBe(403);
    });

    it('on Vercel without Cloudinary: refuses with a storage problem (no ephemeral disk)', async () => {
      withEnv({ VERCEL: '1' });
      const res = await signFor('pv', { name: 'a.mp4', type: 'video/mp4', size: 10 });
      expect(res.status).toBe(503);
      expect((await res.json()).problem.code).toBe('storage');
      const up = await multipart('pv', new File([fakeMp4()], 'a.mp4', { type: 'video/mp4' }));
      expect(up.status).toBe(503);
      expect(await rowsOf('pv')).toHaveLength(0);
    });
  });

  describe('multipart upload (local disk)', () => {
    it('stores a video with its duration, size and audio track read from the file', async () => {
      const res = await multipart(
        'pv',
        new File(
          [fakeMp4({ durationS: 21.5, width: 720, height: 1280, audio: false })],
          'clip.mp4',
          {
            type: 'video/mp4',
          },
        ),
      );
      expect(res.status).toBe(201);
      const [row] = await res.json();
      created.push(row.url);
      expect(row).toMatchObject({
        type: 'video',
        durationS: 21.5,
        width: 720,
        height: 1280,
        hasAudio: false,
        posterUrl: null,
      });
      expect(row.url).toMatch(/^\/uploads\/pv-.+\.mp4$/);
    });

    it('uses the browser-measured metadata when the header gives none (WebM)', async () => {
      const res = await multipart(
        'pw',
        new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])], 'clip.webm', {
          type: 'video/webm',
        }),
        { durationS: 8.2, width: 640, height: 360, hasAudio: 'maybe' },
      );
      expect(res.status).toBe(201);
      const [row] = await res.json();
      created.push(row.url);
      expect(row).toMatchObject({ durationS: 8.2, width: 640, height: 360, hasAudio: null });
    });
  });

  describe('direct upload registration (Cloudinary)', () => {
    const video = {
      name: 'reel.mp4',
      url: cdn('video', 'reel.mp4'),
      type: 'video',
      format: 'mp4',
      bytes: 42 << 20, // a 42 MB phone video: never passes through the API body
      width: 1080,
      height: 1920,
      durationS: 33.3,
      hasAudio: true,
    };

    it('saves the row with metadata and a poster frame', async () => {
      withEnv(CLOUD);
      const res = await register('px', [video]);
      expect(res.status).toBe(201);
      const [row] = await res.json();
      expect(row).toMatchObject({
        productId: 'px',
        url: video.url,
        type: 'video',
        durationS: 33.3,
        hasAudio: true,
        width: 1080,
        height: 1920,
        posterUrl:
          'https://res.cloudinary.com/kalki-test/video/upload/so_0/v1700000000/stockwell/reel.jpg',
      });
    });

    it("refuses a URL that isn't this account's Cloudinary asset", async () => {
      withEnv(CLOUD);
      for (const url of [
        'https://evil.example/video.mp4',
        'https://res.cloudinary.com/someone-else/video/upload/v1/x.mp4',
        cdn('image', 'reel.mp4'), // wrong resource type for a video
      ]) {
        const res = await register('px', [{ ...video, url }]);
        expect(res.status).toBe(400);
        expect((await res.json()).problem.code).toBe('storage');
      }
    });

    it('applies the same limits as a file upload', async () => {
      withEnv(CLOUD);
      const code = async (u: object) => (await (await register('px', [u])).json()).problem.code;
      expect(await code({ ...video, bytes: (50 << 20) + 1 })).toBe('tooLarge');
      expect(await code({ ...video, format: 'avi' })).toBe('unsupported');
      expect(
        await code({
          name: 'p.jpg',
          url: cdn('image', 'p.jpg'),
          type: 'image',
          format: 'jpg',
          bytes: 1000,
          width: 600,
          height: 600,
        }),
      ).toBe('tooSmall');
    });

    it('is refused when Cloudinary is not configured', async () => {
      const res = await register('px', [video]);
      expect(res.status).toBe(400);
    });
  });

  describe('replace in place', () => {
    it('keeps position and cover status, updates metadata, removes the old file best-effort', async () => {
      withEnv(CLOUD);
      const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      await db.insert(schema.productMedia).values([
        { id: 'rv0', productId: 'pw', url: '/seed/x.jpg', type: 'image', sortOrder: 0 },
        {
          id: 'rv1',
          productId: 'pw',
          url: cdn('video', 'old.mp4'),
          type: 'video',
          sortOrder: 5,
          hasAudio: false,
        },
      ] as any);
      const res = await replace.PUT(
        req(
          '/api/products/pw/media/rv1',
          'PUT',
          JSON.stringify({
            uploads: [
              {
                name: 'new.mov',
                url: cdn('video', 'new.mov'),
                type: 'video',
                format: 'mov',
                bytes: 1 << 20,
                durationS: 9,
                hasAudio: true,
              },
            ],
          }),
          adminCookie,
          true,
        ),
        { params: Promise.resolve({ id: 'pw', mediaId: 'rv1' }) },
      );
      expect(res.status).toBe(200);
      const row = await res.json();
      expect(row).toMatchObject({
        id: 'rv1',
        sortOrder: 5,
        url: cdn('video', 'new.mov'),
        hasAudio: true,
        durationS: 9,
      });
      // Old Cloudinary asset destroyed (best-effort, signed).
      const [url, init] = fetchMock.mock.calls[0] as any;
      expect(url).toBe('https://api.cloudinary.com/v1_1/kalki-test/video/destroy');
      expect((init.body as FormData).get('public_id')).toBe('stockwell/old');
    });

    it('refuses a photo replacing a video', async () => {
      withEnv(CLOUD);
      const res = await replace.PUT(
        req(
          '/api/products/pw/media/rv1',
          'PUT',
          JSON.stringify({
            uploads: [
              {
                name: 'p.jpg',
                url: cdn('image', 'p.jpg'),
                type: 'image',
                format: 'jpg',
                bytes: 1000,
                width: 1200,
                height: 1200,
              },
            ],
          }),
          adminCookie,
          true,
        ),
        { params: Promise.resolve({ id: 'pw', mediaId: 'rv1' }) },
      );
      expect(res.status).toBe(400);
      expect((await res.json()).problem).toMatchObject({ code: 'typeMismatch', expected: 'video' });
    });

    it('multipart replace still works for photos (local disk)', async () => {
      const fd = new FormData();
      fd.append('file', new File([fakePng(1200, 1200)], 'new.png', { type: 'image/png' }));
      const res = await replace.PUT(req('/api/products/pw/media/rv0', 'PUT', fd), {
        params: Promise.resolve({ id: 'pw', mediaId: 'rv0' }),
      });
      expect(res.status).toBe(200);
      const row = await res.json();
      created.push(row.url);
      expect(row).toMatchObject({ sortOrder: 0, type: 'image', durationS: null, hasAudio: null });
    });
  });
});
