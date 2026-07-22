# MEDIA.md — Product images & videos

Products can have any number of photos and short videos, shown in the admin
**Media** tab and the storefront carousel. There are three ways media reaches
the apps; all resolve to a `product_media` row (`{ url, type, sortOrder }`).

## 1. Seed / demo media (committed)

The demo catalogue ships real photos + a few short videos under
[`public/seed/`](../public/seed). They're static files served by Next at
`/seed/<file>` (with HTTP Range, so video seeks) and referenced by `db:seed`.
`/seed/` is allow-listed in `src/middleware.ts`. Regenerate them with the media
fetch script if needed (loremflickr photos + ffmpeg Ken-Burns videos).

## 2. Local uploads (dev default)

Admin uploads (Products → a product → **Media** tab) are streamed to
`POST /api/products/[id]/media` and, with no cloud configured, written to
`apps/stockwell/uploads/` (gitignored) and served by `app/uploads/[...file]`
with Range support. Great for development — but a local/ephemeral disk, so files
are lost on redeploy on hosts like Vercel. Use Cloudinary for production.

## 3. Cloudinary (recommended for production) — free

Why Cloudinary: the most generous free media host that does **images *and*
video** — 25 GB storage + 25 GB/month bandwidth, automatic optimization and a
global CDN, and *unsigned* uploads so **no API secret sits on the server**.

### Setup (~3 minutes)

1. Create a free account at <https://cloudinary.com>. On the dashboard, copy your
   **Cloud name**.
2. Configure `apps/stockwell/.env` one of two ways:

   **A) Signed uploads** (recommended if you have API credentials — dashboard →
   API Keys):
   ```bash
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   CLOUDINARY_FOLDER="stockwell"   # optional
   ```

   **B) Unsigned uploads** (no secret on the server): **Settings → Upload →
   Upload presets → Add**, set **Signing mode: Unsigned**, then:
   ```bash
   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_UPLOAD_PRESET="your-unsigned-preset"
   ```
3. Restart the app. New uploads now go to Cloudinary; the stored `url` is the
   returned `secure_url` (an absolute `https://res.cloudinary.com/...` link the
   storefront uses directly). No other code changes.

### How it works

`src/lib/storage.ts` is the switch. `cloudinaryEnabled()` is true when either
credential set is present (signed takes priority over unsigned). `storeMedia()`
POSTs the file to Cloudinary's upload endpoint — adding an sha1 `signature` for
signed mode, or the `upload_preset` for unsigned — otherwise it writes to local
disk. Deleting a media item always removes the DB row; local files are unlinked,
while remote (Cloudinary/seed) assets are left in place (prune them in the
Cloudinary dashboard if needed).

### Alternatives

If you'd rather not use Cloudinary: **Supabase Storage** (1 GB free),
**Cloudflare R2** (10 GB free, no egress fees), or **UploadThing** (2 GB free)
all work. Each would be another branch in `storeMedia()`; Cloudinary is the
default recommendation because of the video support + bandwidth on the free tier.
