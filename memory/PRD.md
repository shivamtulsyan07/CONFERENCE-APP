# Conference Ops — Excel-like Order & Stock Module

## Problem statement
Module to take orders from customers, order from the company, and dispatch party-wise. User then requested an **Excel-like sheet** working, sharing two screenshots (order register + stock entry sheet).

## User choices
- Order grid columns: Party Name, Page, Group, ITEM, SHADE, QTY, MTR, BILL NO + Rate/Amount
- Row colours: YELLOW = stock has arrived, GREEN = in stock ready, WHITE = stock not ready
- Stock sheet keyed by Item + Shade (each combination is its own line)
- Grid behaviour: cell typing, Tab/Enter nav, auto new row, dropdowns for Party/Group/Item, Excel copy-paste, column filters
- Grids REPLACE earlier form-based Orders/Stock pages; staff + admin role toggle, no login

## Architecture
- Backend FastAPI + MongoDB. Collections: `parties`, `order_rows`, `stock_rows`.
  Endpoints: /api/parties, /api/order-rows (+/bulk upsert, /auto-status, DELETE), /api/stock-rows (+/bulk, DELETE), /api/lookups, /api/stats/dashboard, /api/seed.
- Frontend React + Tailwind. Grid engine `src/lib/useSheet.js` (keyboard nav, clipboard TSV paste, dirty tracking, bulk save), cell renderer `components/SheetCell.jsx` with datalist dropdowns.
- Pages: Dashboard, Order Sheet (/orders), Stock Entry (/stock), Party Master (/parties).

## Implemented
- Order Sheet columns (as of latest request): SR, Party Name, Page No., Conference Name, Group Name, Item, Shade, Qty, MTR, Bill Number, Rate. Amount is auto-computed (qty × rate) for footer/dashboard totals but not a visible column.
- Stock Entry columns: Conference Name, Group Name, Item Name, Shade, Quantity.
- 2026-06 v1: form-based orders → company PO → receive → party-wise dispatch with auto stock deduction (now replaced).
- 2026-06 v2: Excel-like Order Sheet and Stock Entry sheets, colour statuses (click row number to cycle), "Auto colour from stock" matching Item+Shade against stock, footer totals, per-column filters, party→page auto-fill, Excel paste, dashboard rebuilt on sheet data (qty, value, billed/unbilled, readiness counts, party-wise stacked chart, top items).

- Balance Stock page (/balance): read-only sheet = stock qty − ordered qty matched on Item+Shade; green surplus, red short, "Short only" toggle, filters, footer totals. Endpoint GET /api/balance-stock.

- Conference Order Summary page (/summary): item-wise totals (Group Name, Item Name, Shade, Quantity) from GET /api/order-summary, with filters and total.
- Excel-style drag-to-fill: blue handle at each cell's bottom-right, hold and drag down/up to copy the value into the range (single undo step).
- Sidebar order: Dashboard, Conference Stock (/orders), In House Stock, Conference Order Summary, Company Order, Balance Stock, Parties.
- Sheets always keep one trailing blank row; blank rows are never persisted and clearing a saved row deletes it.

- Range selection with Cmd/Ctrl + C / X / V (click-drag or shift+arrows to select; COPY / CUT / PASTE toolbar buttons mirror it). Paste is a single undo step.

- Right-click context menu on any cell (SheetContextMenu): Cut / Copy / Paste, Clear contents, Fill down in selection, Insert row above / below, Duplicate row, Clear row, Delete row, Hide column / Show all columns. Hidden columns are display-only (values are still saved via allColumns).
- A row is only persisted when it has a party, item, shade, MTR, bill number, qty or rate — conference/page/group alone no longer creates an empty row.

- Company Order page (/company-order): what to order from the company = ordered qty − in house stock per Group+Item+Shade, "shortage only / all items" toggle, filters, totals, and Excel (openpyxl) + PDF (reportlab) export via GET /api/company-order/export.xlsx|.pdf?pending_only=.

- Advanced filters on every grid (lib/filters.js + components/FilterPopover.jsx + lib/useGridFilter.js): per-column operator filters (contains / not contains / equals / starts / ends / empty / not empty; numeric = ≠ > ≥ < ≤ between), multi-select value picklist with search, ASC/DESC sort on read-only grids, global "search any column" box, active-filter count and CLEAR FILTERS.

- Company Balance Order (/company-balance) + Stock Arrived From Company (/stock-arrived): shared editable LineSheet component over collections `company_sent_rows` and `company_arrived_rows` (Group, Item, Shade, Quantity, Date, Remark). GET /api/company-balance nets sent − arrived per Group+Item+Shade; Company Balance Order shows read-only ARRIVED and BALANCE columns plus stat cards. Endpoints: /api/line-sheet/{company-sent-rows|company-arrived-rows} (GET, /bulk, /replace, DELETE).
- Footer counts exclude the trailing blank sentinel row (sheet.dataCount).

- 2026-06 Dashboard v3 (professional control room): dark, dense, chart-free "Operations Control Room" at `/`. 7 KPI tiles (conference qty, order value, in-house stock, to-order-from-company, pending at company, sent/arrived, % rows ready) + 4 scrollable dense tables: Pending reminder with company (sent−arrived, last sent date), Shortfall to order from company, Top items by quantity, Party-wise conference summary (rows/items/qty/value/ready/pending/billed + readiness bar). Full Screen button uses the browser Fullscreen API with an edge-to-edge dense layout; manual Refresh only (no auto-poll). New endpoint `GET /api/stats/overview`. Verified: iteration_8 (backend 100%, frontend 100%).

- 2026-06 HAANA experience: (a) global filter bar on the dashboard (conference / group / party / item) driving every tile and table via `GET /api/stats/overview?conference&group&party&item` (returns `filter_options` + `applied`); (b) clickable KPI tiles and table rows drill down into the matching sheet with `?q=<term>` which read-only grids pick up as their global search (`useGridFilter` seeds search from the URL); (c) **Haana assistant** panel — Claude Sonnet 4.6 via `EMERGENT_LLM_KEY`, streaming `POST /api/assistant/ask` grounded in a live data snapshot, per-session history in `assistant_messages` + `GET /api/assistant/history/{sid}`. Verified: iteration_9 (frontend 100%; the one backend bug — `applied` param shadowing — was fixed and re-verified).

- 2026-06 Full-app redesign + full page layout: navigation moved to a **compact icon rail** (Overview / Conference / Company / Master, `rail-*`) plus **top tabs** for the sheets of the active section (`tab-*`), so any sheet is one click away. Every page now uses `components/SheetFrame.jsx` — compact header, toolbar row, stats strip and a `.sheet-scroll` grid that fills the viewport (no page scroll; sticky header + totals footer) — and each sheet has its own **Full Screen** button (`<page-testid>-fullscreen-btn`). A **light/dark toggle** (`theme-toggle`, `context/ThemeContext.js`, persisted in `ops_theme`) themes the whole app: shell/toolbar (`--shell-*`), sheets (`--sheet-*`) and dashboard (`--dash-*`, `--tone-*`) are all CSS-variable driven. Verified: iteration_10 (frontend 100%); light/dark toolbar pass checked by screenshot.

- 2026-06 Rail regrouped to 3 headings: **Overview** (Dashboard, Parties), **Conference** (Conference Order, Conference Order Summary, Company Order), **Stock** (In House Stock, Company Balance Order, Stock Arrived, Balance Stock). Rail testids are now `rail-overview|conference|stock`. Company Order PDF export drops the ORDERED and IN HOUSE columns (SR / Group / Item / Shade / To order only); the Excel export still has all columns.

- 2026-06 Company Order now nets off the company pipeline: **To Order = conference demand − in house stock − qty still pending with the company (sent − arrived)** via `pending_company_map()`. Applies to `/api/company-order` and both exports only; Balance Stock and the dashboard shortfall tile deliberately keep the old (demand − stock) logic.

- 2026-06 PERF FIX (user reported "server is very slow after entering data", 3696 order rows): grids now render only the rows near the viewport (`lib/useWindowRows.js`, 33px row height, rAF-throttled recompute, spacer rows keep the scrollbar honest) — DOM inputs dropped from ~40,000 to ~600 and page load from ~10s+ to ~1.2s. `useSheet.focusCell` scrolls off-window rows into view before focusing (`setEnsureVisible`), `SheetCell` is `React.memo`'d and its ref cleans up unmounted entries, `applyPatch` uses slice, and `filtered` reuses row wrappers. Backend bulk endpoints (`order-rows`, `stock-rows`, `line-sheet/{sheet}`) now use `bulk_write` + `insert_many` instead of one round trip per row, and startup creates `row_index` indexes. Verified: iteration_11 + iteration_12 (arrow-burst max-update-depth regression fixed, full grid regression pass, backend 28/28 single-threaded).

- 2026-06 Added **SHOP** as a fourth rail section (`rail-shop`, route `/shop`, `pages/Shop.jsx`) — intentionally empty placeholder awaiting sheets the user will specify.

- 2026-06 **Shop Sale module** (`/shop-sale`, under the SHOP rail): columns Party Name, Bill No, Group Name, Item, Shade, Qty (no date/remark), backed by the new `shop_sale_rows` collection registered in `LINE_COLLECTIONS` as `shop-sale-rows`. `LineRow`/`LineRowIn` gained `party_name` + `bill_no`, `is_blank_line` counts them, and `LineSheet` gained `leadColumns` / `omitColumns` props. Stat strip shows sale lines, quantity sold and distinct bills. Deliberately does NOT affect stock, Company Order or the dashboard. Verified: iteration_13 (backend 56/56 incl. 12 new Shop Sale tests, frontend all checks pass, CB/SA regression clean).

- 2026-06 Balance Stock formula updated at user request: **balance = in house stock + qty pending with the company (sent − arrived) − conference order** (`/api/balance-stock` now uses `pending_company_map()`); no new column, only the number changed. Company Order keeps its own logic (demand − stock − pending).

## Backlog
- Autosave (900ms debounce) + Cmd/Ctrl+Z undo, Cmd/Ctrl+R (and Cmd+Shift+Z) redo, Cmd+S force save. Undo/redo use POST /api/{order,stock}-rows/replace which rewrites the collection to match the snapshot exactly.
- Conference Name removed from In House Order and Balance Stock (Group Name kept).
- P1: Bill-wise view / print of a party's sheet; export to Excel/CSV
- P1: auto-status should net off demand across rows sharing the same Item+Shade
- P2: undo/redo, multi-cell selection & fill-down, row grouping by party
- P2: real auth + audit trail of who edited which cell
