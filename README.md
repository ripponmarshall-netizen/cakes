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
| **Hand** | What one hand pays each month (e.g. J$10,000). Members can throw several hands, or a **half hand**. |
| **Length** | Months the cycle runs. Usually equals the number of hands; you can change it. |
| **Banker fee** | Taken out of each draw — a flat J$ amount or a % of the draw. |

- Each hand pays **hand × length** over the cycle and draws once.
- A draw is worth **hand × length** (gross). The member receives that **minus the fee**.
- A member with 2 hands pays double each month and draws twice.
- A **half hand** pays half and gets half a draw. Two half hands share one draw
  slot (same month, each gets half, each pays half the fee). Hands go in steps
  of ½: ½, 1, 1½, 2…
- Draw slots are spaced by running weight: the slot that brings the total to
  *W* half-hands (out of *H*) draws in month ⌈*W*·*T*/*H*⌉. When months = hands
  that's one draw a month; otherwise draws are spaced so collections always
  cover them (as long as everyone pays).
- **In the pot** = everything collected − every draw and refund paid out (gross).
  **Should be** = what the pot would hold if nobody were behind.
- **At risk** = for each member who has drawn: what they drew (gross) minus what
  they've paid in. That's what the group loses if they stop paying now. Flagged
  red when they're also behind.

All of this lives in [`src/lib/calc.ts`](src/lib/calc.ts) as pure functions, with
tests in `calc.test.ts` (`npm test`).

## Features

- **Home dashboard** — across every partner: cash in the pots, owed now, money
  at risk, fees earned and to come, draws due this week, and who's behind.
- **Payments** — month-by-month checklist. *Mark paid* in one tap (with
  **Undo** and a WhatsApp **receipt** on the confirmation), *Mark all paid*,
  or record part payments with method (cash / bank transfer / Lynk / other),
  reference, date and note. Each row shows earlier months still owed. One-tap
  WhatsApp nudge for anyone unpaid.
- **Members** — whole or half hands, what they've paid, behind/ahead, what
  they'll receive, draw months, and an **at-risk** flag once they've drawn.
- **Draws** — the full schedule, with shared half-hand slots. Tap a month to
  **move a draw to any open position** (or use the arrows), *Draw lots* to
  shuffle the unpaid draws, *Pay* to record a payout (fee pre-filled). If the
  member is behind you're warned and can **take the arrears out of the draw**
  — the draw and the arrears are saved together, in one transaction.
- **No deleting money** — payments and payouts are *voided* with a reason, not
  deleted, and amounts can't be edited. Every change lands in an **audit log**
  (*History*) written by the database, with who did it and when.
- **Reminders & statements** — *Remind* steps through everyone behind with a
  pre-written WhatsApp message (`wa.me` link; Jamaican numbers normalised to
  1-876). Every reminder is logged ("last reminded 3 days ago"). Each member
  has a printable statement (Print / Save as PDF). Add **how members pay you**
  (Lynk handle, bank account) in partner settings and it appears on their
  statement and in reminders.
- **Cash count** — count the box, enter it, and see straight away whether
  it's over or short of what the ledger says. Every count is kept.
- **Member links** — each member gets a private read-only link
  (`#/s/<token>`, no sign-in) showing only their own payments and draws.
  Optionally also the full draw order with names (partner setting). Links can
  be reset.
- **Replace a member mid-cycle** — *buy-out* (new person takes over the hand,
  payments and draws carry over) or *refund from pot* (old member refunded, new
  member starts from month 1). The old member's record stays under "Left".
- **Export & backup** — per-partner CSVs (transactions, members) and a full JSON
  backup of everything, including the audit log.
- **Installable & offline** — a PWA: add it to your home screen. Offline it
  opens with the last data loaded on that phone, and **payments, payouts,
  voids and cash counts are saved on the phone and sync when the signal is
  back** (the banner shows how many are waiting). Settings, members and the
  draw order still need a connection.
- **Can't record twice** — every payment gets its id on the phone and the
  server ignores ids it already has, so a double tap or a retry on a bad
  connection records it once.
- **Next round** — when a cycle ends, start the next one with the same
  members and settings in one step.
- **Bankers** — tap your initials (top right) to add or remove co-bankers by
  email.
- **Several partners** side by side, each with its own settings.
- **Realtime sync** between bankers' devices.

## Setup

### 1. Database

Run the migrations in order in the Supabase SQL editor (or `supabase db push`):

1. [`20261002000000_partner_ledger.sql`](supabase/migrations/20261002000000_partner_ledger.sql) — tables + RLS.
2. [`20261003000000_ledger_v2.sql`](supabase/migrations/20261003000000_ledger_v2.sql) — half hands,
   payment methods, voiding + audit log, member replacement, statement links.
   Safe to run on existing data and safe to re-run.
3. [`20261006000000_ledger_v3.sql`](supabase/migrations/20261006000000_ledger_v3.sql) — retry-safe
   payouts (`record_payout`), cash counts, the reminder log, starting the next
   round, managing bankers in the app, and payment details on statements.
   Safe to re-run.

> **Run each migration before deploying the app version that needs it.**
> The app from v3 on records draws through `record_payout`; on a database
> without it, payouts are refused (and say so).

They're additive — they don't touch the old `cake_items` / `orders` tables.

> The v2 migration exposes one function to signed-out visitors:
> `member_statement(token)`, which returns a single member's own record for the
> statement link. Everything else stays banker-only.

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

To add a co-banker after they've signed up, tap your initials (top right) →
**Add a co-banker**. Or, in the SQL editor:

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
  lib/          calc.ts (all money maths), format.ts, types.ts, supabase.ts,
                whatsapp.ts, csv.ts, cache.ts (offline copy), outbox.ts
                (queued, retry-safe writes), ledgerWrites.ts, rounds.ts
  hooks/        useLiveTable (realtime), usePartnerData, useAdmin, useHashRoute
  components/
    AuthScreen, AccessGate, Header, Logo, PublicStatement, OfflineBanner,
    BankersModal
    partner/    PartnerList (dashboard), PartnerView, PaymentsTab, MembersTab,
                DrawsTab, PartnerForm, MemberModal, ContributionModal,
                PayoutModal, StatementView/Modal, ReplaceMemberModal,
                RemindModal, HistoryModal, ExportModal, VoidDialog,
                CashCountModal, NextRoundModal
    ui/         Button, Input, Modal, Confirm, Toast, Badge, Icon, …
supabase/migrations/   schema + RLS
```
