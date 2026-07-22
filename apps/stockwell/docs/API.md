# API Reference

All routes are under `/api`. All except `/api/auth/*` require a valid session
cookie (enforced by `middleware.ts`). `DELETE` is admin-only everywhere.
Responses are JSON; errors are `{ error }` with a 4xx status.

## Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` | sets session cookie |
| POST | `/api/auth/register` | `{ name, email, password }` | creates `staff`, auto-login |
| POST | `/api/auth/logout` | — | clears cookie |
| GET  | `/api/auth/me` | — | `{ user }` or 401 |

## Products
| GET | `/api/products?q=&category=&status=&warehouse=` | list + filter |
| POST | `/api/products` | create (status auto-derived) |
| GET | `/api/products/[id]` | single |
| PUT | `/api/products/[id]` | partial update (re-derives status on stock; accepts `gift_*` fields) |
| DELETE | `/api/products/[id]` | **admin** |

## Product media
| GET | `/api/products/[id]/media` | list media, ordered |
| POST | `/api/products/[id]/media` | multipart `files[]` (image/video, ≤50 MB each) |
| DELETE | `/api/products/[id]/media?mediaId=` | remove one (**admin** via middleware) |
| GET | `/uploads/[...file]` | public; streams with HTTP Range (video seek) |

## Public storefront (CORS-open, no auth)
| GET | `/api/brand` | branding + currency symbol |
| GET | `/api/shop/products` | sellable products incl. `media` + `gift` attributes |
| GET | `/api/shop/gift-finder?occasion=&recipient=&age=&types=&likes=&minPrice=&maxPrice=` | ranked `GiftMatch[]`; reasons are structured `GiftReason[]` (translate client-side) |
| GET | `/api/shop/feed?cursor=&category=&limit=` | Discover reels feed → `FeedResponse` (products + like/share counts + related; cursor pagination) |
| POST | `/api/shop/events` | record engagement `{ productId, type, sessionId }` (type = view/like/unlike/share/buy/open) |

## Inventory
| GET | `/api/stock-moves` | recent moves (≤100) |
| POST | `/api/stock-moves` | `{ type, productId, qty, meta }` — adjusts stock + logs move |

## Orders
| GET/POST | `/api/sales-orders` | list / create |
| GET/POST | `/api/purchase-orders` | list / create |

## POS
| POST | `/api/pos/checkout` | `{ items:[{productId,qty}], discountPct, payment, customerName }` → validates stock, creates SO, decrements stock, logs sale moves; returns `{ order, receipt }`. 409 on oversell. |

## Suppliers / Warehouses / Customers
| GET/POST | `/api/suppliers` ; PUT/DELETE `/api/suppliers/[id]` |
| GET | `/api/warehouses` | includes computed product count + stock value |
| GET/POST | `/api/customers` ; PUT/DELETE `/api/customers/[id]` |

## Invoices / Returns
| GET/POST | `/api/invoices` ; PUT `/api/invoices/[id]` `{ pay }` or `{ status }` ; DELETE (admin) |
| GET/POST | `/api/returns` ; PUT `/api/returns/[id]` `{ status }` ; DELETE (admin) |

## Staff (users) — admin-only writes
| GET | `/api/users` | list (no password hashes) |
| POST | `/api/users` | `{ name, email, password, role }` — **admin** |
| PUT | `/api/users/[id]` | `{ role?, active?, name? }` — **admin** |
| DELETE | `/api/users/[id]` | **admin**; can't delete self |

## Settings — admin-only writes
| GET | `/api/settings` | `{ key: value, … }` |
| PUT | `/api/settings` | merge/upsert keys — **admin** |

## Computed
| GET | `/api/dashboard` | KPIs, category mix, top products, recent moves |
| GET | `/api/reports` | `{ valuation, lowStock, salesByStatus, supplierPerf, receivables }` |
| GET | `/api/analytics/engagement` | Discover engagement rollup → `EngagementSummary` (totals + per-product views/likes/shares/buys) |
| GET | `/api/analytics` | `{ kpis, categories, topProducts, movementByType, topBrands }` |
