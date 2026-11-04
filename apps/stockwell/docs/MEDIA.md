# MEDIA.md — Product images & videos

Products can have any number of photos and short videos, shown in the admin
**Media** tab and the storefront carousel. There are three ways media reaches
the apps; all resolve to a `product_media` row (`{ url, type, sortOrder }`).

## 1. Seed / demo media (committed)

Seed media lives under [`public/seed/`](../public/seed), served by Next at
`/seed/<file>` (with HTTP Range, so video seeks) and referenced by `db:seed` via
`SEED_MEDIA` in [`src/db/seedMedia.ts`](../src/db/seedMedia.ts), keyed by **stable
product ID** (`p1`, `p2`, …), never by name or list position. `/seed/` is
allow-listed in `src/middleware.ts`.

**History (YAN-101).** The earlier demo files were random
[loremflickr](https://loremflickr.com) photos (plus ffmpeg videos made from them):
they did not show the products, and they carried non-commercial Creative Commons
licences (`cc-nc`, `cc-nc-sa`) with the author's name burned in. They were removed
and replaced by the verified photos below. Products without a verified photo show
the storefront's placeholder (a gift icon on a soft tile).

### Rules for adding seed media

- A photo of **that kind of product**, matching its name: no unrelated stock, no
  AI-generated pictures of purchasable products unless explicitly approved.
- Owned by the shop or licensed for **commercial** use, with the licence checked at
  the source (not assumed). Seed photos are **CC0 / public domain only**, so the
  storefront needs no on-screen credit line.
- No watermarks, author or licence overlays, and no third-party brand logos.
- Square 1:1, product centred, **≥ 1600 × 1600 px** (1200 px minimum; the product
  page gallery is full-width on 3× phones). Never upscale a small file.
- Up to three photos per product, **only when every photo shows the same physical
  item** (e.g. one photographer's studio series of one object) from a genuinely
  different angle or detail. Never duplicate a file, re-crop the cover, or mix in a
  look-alike item to fill the gallery: one honest photo beats three misleading ones.
- Name files `<productId>-a.jpg` (cover, shown on the card and first in the
  gallery), `<productId>-b.jpg`, `<productId>-c.jpg`, `<productId>-vid.mp4`, add them
  to `SEED_MEDIA` in gallery order, and add a row to the table below (a test fails
  for any unrecorded file, duplicate file, or non-square / undersized image).

### Seed media licence record

All eleven photos come from Wikimedia Commons, where each file page states its
licence. Commons' API (`extmetadata`) was checked for every file on 2026-10-31
(the three p18 files on 2026-11-01, together with each file page's wikitext:
`{{own}}` source, `{{self|cc-zero}}`, no trademark or personality-rights tags):
licence **CC0 1.0** (public domain dedication), attribution not required, no
restrictions flagged. The Unsplash photos were published on Unsplash between 2015
and May 2017, when Unsplash photos were CC0 (it moved to its own licence in June
2017); Commons tracks each with its `{{Unsplash}}` template and original URL.
Originals were downloaded from Commons (SHA-1 checked), square-cropped and resized to
1600 × 1600 JPEG. Credit is not required but is given here.

| File | Product | Source / owner | Licence |
| --- | --- | --- | --- |
| p5-a.jpg | Assorted Chocolate Hamper | [Commons: White-Box-of-Chocolates.jpg](https://commons.wikimedia.org/wiki/File:White-Box-of-Chocolates.jpg), by Evan-Amos (own work). Padded to square on its white backdrop. Note: the photographed box is a Russell Stover box; no brand mark is visible. | CC0 1.0 |
| p9-a.jpg | Minimalist Wall Clock | [Commons: Round analog clock (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Round_analog_clock_(Unsplash).jpg), by Eder Pozo Pérez, [Unsplash K9zVc7B_XPI](https://unsplash.com/photos/K9zVc7B_XPI). Cropped; the clock maker's logo was retouched off the dial. | CC0 1.0 |
| p11-a.jpg | Leather-bound Journal | [Commons: Leather notebook (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Leather_notebook_(Unsplash).jpg), by Kelly Jean, [Unsplash cKjbI0Y00X0](https://unsplash.com/photos/cKjbI0Y00X0). Cropped. Cover is embossed "2017". | CC0 1.0 |
| p12-a.jpg | Ceramic Succulent Planter | [Commons: Succuken (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Succuken_(Unsplash).jpg), by Annie Spratt, [Unsplash nwQO2HpqcCI](https://unsplash.com/photos/nwQO2HpqcCI). Cropped. | CC0 1.0 |
| p13-a.jpg | Silk Greeting Card Set | [Commons: Thank you! (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Thank_you!_(Unsplash).jpg), by Aaron Burden, [Unsplash zunGugEsJCE](https://unsplash.com/photos/zunGugEsJCE). Cropped. Shows a single "Thank You" card. | CC0 1.0 |
| p14-a.jpg | Analog Wrist Watch | [Commons: Gold Watch Denim Cuffs (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Gold_Watch_Denim_Cuffs_(Unsplash).jpg), by AJ Garcia, [Unsplash 0bgWnyTKsjo](https://unsplash.com/photos/0bgWnyTKsjo). Cropped; dial has no brand mark. | CC0 1.0 |
| p15-a.jpg | Scented Reed Diffuser | [Commons: Reed diffuser.jpg](https://commons.wikimedia.org/wiki/File:Reed_diffuser.jpg), by Alex Tang (own work). Cropped. | CC0 1.0 |
| p16-a.jpg | Silver Pendant Necklace | [Commons: Locket on open book (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Locket_on_open_book_(Unsplash).jpg), by freestocks.org, [Unsplash -1aE4Kpy-Qc](https://unsplash.com/photos/-1aE4Kpy-Qc). Cropped. | CC0 1.0 |
| p18-a.jpg | Wooden Chess Set | [Commons: Chess game Staunton No. 6 perfil view 2.jpg](https://commons.wikimedia.org/wiki/File:Chess_game_Staunton_No._6_perfil_view_2.jpg), by Wilfredor (own work). 3/4 angle; padded to square on its white studio backdrop. | CC0 1.0 |
| p18-b.jpg | Wooden Chess Set | [Commons: Chess game Staunton No. 6 perfil view.jpg](https://commons.wikimedia.org/wiki/File:Chess_game_Staunton_No._6_perfil_view.jpg), by Wilfredor (own work). Side view of the same set; padded to square. | CC0 1.0 |
| p18-c.jpg | Wooden Chess Set | [Commons: Chess game Staunton No. 6 perfil view 5.jpg](https://commons.wikimedia.org/wiki/File:Chess_game_Staunton_No._6_perfil_view_5.jpg), by Wilfredor (own work). The same board without pieces; padded to square. | CC0 1.0 |

p18 is one studio series of a House of Chess "Rio Staunton" set on a Wegiel board.
The rooks carry a small "HOUSE OF CHESS" maker's stamp on top. It is legible in the
series' top and front views, so those are **not** used; in the three views above it
is not readable. (An earlier p18-a used the top view; it was replaced for this reason.)

**Gallery depth.** Only p18 has three photos. For the other eight, Commons holds a
single CC0 photo of that item (searched by photographer and subject on 2026-11-01);
no second view of the *same* object exists there, so they stay at one photo rather
than borrowing a look-alike.

**Known mismatch to fix with a shop photo:** p16 is sold as a *silver* pendant, but
the CC0 locket photographed is antique bronze-toned.

**Weak matches to replace with a shop photo** (kept until then, YAN-112): p13 shows a
single card, not a *set*; p5 is a plain box of chocolates, not a hamper; p11's cover is
embossed "2017".

### Products without a photo (exceptions)

These seed products show the storefront placeholder on purpose: no photo was found that
is CC0 / public domain **and** shows that product with its stated material and type, and
the rule is never to use a look-alike. Commons was searched again on 2026-11-04 (YAN-112)
for CC0 files ≥ 1600 px on the short side, under several search terms per product; every
candidate was checked by eye. Each row says why the best candidates were rejected. **The
fix for each is a shop photo of the real stock item** (upload in the admin Media tab, which
stores it on Cloudinary in production), or a new CC0 photo added under the rules above.
A test checks that every seed product without seed media has a row here.

| Product | Name | Why there is no photo yet |
| --- | --- | --- |
| p1 | Vanilla Bean Soy Candle | Every jar candle found carries a third-party brand label (Bath & Body Works, Yankee Candle, Porter & Plot); the unbranded ones are pillar candles or tea lights, not a soy candle in a jar. |
| p2 | Rose Gold Photo Frame | No metallic rose-gold frame found; CC0 frames are museum gilt or carved wood, which would misstate the finish. |
| p3 | Handcrafted Jewelry Box | Candidates are museum pieces (a gold-enamel Falize box, gem-studded caskets) or a Kashmiri writing box, not a gift-shop wooden or fabric jewellery box. |
| p4 | Teddy Bear Plush 12" | Teddy bears appear only in cluttered scenes, in costumes, or as event mascots with logos; no plain plush bear as a product shot. |
| p6 | Personalized Ceramic Mug | Mugs found carry third-party logos or slogans, or are novelty shapes; none shows a personalised mug. |
| p7 | Sandalwood Perfume Gift Set | Only branded bottles, antique labelled bottles or shop shelves; no gift set. |
| p8 | Leather Bifold Wallet | Not searched again: out of stock, so not shown in the storefront. |
| p10 | Copper Fairy String Lights | The best candidate ("Coiled Fairy Lights", CC0) is star LEDs on a thick jute-style cord, not copper wire; the rest are street or Christmas displays. |
| p17 | Gourmet Tea Sampler Box | Tea boxes found are branded retail packs (Tazo, Lipton, Chinese brands) or warehouse crates. |
| p19 | Bamboo Desk Organizer | No bamboo organiser found; the one desk organiser is a branded design in another wood. |
| p20 | Festive Diya Gift Set | Diyas appear singly or in festival scenes; no photo shows a set of diyas as a product. |

## Missing or broken images

Every product image in the storefront goes through `ProductImage`
(`apps/storefront/src/components/ProductImage.tsx`). No URL, or a failed load,
shows the one shared placeholder (`ImageFallback`), on the card, product gallery,
cart and Discover. Images carry translated alt text ("Photo of {name}"); the first
cards above the fold load with high priority, the rest lazily. A URL that fails is
remembered for the session, so remounting a card shows the placeholder without asking for
the same 404 again, and in development each failure is logged once (`[ProductImage]` in
the console).

### Auditing product media (local or production)

A placeholder can mean "no photo yet" or "the photo row points at a file that is gone".
To tell them apart, run from `apps/stockwell` (YAN-112):

```bash
pnpm media:audit                              # read-only report on DATABASE_URL (default local.db)
pnpm media:audit --base-url https://your.app  # also requests every media URL, lists non-200s
pnpm media:audit --apply                      # repair product_media (see below)
```

Set `DATABASE_URL` / `DATABASE_AUTH_TOKEN` to the Turso values to audit production. The
report lists orphan rows, `/seed/*` rows whose file is no longer shipped (a database seeded
before YAN-101 still points at the deleted loremflickr files), and visible products with no
working photo. `--apply` deletes only those orphan and dead seed rows and adds the current
seed photos to seed products left with no media; it never changes `products`, admin
uploads or remote (Cloudinary) URLs, and running it twice does nothing the second time.
Do not run `db:seed` on production to fix media: it wipes every table.

## Product badges

A product's `tag` column is its badge ("Bestseller", "New", …). Rule: **a badge is
an explicit shop decision**, set on the product and visible in the admin product
list. It is not computed from sales or engagement, and no badge is added just for
decoration. Built-in codes (`PRODUCT_BADGES` in `@stockwell/shared`):

| Code | Shown as (EN) | Meaning |
| --- | --- | --- |
| `bestseller` | Bestseller | One of the shop's top sellers, as judged by the shop |
| `kids-favourite` | Kids' favourite | A product the shop recommends for children |
| `premium` | Premium | A premium-range product |
| `trending` | Trending | Currently popular |
| `new` | New | Recently added to the catalogue |
| `festive-pick` | Festive pick | Recommended for the current festival season |

Codes are translated by the storefront (`badge.*` in `src/i18n/{en,te}.ts`). Any
other word is stored as a lower-case key (`productBadgeKey`) and shown as typed.

## 2. Local uploads (dev default)

Admin uploads (Products → a product → **Media** tab) are streamed to
`POST /api/products/[id]/media` and, with no cloud configured, written to
`apps/stockwell/uploads/` (gitignored) and served by `app/uploads/[...file]`
with Range support. Great for development — but a local/ephemeral disk, so files
are lost on redeploy on hosts like Vercel. Use Cloudinary for production.

**Photos and videos (YAN-108).** The Media tab and the Add product popup have separate
**Photos** and **Videos** sections, each with its own picker and limits. Every file
uploads on its own with a progress bar; a failed file shows a translated reason and a
**Retry** button, and never affects the others. Videos open in a preview that plays
**with sound** (also before saving, in the Add product popup). **Replace** swaps a file
in place (same position and cover status, same type); **Remove** asks first. If a file
fails while a product is being created, the product is kept as a draft and its Media
tab opens with the failed files ready to retry.

**Upload rules and the photo minimum (YAN-109).** Each file is checked in the browser
and again by the API (`src/lib/mediaRules.ts`): photos must be JPG, PNG or WebP (read
from the file's bytes, so a renamed file is caught), up to 10 MB and at least 800 px on
the short side; videos MP4, MOV or WebM up to 50 MB. A batch with one bad file stores
nothing. The order is set in the admin (drag, ← / → buttons, **Set as cover**) and saved
with `PATCH /api/products/[id]/media { order }`; the first item is the cover. A product
needs **3 photos to be published** (videos don't count). Products that were already live
stay live and show a **Needs photos** badge until photos are added. Seed products are
inserted as live, so `pnpm db:seed` still gives a full demo storefront; only add seed
photos that have a licence row below.

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
credential set is present (signed takes priority over unsigned).

**Uploads go straight from the admin browser to Cloudinary (YAN-108).** Vercel
Functions refuse request bodies over **4.5 MB**, so a phone video can't pass through
the API. Each file is uploaded on its own:

1. `POST /api/products/[id]/media/sign` with `{ name, type, size }` — admin-only, checks
   the format and size limits, and returns `{ mode: 'direct', uploadUrl, fields }`
   (a signature limited to the folder and that media type's formats; the API secret
   never leaves the server) or `{ mode: 'server' }` when Cloudinary isn't configured.
2. `direct`: the browser uploads to Cloudinary with real progress, then registers the
   result with `POST /api/products/[id]/media` (or `PUT …/media/[mediaId]` to replace)
   as JSON `{ uploads: [{ name, url, type, format, bytes, width, height, durationS,
   hasAudio }] }`. The API accepts only `https://res.cloudinary.com/<your cloud>/…`
   URLs of the right type and re-checks format, size and photo resolution.
   `server`: the file is posted as multipart (local disk in dev).
3. If saving the row fails after the Cloudinary upload, **Retry** re-sends only the
   registration; an unsaved asset is logged (`[media] … is on Cloudinary but was not
   saved`) and can be pruned in the dashboard.

On Vercel (`VERCEL` env set) with no Cloudinary, uploads are refused with a clear
"storage" error instead of writing to the read-only, wiped-on-deploy disk
(`ALLOW_LOCAL_UPLOADS=1` overrides this; don't use it on Vercel).

**Video metadata.** `product_media` stores `duration_s`, `width`, `height`,
`has_audio` and `poster_url` (all nullable; older rows have none). They come from the
MP4/MOV header (`src/lib/videoMeta.ts`, read in the browser and on the server), then
Cloudinary's upload response, then the browser's `<video>` element (WebM). The poster
is Cloudinary's first frame (`/video/upload/so_0/….jpg`); local uploads have none.
The shop APIs expose them as optional `ShopMedia` fields (`poster`, `duration`,
`hasAudio`, `width`, `height`); the reels hide the speaker when `hasAudio` is false.

**Deleting / replacing** always updates the DB row first. The old file is removed
best-effort: local files are unlinked, and with signed Cloudinary credentials the
asset is destroyed (`/destroy`). Seed files and unsigned-mode assets are left in place.

### Alternatives

If you'd rather not use Cloudinary: **Supabase Storage** (1 GB free),
**Cloudflare R2** (10 GB free, no egress fees), or **UploadThing** (2 GB free)
all work. Each would be another branch in `storeMedia()`; Cloudinary is the
default recommendation because of the video support + bandwidth on the free tier.
