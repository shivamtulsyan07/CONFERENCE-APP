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
- Sheet names: Conference Order (/orders), Conference Order Summary (/summary), In House Stock (/stock), Balance Stock (/balance).
- Sheets always keep one trailing blank row; blank rows are never persisted and clearing a saved row deletes it.

- Range selection with Cmd/Ctrl + C / X / V (click-drag or shift+arrows to select; COPY / CUT / PASTE toolbar buttons mirror it). Paste is a single undo step.

## Backlog
- Autosave (900ms debounce) + Cmd/Ctrl+Z undo, Cmd/Ctrl+R (and Cmd+Shift+Z) redo, Cmd+S force save. Undo/redo use POST /api/{order,stock}-rows/replace which rewrites the collection to match the snapshot exactly.
- Conference Name removed from In House Order and Balance Stock (Group Name kept).
- P1: Bill-wise view / print of a party's sheet; export to Excel/CSV
- P1: auto-status should net off demand across rows sharing the same Item+Shade
- P2: undo/redo, multi-cell selection & fill-down, row grouping by party
- P2: real auth + audit trail of who edited which cell
