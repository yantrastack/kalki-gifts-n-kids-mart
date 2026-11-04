import { NextResponse } from 'next/server';
import { checkMediaFile, checkStoredMedia, declaredType, type MediaProblem } from './mediaRules';
import {
  StorageNotConfiguredError,
  isOwnStoredUrl,
  posterFor,
  storeMedia,
  type MediaKind,
} from './storage';
import { cleanVideoMeta, EMPTY_VIDEO_META } from './videoMeta';

/*
 * Request handling shared by POST /api/products/[id]/media (add) and
 * PUT /api/products/[id]/media/[mediaId] (replace). YAN-108.
 *
 * A request carries new media in one of two ways:
 *  - multipart files (local disk in dev, or small files): checked here, then stored;
 *  - JSON `{ uploads: [...] }`: files the browser already uploaded straight to Cloudinary
 *    (Vercel refuses request bodies over 4.5 MB). Each is checked against the same limits
 *    from what Cloudinary reported, and must be an asset of this app's own account.
 */

/** English fallback for API clients; the admin shows its own translated text for `problem`. */
export function problemText(p: MediaProblem): string {
  switch (p.code) {
    case 'unsupported':
      return `${p.name}: unsupported file type (use JPG, PNG, WebP, MP4, MOV or WebM)`;
    case 'tooLarge':
      return `${p.name} is larger than ${p.limitMb} MB`;
    case 'notAnImage':
      return `${p.name} is not a valid JPG, PNG or WebP image`;
    case 'tooSmall':
      return `${p.name} is ${p.width}×${p.height} px; photos need at least ${p.min} px on the short side`;
    case 'typeMismatch':
      return `${p.name}: choose another ${p.expected} to replace it`;
    case 'storage':
      return `${p.name}: the file could not be stored. Please try again.`;
    case 'network':
      return `${p.name}: network error during upload`;
  }
}

export const problemResponse = (p: MediaProblem, status = 400) =>
  NextResponse.json({ error: problemText(p), problem: p }, { status });

/** Columns of a product_media row that describe the file itself. */
export type NewMedia = {
  url: string;
  type: MediaKind;
  posterUrl: string | null;
  durationS: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean | null;
};

/** One checked file, not stored yet. */
type Pending =
  | { via: 'file'; name: string; kind: MediaKind; file: File; mime: string; meta: unknown }
  | { via: 'stored'; name: string; kind: MediaKind; media: NewMedia };

// Flat (not a union): this app compiles without strictNullChecks.
type Parsed = { ok: boolean; items?: Pending[]; error?: NextResponse };

const isJson = (req: Request) =>
  (req.headers.get('content-type') || '').toLowerCase().includes('application/json');

/**
 * Reads and checks the new media of a request without storing anything, so one bad file
 * refuses the whole request. `field` is the multipart field ("files" for add, "file" for
 * replace).
 */
export async function parseMediaRequest(req: Request, field: 'files' | 'file'): Promise<Parsed> {
  const items: Pending[] = [];

  if (isJson(req)) {
    const body = (await req.json().catch(() => null)) as any;
    const list = Array.isArray(body?.uploads) ? body.uploads : null;
    if (!list?.length || list.length > 20)
      return {
        ok: false,
        error: NextResponse.json({ error: 'No uploads provided' }, { status: 400 }),
      };
    for (const u of list) {
      const name = String(u?.name ?? 'file').slice(0, 200);
      const kind: MediaKind = u?.type === 'video' ? 'video' : 'image';
      if (!isOwnStoredUrl(u?.url, kind))
        return { ok: false, error: problemResponse({ code: 'storage', name }) };
      const check = checkStoredMedia({
        name,
        kind,
        format: String(u?.format ?? ''),
        bytes: Number(u?.bytes),
        width: Number(u?.width),
        height: Number(u?.height),
      });
      if (!check.ok) return { ok: false, error: problemResponse(check.problem) };
      const meta =
        kind === 'video'
          ? cleanVideoMeta(u)
          : cleanVideoMeta({ width: u?.width, height: u?.height });
      items.push({
        via: 'stored',
        name,
        kind,
        media: {
          url: u.url,
          type: kind,
          posterUrl: kind === 'video' ? posterFor(u.url) : null,
          durationS: kind === 'video' ? meta.durationS : null,
          width: meta.width,
          height: meta.height,
          hasAudio: kind === 'video' ? meta.hasAudio : null,
        },
      });
    }
    return { ok: true, items };
  }

  const form = await req.formData().catch(() => null);
  const files = form ? form.getAll(field).filter((f): f is File => f instanceof File) : [];
  if (!files.length)
    return { ok: false, error: NextResponse.json({ error: 'No files provided' }, { status: 400 }) };
  // Optional per-file metadata measured by the admin browser (same order as the files).
  const metas = form.getAll('meta').map((m) => {
    try {
      return JSON.parse(String(m));
    } catch {
      return null;
    }
  });
  for (const [i, f] of files.entries()) {
    // Photos are read so their real format and size can be checked; videos are not.
    const isVideo = declaredType(f)?.startsWith('video/') ?? false;
    const bytes = isVideo ? null : new Uint8Array(await f.arrayBuffer());
    const res = checkMediaFile(f, bytes);
    if (!res.ok) return { ok: false, error: problemResponse(res.problem) };
    items.push({
      via: 'file',
      name: f.name,
      kind: res.kind,
      file: f,
      mime: res.mime,
      meta: metas[i],
    });
  }
  return { ok: true, items };
}

/**
 * Stores one checked item (multipart files go to Cloudinary or local disk; direct uploads
 * are already stored). Throws a NextResponse-ready problem on storage failure.
 */
export async function storePending(
  p: Pending,
  productId: string,
): Promise<{ ok: boolean; media?: NewMedia; error?: NextResponse }> {
  if (p.via === 'stored') return { ok: true, media: p.media };
  try {
    const clientMeta = p.kind === 'video' ? cleanVideoMeta(p.meta) : EMPTY_VIDEO_META;
    const s = await storeMedia(p.file, p.mime, productId, clientMeta);
    return {
      ok: true,
      media: {
        url: s.url,
        type: s.type,
        posterUrl: s.posterUrl,
        durationS: s.type === 'video' ? s.meta.durationS : null,
        width: s.meta.width,
        height: s.meta.height,
        hasAudio: s.type === 'video' ? s.meta.hasAudio : null,
      },
    };
  } catch (e) {
    console.error('[media] storing an upload failed', e);
    return {
      ok: false,
      error: problemResponse(
        { code: 'storage', name: p.name },
        e instanceof StorageNotConfiguredError ? 503 : 502,
      ),
    };
  }
}
