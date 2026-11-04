'use client';
import { declaredType } from './mediaRules';
import { EMPTY_VIDEO_META, mergeVideoMeta, readMp4InfoFrom, type VideoMeta } from './videoMeta';

/*
 * Browser upload helpers for product media (YAN-108). One request per file so each file
 * reports its own progress and fails on its own — a bad file never loses the others.
 *
 * Each upload: 1) ask POST /media/sign where to send it; 2a) with Cloudinary, upload
 * straight to it (real progress, no 4.5 MB Vercel limit) and register the result with the
 * API (JSON); 2b) otherwise post the file to the API (multipart, local disk in dev).
 */

export type UploadProgress = (loaded: number, total: number) => void;

/** Error thrown for a refused upload; `problem` is the API's structured reason, if any. */
export class MediaUploadError extends Error {
  problem?: unknown;
  constructor(message: string, problem?: unknown) {
    super(message);
    this.problem = problem;
  }
}

const kindOf = (f: File): 'image' | 'video' =>
  declaredType(f)?.startsWith('video/') ? 'video' : 'image';

/** Duration/size from a `<video>` element, for formats whose header isn't parsed (WebM). */
function videoElementMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    const done = (m: VideoMeta) => {
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      resolve(m);
    };
    const timer = setTimeout(() => done(EMPTY_VIDEO_META), 8000);
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => {
      clearTimeout(timer);
      done({
        durationS: Number.isFinite(v.duration) ? Math.round(v.duration * 100) / 100 : null,
        width: v.videoWidth || null,
        height: v.videoHeight || null,
        hasAudio: null,
      });
    };
    v.onerror = () => {
      clearTimeout(timer);
      done(EMPTY_VIDEO_META);
    };
    v.src = url;
  });
}

/**
 * Video metadata measured in the browser: MP4/MOV headers first (exact, incl. whether
 * there is an audio track), then the `<video>` element for anything still unknown.
 */
export async function probeVideo(file: File): Promise<VideoMeta> {
  let header: VideoMeta | null = null;
  try {
    header = await readMp4InfoFrom(
      file.size,
      async (offset, length) =>
        new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()),
    );
  } catch {
    header = null;
  }
  if (header?.durationS && header.width && header.height) return header;
  return mergeVideoMeta(header ?? EMPTY_VIDEO_META, await videoElementMeta(file));
}

/** Low-level XHR with upload progress. Resolves with the parsed JSON body. */
function xhr(
  url: string,
  method: 'POST' | 'PUT',
  body: FormData | string,
  onProgress?: UploadProgress,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open(method, url);
    if (typeof body === 'string') req.setRequestHeader('Content-Type', 'application/json');
    req.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    req.onload = () => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(req.responseText || '{}');
      } catch {
        /* non-JSON error page (e.g. a 413 from the host) */
      }
      resolve({ status: req.status, body: parsed });
    };
    req.onerror = () => reject(new Error('network'));
    req.onabort = () => reject(new Error('network'));
    req.send(body);
  });
}

const ok = (s: number) => s >= 200 && s < 300;

const refused = (name: string, status: number, body: any) =>
  new MediaUploadError(
    body?.error || `Upload failed (${status})`,
    body?.problem ??
      (status === 413 ? { code: 'tooLarge', name, limitMb: 4 } : { code: 'storage', name }),
  );

const networkError = (name: string) =>
  new MediaUploadError('Network error during upload', { code: 'network', name });

/**
 * Files already stored on Cloudinary whose registration with the API failed: a retry
 * re-sends only the registration, not the whole video.
 */
const storedButUnsaved = new WeakMap<File, Record<string, unknown>>();

async function send(
  productId: string,
  file: File,
  replaceId: string | null,
  onProgress?: UploadProgress,
): Promise<any> {
  const name = file.name;
  const kind = kindOf(file);
  const target = replaceId
    ? {
        url: `/api/products/${productId}/media/${replaceId}`,
        method: 'PUT' as const,
        field: 'file',
      }
    : { url: `/api/products/${productId}/media`, method: 'POST' as const, field: 'files' };

  const register = async (upload: Record<string, unknown>) => {
    let res: { status: number; body: any };
    try {
      res = await xhr(target.url, target.method, JSON.stringify({ uploads: [upload] }));
    } catch {
      storedButUnsaved.set(file, upload);
      throw networkError(name);
    }
    if (!ok(res.status)) {
      // The file stays on Cloudinary (an orphan) until a retry saves it; log it for ops.
      console.warn(`[media] ${name} is on Cloudinary but was not saved: ${upload.url}`);
      if (res.status >= 500) storedButUnsaved.set(file, upload);
      throw refused(name, res.status, res.body);
    }
    storedButUnsaved.delete(file);
    onProgress?.(1, 1);
    return res.body;
  };

  const pending = storedButUnsaved.get(file);
  if (pending) return register(pending);

  // 1) Where should this file go? (Also re-checks its format and size on the server.)
  let ticket: { status: number; body: any };
  try {
    ticket = await xhr(
      `/api/products/${productId}/media/sign`,
      'POST',
      JSON.stringify({ name, type: file.type, size: file.size }),
    );
  } catch {
    throw networkError(name);
  }
  if (!ok(ticket.status)) throw refused(name, ticket.status, ticket.body);

  const meta = kind === 'video' ? await probeVideo(file) : EMPTY_VIDEO_META;

  // 2a) Straight to Cloudinary, then register the stored file.
  if (ticket.body.mode === 'direct') {
    const fd = new FormData();
    for (const [k, v] of Object.entries(ticket.body.fields as Record<string, string>))
      fd.append(k, v);
    fd.append('file', file);
    let up: { status: number; body: any };
    try {
      up = await xhr(ticket.body.uploadUrl, 'POST', fd, onProgress);
    } catch {
      throw networkError(name);
    }
    if (!ok(up.status) || !up.body?.secure_url)
      throw new MediaUploadError(up.body?.error?.message || 'Storage upload failed', {
        code: 'storage',
        name,
      });
    const r = up.body;
    const audio =
      r.audio && typeof r.audio === 'object' ? Boolean(r.audio.codec || r.audio.channels) : null;
    const fromStorage: VideoMeta = {
      durationS: typeof r.duration === 'number' ? r.duration : null,
      width: typeof r.width === 'number' ? r.width : null,
      height: typeof r.height === 'number' ? r.height : null,
      hasAudio: kind === 'video' ? audio : null,
    };
    const m = kind === 'video' ? mergeVideoMeta(meta, fromStorage) : fromStorage;
    return register({
      name,
      url: r.secure_url,
      type: kind,
      format: r.format,
      bytes: r.bytes,
      width: m.width,
      height: m.height,
      durationS: m.durationS,
      hasAudio: m.hasAudio,
    });
  }

  // 2b) Through the API (local disk in dev).
  const fd = new FormData();
  fd.append(target.field, file);
  if (kind === 'video') fd.append('meta', JSON.stringify(meta));
  let res: { status: number; body: any };
  try {
    res = await xhr(target.url, target.method, fd, onProgress);
  } catch {
    throw networkError(name);
  }
  if (!ok(res.status)) throw refused(name, res.status, res.body);
  return res.body;
}

/** Upload one file to a product's media. `onProgress(loaded, total)` fires as bytes go. */
export function uploadMediaFile(
  productId: string,
  file: File,
  onProgress?: UploadProgress,
): Promise<any> {
  return send(productId, file, null, onProgress);
}

/** Replace one media item in place; keeps its position and cover status. */
export function replaceMediaFile(
  productId: string,
  mediaId: string,
  file: File,
  onProgress?: UploadProgress,
): Promise<any> {
  return send(productId, file, mediaId, onProgress);
}
