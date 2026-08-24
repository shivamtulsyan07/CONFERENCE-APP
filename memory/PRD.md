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

## Backlog
- Autosave (900ms debounce) + Cmd/Ctrl+Z undo, Cmd/Ctrl+R (and Cmd+Shift+Z) redo, Cmd+S force save. Undo/redo use POST /api/{order,stock}-rows/replace which rewrites the collection to match the snapshot exactly.
- Conference Name removed from In House Order and Balance Stock (Group Name kept).
- P1: Bill-wise view / print of a party's sheet; export to Excel/CSV
- P1: auto-status should net off demand across rows sharing the same Item+Shade
- P2: undo/redo, multi-cell selection & fill-down, row grouping by party
- P2: real auth + audit trail of who edited which cell
