import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_DIR, MIME_TO_EXT } from './uploads';
import { STORED_FORMATS } from './mediaRules';
import {
  EMPTY_VIDEO_META,
  cleanVideoMeta,
  mergeVideoMeta,
  readMp4Info,
  type VideoMeta,
} from './videoMeta';

/**
 * Media storage abstraction.
 *
 * Default: writes to the local `uploads/` dir (served by app/uploads/[...file]).
 * Great for development, but a single-server/ephemeral filesystem — files vanish
 * on redeploy on hosts like Vercel, so on Vercel uploads are refused unless Cloudinary
 * is configured (StorageNotConfiguredError).
 *
 * Production: set the Cloudinary env vars (see .env.example) and uploads go to
 * Cloudinary's free tier instead — 25 GB storage + 25 GB/month bandwidth, images
 * AND video, automatic optimization/CDN. Two modes, in priority order:
 *   1. Signed  — CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.
 *   2. Unsigned — CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET.
 *
 * With Cloudinary the admin browser uploads straight to it (directUploadTicket) and then
 * registers the result, because Vercel Functions refuse request bodies over 4.5 MB. YAN-108.
 * See docs/MEDIA.md.
 */

const cloud = () => process.env.CLOUDINARY_CLOUD_NAME || '';
const apiKey = () => process.env.CLOUDINARY_API_KEY || '';
const apiSecret = () => process.env.CLOUDINARY_API_SECRET || '';
const preset = () => process.env.CLOUDINARY_UPLOAD_PRESET || '';
const folder = () => process.env.CLOUDINARY_FOLDER || 'stockwell';

const signedReady = () => !!(cloud() && apiKey() && apiSecret());
const unsignedReady = () => !!(cloud() && preset());
export const cloudinaryEnabled = (): boolean => signedReady() || unsignedReady();

/** Local disk is fine for dev, but Vercel's disk is read-only and wiped on redeploy. */
export const localDiskUsable = () => !process.env.VERCEL || process.env.ALLOW_LOCAL_UPLOADS === '1';

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Media storage is not configured: set the Cloudinary env vars (see docs/MEDIA.md)');
  }
}

export type MediaKind = 'image' | 'video';

export type StoredMedia = {
  url: string;
  type: MediaKind;
  posterUrl: string | null;
  meta: VideoMeta;
};

/** Cloudinary signature: sha1 of sorted `k=v&…` params + api_secret. */
export function sign(params: Record<string, string>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto
    .createHash('sha1')
    .update(toSign + secret)
    .digest('hex');
}

/** Fields (besides `file`) for one Cloudinary upload, signed when an API secret is set. */
function uploadFields(kind: MediaKind): Record<string, string> {
  if (signedReady()) {
    const params = {
      allowed_formats: STORED_FORMATS[kind].join(','),
      folder: folder(),
      timestamp: Math.floor(Date.now() / 1000).toString(),
    };
    return { ...params, api_key: apiKey(), signature: sign(params, apiSecret()) };
  }
  return { upload_preset: preset(), folder: folder() };
}

const uploadUrl = (kind: MediaKind) => `https://api.cloudinary.com/v1_1/${cloud()}/${kind}/upload`;

/**
 * What the browser needs to upload one file straight to Cloudinary (signed: the API secret
 * never leaves the server, and the signature only allows this folder and these formats).
 * Null when Cloudinary isn't configured: the browser then posts the file to the API.
 */
export function directUploadTicket(
  kind: MediaKind,
): { uploadUrl: string; fields: Record<string, string> } | null {
  if (!cloudinaryEnabled()) return null;
  return { uploadUrl: uploadUrl(kind), fields: uploadFields(kind) };
}

/** True when `url` is an asset of this app's own Cloudinary account, of the given kind. */
export function isOwnStoredUrl(url: unknown, kind: MediaKind): boolean {
  if (typeof url !== 'string' || !cloud()) return false;
  const prefix = `https://res.cloudinary.com/${cloud()}/${kind}/upload/`;
  return url.startsWith(prefix) && !url.includes('..') && url.length < 1024;
}

/** Still frame (first frame, JPG) of a Cloudinary video; null for other URLs. */
export function posterFor(url: string): string | null {
  const m = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)\.[a-z0-9]+$/i.exec(url);
  return m ? `${m[1]}so_0/${m[2]}.jpg` : null;
}

/** Cloudinary public id of an uploaded asset URL (`…/upload/v123/folder/name.ext`). */
export function publicIdOf(url: string): { kind: MediaKind; publicId: string } | null {
  const m =
    /^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i.exec(
      url,
    );
  return m ? { kind: m[1] as MediaKind, publicId: m[2] } : null;
}

/** Metadata Cloudinary reports in its upload response. */
export function metaFromCloudinary(r: any): VideoMeta {
  const audio = r?.audio;
  const hasAudio =
    audio && typeof audio === 'object' ? Boolean(audio.codec || audio.channels) : null;
  return cleanVideoMeta({
    durationS: r?.duration,
    width: r?.width,
    height: r?.height,
    hasAudio: r?.resource_type === 'video' ? hasAudio : null,
  });
}

async function uploadToCloudinary(file: File, kind: MediaKind): Promise<any> {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(uploadFields(kind))) fd.append(k, v);
  const res = await fetch(uploadUrl(kind), { method: 'POST', body: fd });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as any;
    throw new Error(e?.error?.message || `Cloudinary upload failed (${res.status})`);
  }
  return res.json();
}

/**
 * Stores one already-validated file. `clientMeta` is what the admin browser measured
 * (used only where the file header gives nothing, e.g. WebM).
 */
export async function storeMedia(
  file: File,
  mime: string,
  keyPrefix: string,
  clientMeta: VideoMeta = EMPTY_VIDEO_META,
): Promise<StoredMedia> {
  const type: MediaKind = mime.startsWith('video/') ? 'video' : 'image';
  if (!cloudinaryEnabled() && !localDiskUsable()) throw new StorageNotConfiguredError();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = type === 'video' ? (readMp4Info(bytes) ?? EMPTY_VIDEO_META) : EMPTY_VIDEO_META;

  if (cloudinaryEnabled()) {
    const r = await uploadToCloudinary(file, type);
    const meta =
      type === 'video'
        ? mergeVideoMeta(mergeVideoMeta(header, metaFromCloudinary(r)), clientMeta)
        : EMPTY_VIDEO_META;
    return {
      url: r.secure_url,
      type,
      posterUrl: type === 'video' ? posterFor(r.secure_url) : null,
      meta,
    };
  }

  // Local disk fallback.
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${keyPrefix}-${crypto.randomBytes(6).toString('hex')}${MIME_TO_EXT[mime]}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), bytes);
  return {
    url: `/uploads/${name}`,
    type,
    posterUrl: null,
    meta: type === 'video' ? mergeVideoMeta(header, clientMeta) : EMPTY_VIDEO_META,
  };
}

/**
 * Best-effort cleanup of a replaced/removed file: local uploads are unlinked, and this
 * account's Cloudinary assets are destroyed when an API secret is set. Seed files and
 * anything else are left alone. Never throws.
 */
export async function removeMedia(url: string): Promise<void> {
  if (url.startsWith('/uploads/')) {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
    return;
  }
  const id = publicIdOf(url);
  if (!id || !signedReady() || !isOwnStoredUrl(url, id.kind)) return;
  try {
    const params = { public_id: id.publicId, timestamp: Math.floor(Date.now() / 1000).toString() };
    const fd = new FormData();
    for (const [k, v] of Object.entries(params)) fd.append(k, v);
    fd.append('api_key', apiKey());
    fd.append('signature', sign(params, apiSecret()));
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud()}/${id.kind}/destroy`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) console.warn(`[media] Cloudinary destroy failed (${res.status}) for ${url}`);
  } catch (e) {
    console.warn('[media] Cloudinary destroy failed', e);
  }
}
