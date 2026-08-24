# Conference Ops — Order & Dispatch Module

## Problem statement
"I want you to create a module for my conference working where we take order from customer and work on dispatching order to the company and stock from shop."

User choices: order flow = give order to company → receive → dispatch party-wise; staff + admin roles (no login, header role toggle); automatic stock deduction on shop fulfilment; dashboard with sales & dispatch stats; keep minimal.

## Architecture
- Backend: FastAPI + Motor/MongoDB. Collections: `parties`, `products`, `orders`, `company_orders`, `dispatches`. All routes under `/api`.
- Frontend: React (CRA) + Tailwind + shadcn/ui + recharts. Sidebar shell, pages: Dashboard, Customer Orders, Company Orders, Dispatch, Shop Stock, Parties.
- Role state in localStorage via RoleContext (no auth).

## Core flow
Customer order (pending) → Company PO (order → ordered_to_company) → Receive goods (stock IN, order → received) → Party-wise dispatch (stock OUT, order → partial/dispatched).

## Implemented (2026-06)
- Parties CRUD, Products CRUD + manual stock adjust
- Multi-line customer orders with running total, company/shop source per line
- Company POs linked to pending customer orders; partial & full goods receipt increments shop stock
- Party-wise dispatch with stock and pending-qty validation, auto stock deduction, dispatch history
- Dashboard: sales, orders, pending dispatch, stock units, party-wise dispatch chart, order value trend, low-stock panel, recent dispatches
- Seed endpoint for sample data

## Backlog
- P1: Invoice / dispatch challan PDF; order detail page with timeline
- P1: Unique document numbering via counters collection (current count-based numbering not concurrency-safe)
- P2: Real auth + per-user audit trail; date-range filters and CSV export; payments/outstanding tracking
