# dev-media — temporary test photos (YAN-112)

Placeholder product photos so the storefront can be tested with images while real
shop photos are prepared. **Development only:**

- Not in `public/`, so the deployed site never serves them.
- Not licensed for production use, and not recorded in `docs/MEDIA.md`.
- Replace each one with a real photo in the admin: Products → open the product → Media.
  Then delete the file here.

## Load them into your local app

```bash
cd apps/stockwell
pnpm media:dev-load        # copies into uploads/ and sets each as the product's cover
```

File name = product ID (`p4.png` → Teddy Bear Plush 12"). Products that already have
media are skipped, so it is safe to run again. It refuses to run against a remote
(Turso) database. After `pnpm db:seed`, run it again.

| File | Product |
| --- | --- |
| p1.png | Vanilla Bean Soy Candle |
| p2.png | Rose Gold Photo Frame |
| p3.png | Handcrafted Jewelry Box |
| p4.png | Teddy Bear Plush 12" |
| p6.png | Personalized Ceramic Mug |
| p7.png | Sandalwood Perfume Gift Set |
| p10.png | Copper Fairy String Lights |
| p17.png | Gourmet Tea Sampler Box |
| p19.png | Bamboo Desk Organizer |
| p20.png | Festive Diya Gift Set |
| pmvwjpilu.png | iron-man (admin test product; only in some local DBs, skipped elsewhere) |
