# Demo Coffee Shop

A Vite + React coffee shop application with:

- Public customer storefront
- Admin panel for settings, products, and staff
- Staff and manager order interfaces
- ERP control center for branch, permissions, push, and offline sync
- AR menu experience under `/ar`
- Supabase-backed ordering and app state

## Tech Stack

- React 19 + Vite
- Tailwind CSS 4
- Supabase JavaScript client
- Vitest for unit tests
- GitHub Actions CI

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create environment variables:

```bash
cp .env.example .env
```

Then update `.env` with your Supabase project values.

3. Run the app:

```bash
npm run dev
```

Default local URL: `http://localhost:5173`

## Available Scripts

- `npm run dev`: start local Vite dev server
- `npm run build`: build production assets to `dist`
- `npm run preview`: preview built app locally
- `npm run api:dev`: run Phase 1 backend API (non-OTP)
- `npm run api:start`: run Phase 1 backend API (non-OTP)
- `npm run lint`: run ESLint
- `npm run test`: run unit tests once
- `npm run test:watch`: run tests in watch mode

## Route Map

- `/`: customer storefront
- `/chika/super-admin`: admin panel
- `/erp-control`: Phase 1 ERP control center
- `/commandes/staff` and `/commande`: staff command interface
- `/commandes/manager`: manager command interface
- `/ar/ar.html`: AR menu experience

Routing is handled in `src/App.jsx` with `react-router-dom`.

## Environment Variables

Required values are documented in `.env.example`:

- `VITE_ADMIN_USER`
- `VITE_ADMIN_PASSWORD`
- `VITE_ADMIN_JWT_SECRET`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `API_PORT`
- `API_CORS_ORIGIN`

## Data and Supabase

- Application state and admin-managed content are synchronized via Supabase and localStorage fallback.
- Phase 1 adds branch registry (`erp_branches`) and notification device tokens (`notification_tokens`).
- Phase 1 non-OTP contract migration adds these entities: `organizations`, `branches` (view over `erp_branches`), `users`, `user_profiles`, `roles`, `permissions`, `role_permissions`, `user_branch_access`, `devices`, `notification_tokens`, `sync_queue`, `audit_logs`.
- Phase 2 inventory migration adds: `ingredient_units`, `ingredients`, `products`, `product_recipes`, `inventory_levels`, `inventory_movements`, `wastage_reasons`, `wastage_logs`, `reorder_rules`.
- Phase 3 procurement migration adds: `suppliers`, `supplier_contacts`, `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `goods_receipt_lines`, `supplier_price_history`, `payable_bills`.
- Phase 4 finance migration adds: `cash_sessions`, `cash_movements`, `payments`, `refunds`, `expenses`, `expense_categories`, `financial_closures`, `gl_mappings`, `fiscal_exports`.
- Phase 5 workforce migration adds: `shifts`, `shift_assignments`, `attendance_logs`, `checklist_templates`, `checklist_runs`, `incidents`, `incident_attachments`, `staff_kpis`.
- SQL migrations are in `supabase/migrations/`.
- Keep an up-to-date schema snapshot in `supabase/schema.sql` for easier onboarding and reviews.

## Phase 1 Foundation (Phone-First ERP)

- Multi-branch context with active branch selection and local-first persistence
- Role-based action permissions (`guest`, `staff`, `manager`, `admin`)
- Offline queue for critical actions (including order creation fallback)
- Background offline sync when connectivity is restored
- PWA install support (`manifest.webmanifest`, `sw.js`)
- Push notification bootstrap (permission request + device token registration)

## Phase 1 API (Non-OTP)

The following non-OTP endpoints are implemented in `server/phase1-api.js`:

- `GET /me/profile`
- `GET /me/permissions`
- `GET /branches`
- `POST /sync/queue`
- `POST /notifications/register-device`

Notes:

- OTP endpoints (`POST /auth/otp/request`, `POST /auth/otp/verify`) are intentionally excluded from this Phase 1 completion.
- All API routes require a Supabase bearer token in `Authorization: Bearer <token>`.

## Phase 2 Inventory Module

Phase 2 endpoints are implemented in `server/phase1-api.js` and guarded by the admin setting `showInventoryModule` (in `/chika/super-admin`):

- `GET /inventory/levels`
- `POST /inventory/adjustments`
- `POST /inventory/waste`
- `GET /products/recipes`
- `POST /orders/consume-stock`
- `GET /inventory/alerts/low-stock`

Phase 2 also includes automatic stock deduction after sale using database-side consumption logic and trigger wiring when an order becomes `served`.

## Phase 3 Procurement Module

Phase 3 endpoints are implemented in `server/phase1-api.js`:

- `GET /suppliers`
- `POST /purchase-orders`
- `POST /purchase-orders/{id}/approve`
- `POST /purchase-orders/{id}/receive`
- `GET /purchase-orders/status`
- `GET /suppliers/{id}/price-history`

Phase 3 covers supplier directory management, purchase-order lifecycle (create/approve/receive), invoice matching at receipt time, payable bill creation, and supplier price/lead-time history tracking.

## Phase 4 Finance Module

Phase 4 endpoints are implemented in `server/phase1-api.js`:

- `POST /cash-sessions/open`
- `POST /cash-sessions/{id}/close`
- `POST /expenses`
- `POST /refunds/request`
- `POST /refunds/{id}/approve`
- `GET /finance/daily-summary`
- `GET /finance/export`

Phase 4 covers shift cash sessions, expense recording, refund/void approval, daily financial snapshot persistence, and tax-ready finance exports (JSON or CSV output).

## Phase 5 Workforce Operations Module

Phase 5 endpoints are implemented in `server/phase1-api.js`:

- `POST /shifts`
- `POST /attendance/check-in`
- `POST /attendance/check-out`
- `GET /attendance/today`
- `POST /checklists/{id}/complete`
- `POST /incidents`
- `GET /staff/kpis`

Phase 5 covers shift planning, mobile attendance capture, opening and closing checklists, incident reporting with photo evidence metadata, and KPI aggregation for staff performance dashboards.

## Testing and CI

- Current unit tests are in `src/utils/orderService.test.js`.
- CI workflow is defined in `.github/workflows/ci.yml` and runs:
	- dependency install (`npm ci`)
	- unit tests (`npm run test`)
	- production build (`npm run build`)

## Suggested Next Improvements

- Expand test coverage for checkout and command interfaces
- Add route-level access guards based on authenticated role
- Add Supabase Realtime subscriptions for live order updates
- Reduce component complexity in `src/compoents/CoffeeShop.jsx`
