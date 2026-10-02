# Partner Ledger

A simple, polished web app for running a **partner** (rotating savings circle):
track members and their hands, tick off monthly payments, see what's in the
pot, and record each draw with the banker's fee.

Built with **React + Vite + TypeScript + Tailwind**, backed by **Supabase**
(Postgres, auth, realtime). Only the banker (and any co-bankers) sign in —
members don't need accounts.

## How the money works

| Setting | Meaning |
| --- | --- |
| **Hand** | What one hand pays each month (e.g. J$10,000). Members can throw several hands. |
| **Length** | Months the cycle runs. Usually equals the number of hands; you can change it. |
| **Banker fee** | Taken out of each draw — a flat J$ amount or a % of the draw. |

- Each hand pays **hand × length** over the cycle and draws once.
- A draw is worth **hand × length** (gross). The member receives that **minus the fee**.
- A member with 2 hands pays double each month and draws twice.
- With *H* hands over *T* months, hand #*i* draws in month ⌈(*i*+1)·*T*/*H*⌉. When
  *T* = *H* that's one draw a month; otherwise draws are spaced so collections
  always cover them (as long as everyone pays).
- **In the pot** = everything collected − every draw paid out (gross).
  **Should be** = what the pot would hold if nobody were behind.

All of this lives in [`src/lib/calc.ts`](src/lib/calc.ts) as pure functions, with
tests in `calc.test.ts` (`npm test`).

## Features

- **Payments** — month-by-month checklist. *Mark paid* in one tap, *Mark all
  paid*, or record part payments with dates and notes.
- **Members** — hands, what they've paid, whether they're behind or ahead, what
  they'll receive in total, and their draw months.
- **Draws** — the full schedule. Reorder with arrows, *Draw lots* to shuffle the
  unpaid draws, *Pay* to record a payout (fee pre-filled), undo if needed.
- **Several partners** side by side, each with its own settings.
- **Realtime sync** between bankers' devices.

## Setup

### 1. Database

Run [`supabase/migrations/20261002000000_partner_ledger.sql`](supabase/migrations/20261002000000_partner_ledger.sql)
in the Supabase SQL editor (or `supabase db push`). It's additive — it does not
touch the old `cake_items` / `orders` tables. Drop those yourself if you no
longer need them.

### 2. Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

### 3. Become the banker

Create an account (invite code from `VITE_SIGNUP_INVITE_CODE`), then click
**Claim banker access**. Only the first person can claim it. Every other
account sees "Waiting for access" and can read nothing — enforced by Row Level
Security, not by the UI.

To add a co-banker after they've signed up, run in the SQL editor:

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'cobanker@example.com';
```

> Tip: once the bankers' accounts exist, turn off sign-ups in
> **Supabase → Authentication → Sign In / Providers** for belt-and-braces.

## Scripts

```bash
npm run dev       # local dev server
npm test          # unit tests for the partner maths
npm run build     # type-check + production build to dist/
```

## Deploy

Pushing to `main` builds and deploys to GitHub Pages via
`.github/workflows/deploy.yml`. Override the `VITE_*` values with repository
Variables if needed.

## Project layout

```
src/
  lib/          calc.ts (all money maths), format.ts, types.ts, supabase.ts
  hooks/        useLiveTable (realtime), usePartnerData, useAdmin, useHashRoute
  components/
    AuthScreen, AccessGate, Header, Logo
    partner/    PartnerList, PartnerView, PaymentsTab, MembersTab, DrawsTab,
                PartnerForm, MemberModal, ContributionModal, PayoutModal
    ui/         Button, Input, Modal, Confirm, Toast, Badge, Icon, …
supabase/migrations/   schema + RLS
```
