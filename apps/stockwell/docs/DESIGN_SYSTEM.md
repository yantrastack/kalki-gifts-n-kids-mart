# Design System

All tokens and styles live in `src/app/globals.css`. There is **no Tailwind** —
styling is plain CSS classes + CSS custom properties (design tokens). Components
reference token vars so light/dark theming is automatic.

## Theming
`<html>` carries `data-theme="light|dark"`, `data-density`, `data-sidebar`.
`AppShell` sets these from state and persists theme to `localStorage`
(`stockwell-theme`). Dark mode overrides token values under `[data-theme="dark"]`.

## Tokens (CSS variables)

### Color
| Var | Light | Meaning |
|---|---|---|
| `--bg` / `--bg-elev` | `#f7f5f2` / `#fff` | app bg / cards |
| `--bg-muted` / `--bg-hover` / `--bg-active` | warm greys | fills/states |
| `--fg` / `--fg-secondary` / `--fg-tertiary` | `#1c1816` … | text hierarchy |
| `--border` / `--border-strong` / `--border-subtle` | hairlines |
| `--accent` / `--accent-hover` / `--accent-soft` | `#9a3a3a` (brick red) | primary |
| `--success` `--warn` `--danger` `--info` (+ `*-soft`) | status colors |
| `--chart-1..5` | categorical chart palette |
| `--shadow-xs..xl` | elevation |

### Scale
- Radii: `--r-xs 4` … `--r-2xl 20`, `--r-full 999`.
- Spacing (8px system): `--s-1 4` … `--s-10 64`.
- Type: `--t-xs 11` … `--t-4xl 36`; `--font-sans` (Inter), `--font-mono`
  (IBM Plex Mono). Use mono for numbers/IDs/SKUs.
- Motion: `--transition: 160ms cubic-bezier(0.2,0.6,0.2,1)`.

Always use tokens, e.g. `style={{ padding: "var(--s-4)", color: "var(--fg-secondary)" }}`.

## Layout classes
- `.app` (grid: sidebar + main), `.sidebar`, `.topbar`, `.main`.
- `.page` — page padding wrapper. Every page's root.
- `.ph` / `.ph-title` / `.ph-sub` / `.ph-actions` — page header row.
- `.card` / `.card-header` / `.card-title` / `.card-subtitle` / `.card-body`.
- `.kpi-grid` (+ `.kpi-grid-5`), `.kpi`, `.kpi-label`, `.kpi-value`, `.kpi-delta`.
- `.dash-row-2`, `.card-grid` — responsive 2-up / auto-fill grids.
- Helpers: `.row`, `.spread`, `.muted`, `.tiny`, `.mono`, `.dim`.

## Tables
`.table-wrap` › `.table-toolbar` (filters) › `.table-scroll` › `table.dt`.
- `th.col-num` / `td.col-num` right-align numerics.
- `th.sortable` for clickable sort headers; `.col-check` for checkbox column.
- Rows are clickable to open a detail `Slideover`.

## Forms & controls
- `.btn` + variant `.btn-primary | .btn-secondary | .btn-ghost`, size `.btn-sm`.
- `.icon-btn` — square icon button.
- `.input`, `.select`, `.field` (label+control stack), `.input-group` (icon+input).
- `.tabs` / `.tab` (`.active`), `.checkbox`.

## Status badges
Use the `statusBadge(status)` helper from `ui.tsx` — don't hand-roll. Mapping
lives in `STATUS_MAP` (extend it when adding a status):
`active/low/out`, `draft/approved/shipped/received/cancelled`,
`fulfilled/packing/pending`, `paid/unpaid/partial/overdue/refunded/rejected`,
`admin/staff`. Raw class names: `.badge` + `.badge-success|warn|danger|info|accent`.

## Components (`src/components/`)

### Icon.tsx — `<Icon name="..." size={16} />`
Single SVG sprite component; outline style, `currentColor`. ~90 named glyphs
(dashboard, box, layers, warehouse, truck, cart, users, chart, plus, minus, x,
check, chev*, arrow*, search, filter, trash, edit, printer, card, banknote,
wallet, bank, barcode, scan, receipt2, refund, alert, …). It spreads extra props
(e.g. `onClick`) onto the `<svg>`.

### ui.tsx — primitives (import as `import * as UI from "@/components/ui"`)
- `fmt` — `money`, `moneyCompact`, `int`, `pct` formatters.
- `statusBadge(status)`.
- `Kpi` (with sparkline/delta) and `Kpi2` (label/value/sub).
- Charts: `Sparkline`, `LineChart`, `BarChart`, `Donut` (pure SVG, token-colored).
- `Avatar`, `ProductThumb` (initials placeholders).
- Overlays: `Modal`, `Slideover`, `Dropdown` + `MenuItem`/`MenuSep`.
- `EmptyState`.
- `ToastProvider` + `useToast()` → `toast({ message, icon, type })`.

### AppShell.tsx
Sidebar nav (`NAV_SECTIONS`), topbar (search, theme toggle, user menu w/ sign
out). Add a new page to the sidebar by adding an item to `NAV_SECTIONS`.

## Page anatomy (copy this skeleton)
```tsx
"use client";
import { Icon } from "@/components/Icon";
import * as UI from "@/components/ui";
import { jget, jsend } from "@/lib/api";

export default function ThingPage() {
  const { fmt, statusBadge, useToast } = UI;
  // useState + useEffect(jget) on mount
  return (
    <div className="page">
      <div className="ph">
        <div><div className="ph-title">Things</div><div className="ph-sub">…</div></div>
        <div className="ph-actions"><button className="btn btn-primary">…</button></div>
      </div>
      <div className="table-wrap"><div className="table-scroll">
        <table className="dt">…</table>
      </div></div>
    </div>
  );
}
```
