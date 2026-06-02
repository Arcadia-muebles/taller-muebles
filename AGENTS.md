# Project Context For Future Agents

## Project Summary

This repository contains a web platform for a furniture workshop owned by Rodrigo. The client has two stores/workshops:

- `LH`: Leather House
- `LR`: La Reina

The goal is to replace/improve an existing Excel workflow used to control sales notes and production. The product must feel professional, minimal, operational, and worthy of a paid custom project. It must not be a direct copy of the reference/prototype the client shared; that prototype is only a source of business data and process cues.

The system should behave like a robust internal production platform:

- Admin users manage sales notes, historical orders, production status, stock, users, reports, and settings.
- Workshop operators see a simpler production queue and only update the stages they need.
- Finished orders leave the active production view but remain in historical records.
- Data should be traceable, permissioned, and eventually ready for AI summaries/recommendations.

## Repository Layout

The Next.js app lives inside:

```text
taller-muebles/
```

The git repository root is the parent folder:

```text
C:\Users\ninch\OneDrive\Documents\Taller de Muebles
```

GitHub remote:

```text
origin https://github.com/martinbaumann-sky/taller-muebles.git
```

Current branch:

```text
master
```

## Stack

- Next.js App Router, currently `next@16.2.7`
- React `19.2.4`
- TypeScript
- Tailwind CSS v4
- TanStack Table
- React Hook Form
- Zod
- lucide-react
- Supabase:
  - PostgreSQL
  - Auth
  - Storage
  - RLS
- Vercel intended for deployment
- OpenAI API / Vercel AI SDK intended later for AI features

Important Next.js note: this project uses a new Next.js version. Do not rely blindly on older App Router habits. Check current Next.js docs/patterns when touching routing, cookies, middleware/proxy, Server Actions, or caching.

## Main Product Areas

### Admin Panel

Route:

```text
/admin
```

Admin sees:

- Active production orders
- KPIs
- Urgent orders
- Blocked orders
- Delivery risks
- Stock alerts
- Production load by process
- Links to stock, reports, users, and settings

Admin order routes:

```text
/admin/orders/new
/admin/orders/[id]
```

Secondary admin modules:

```text
/admin/stock
/admin/reports
/admin/users
/admin/settings
```

### Workshop Panel

Route:

```text
/taller
```

This is intentionally simpler than admin. Operators should see:

- Work queue
- Area filters
- Current production step
- Delivery deadline
- Minimal product/client data
- Buttons to start, complete, or block a step

Do not route workshop-specific detail experiences back into admin unless it is explicitly meant for managers. Keep admin and workshop mental models separate.

### Login

Route:

```text
/login
```

The login screen is visually implemented and prepared for Supabase OTP. In demo mode it returns a success message without sending an actual email. With Supabase environment variables configured, it should use Supabase auth.

## Key Business Concepts

### Stores

- `LH`: Leather House
- `LR`: La Reina

### Order Fields

Core order data should include:

- Store
- Internal code
- Sales note number
- Client name
- Product/model
- Material
- Color
- Entry date
- Delivery date
- Priority
- General status
- Condition
- Warranty flag
- Assigned person
- Observations
- Attachments

### Production Steps

Initial steps:

- Structure / `structure`
- Cutting / `cutting`
- Sewing / `sewing`
- Upholstery / `upholstery`
- Quality review / `quality`

Step statuses:

- `pending`
- `active`
- `done`
- `blocked`

Order statuses:

- `draft`
- `scheduled`
- `in_production`
- `blocked`
- `urgent`
- `quality_control`
- `completed`
- `cancelled`

## Current Implementation State

Already implemented:

- Professional Next.js app scaffold inside `taller-muebles/`
- Admin panel
- Workshop panel
- Login view and login Server Action
- Order list with search/table
- Order creation form
- Order detail view
- Stock page
- Reports page
- Users/roles page
- Settings/rules page
- Demo production queue actions
- Server Actions prepared for:
  - creating orders
  - updating production steps
- Data repository layer:
  - uses Supabase when env vars exist
  - falls back to mock data otherwise
- Supabase migration with:
  - stores
  - profiles
  - orders
  - production steps
  - comments
  - attachments
  - materials
  - stock movements
  - audit logs
  - RLS policies
  - private storage bucket for order attachments
- Product blueprint in:

```text
taller-muebles/docs/product-blueprint.md
```

Important: Supabase has not yet been linked/executed against a real project in this workspace. The migration exists but has not been applied.

## Important Files

```text
taller-muebles/src/app/admin/page.tsx
taller-muebles/src/app/taller/page.tsx
taller-muebles/src/app/login/page.tsx
taller-muebles/src/app/admin/orders/actions.ts
taller-muebles/src/app/taller/actions.ts
taller-muebles/src/components/app-shell.tsx
taller-muebles/src/components/order-table.tsx
taller-muebles/src/components/order-form.tsx
taller-muebles/src/components/worker-queue.tsx
taller-muebles/src/lib/repositories/production.ts
taller-muebles/src/lib/mock-data.ts
taller-muebles/src/lib/types.ts
taller-muebles/src/lib/supabase/server.ts
taller-muebles/src/lib/supabase/browser.ts
taller-muebles/src/lib/supabase/admin.ts
taller-muebles/supabase/migrations/20260601213000_initial_production_schema.sql
```

## Environment Variables

Example file:

```text
taller-muebles/.env.example
```

Expected values:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code. Never prefix it with `NEXT_PUBLIC_`.

## Commands

Run from:

```text
taller-muebles/
```

Install:

```text
npm install
```

Dev server:

```text
npm run dev
```

Build:

```text
npm run build
```

Lint:

```text
npm run lint
```

Previous validation status:

- `npm run build` passed.
- `npm run lint` passed.

## Supabase Notes

Supabase CLI was not installed when the initial work was done. The migration file was written manually and should be reviewed/applied once the client creates or provides a Supabase project.

Next technical steps for Supabase:

1. Create/link Supabase project.
2. Add `.env.local`.
3. Run migration.
4. Generate real Supabase TypeScript types.
5. Replace manual `database.types.ts` with generated types.
6. Verify RLS with admin, manager, operator, and viewer users.
7. Replace remaining demo-only behavior with persistent Server Actions.

Security priorities:

- RLS must remain enabled on exposed tables.
- Operators should not edit commercial/admin fields.
- Admin/manager can create and update orders.
- Operators can update their assigned/area production steps.
- Critical changes should be recorded in `audit_logs`.

## Product Principles

- The table is the center of admin operations.
- The workshop UI must be simpler than the admin UI.
- Do not overwhelm operators with sales/admin data.
- Never truly delete critical records; archive, cancel, or mark completed.
- Keep visual style minimal, quiet, dense, and professional.
- Prefer practical workflow clarity over decorative UI.
- Use real icons from lucide-react.
- Avoid making this look like a landing page.
- Avoid a direct copy of the Claude artifact/prototype.
- Treat the reference spreadsheet/prototype as a business-process reference only.

## Known Gaps / Next Work

The project is not complete. Do not mark it complete until these areas are implemented and verified:

- Real Supabase project connected.
- Auth/session protection added.
- Role-based routing and permissions enforced.
- Generated Supabase types used.
- Admin order create/edit/close flows persist real data.
- Workshop actions persist real production updates.
- Blocked step flow asks for a reason.
- Dedicated workshop order detail route exists.
- Attachments upload to Supabase Storage.
- Stock movement create/update flows implemented.
- Audit log visible or at least queryable.
- Historical completed orders view implemented.
- IA features added only after reliable operational data exists.
- Mobile/tablet behavior verified for workshop usage.

## Git / Publishing

Initial commit:

```text
792a2af Initial furniture workshop platform
```

Remote:

```text
https://github.com/martinbaumann-sky/taller-muebles.git
```

When committing, avoid logs/build artifacts. The app `.gitignore` ignores:

- `node_modules`
- `.next`
- env files
- dev-server logs

There may be untracked files at the repo root created by local dev tooling, such as logs or scripts. Inspect `git status` before staging and do not commit unrelated generated files.

