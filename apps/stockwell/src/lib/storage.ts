import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UPLOAD_DIR, MIME_TO_EXT } from './uploads';

/**
 * Media storage abstraction.
 *
 * Default: writes to the local `uploads/` dir (served by app/uploads/[...file]).
 * Great for development, but a single-server/ephemeral filesystem — files vanish
 * on redeploy on hosts like Vercel.
 *
 * Production: set the Cloudinary env vars (see .env.example) and uploads go to
 * Cloudinary's free tier instead — 25 GB storage + 25 GB/month bandwidth, images
 * AND video, automatic optimization/CDN. Two modes, in priority order:
 *   1. Signed  — CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.
 *   2. Unsigned — CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET.
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

export type StoredMedia = { url: string; type: 'image' | 'video' };

/** Cloudinary signature: sha1 of sorted `k=v&…` params + api_secret. */
function sign(params: Record<string, string>, secret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto
    .createHash('sha1')
    .update(toSign + secret)
    .digest('hex');
}

async function uploadToCloudinary(file: File, type: 'image' | 'video'): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder());

  if (signedReady()) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign({ folder: folder(), timestamp }, apiSecret());
    fd.append('api_key', apiKey());
    fd.append('timestamp', timestamp);
    fd.append('signature', signature);
  } else {
    fd.append('upload_preset', preset());
  }

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud()}/${type}/upload`, {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as any;
    throw new Error(e?.error?.message || `Cloudinary upload failed (${res.status})`);
  }
  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}

export async function storeMedia(
  file: File,
  mime: string,
  keyPrefix: string,
): Promise<StoredMedia> {
  const type: 'image' | 'video' = mime.startsWith('video/') ? 'video' : 'image';

  if (cloudinaryEnabled()) {
    const url = await uploadToCloudinary(file, type);
    return { url, type };
  }

  // Local disk fallback.
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${keyPrefix}-${crypto.randomBytes(6).toString('hex')}${MIME_TO_EXT[mime]}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return { url: `/uploads/${name}`, type };
}

/** Best-effort cleanup. Only local files are deleted; remote (Cloudinary / seed) assets stay. */
export async function removeMedia(url: string): Promise<void> {
  if (url.startsWith('/uploads/')) {
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(url))).catch(() => {});
  }
}
