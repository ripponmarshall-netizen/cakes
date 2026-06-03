# 🧁 Sweet Sales — Cake Orders & Sales

A fun, simple, and polished web app for a **team of two** to sign in and manage
cake **sales and orders** together. Built with **React + Vite + TypeScript +
Tailwind CSS**, backed by **Supabase** for the database, authentication, and
**realtime sync** — when one person adds something, it appears for the other
instantly.

## Features

- 🔐 **Private sign-in** — two sellers, each with their own account.
- 🎂 **Editable cake menu** — keep a list of cakes, each with a description, a
  "what it comes with" list, and a price (in JMD).
- 🧾 **Record sales** — pick a cake, add the customer's name, and mark it
  **Unpaid**, **Deposit** (with amount), or **Paid in full**. Balance is worked
  out for you.
- 👥 **Who logged it** — every order shows which teammate recorded it and when.
- 🔄 **Realtime sync** — both screens stay in sync automatically via Supabase.
- 📊 **At-a-glance totals** — sales count, money collected, and outstanding
  balance.

## Quick start (local)

```bash
npm install
cp .env.example .env.local   # values are already filled in for this project
npm run dev
```

Then open the printed URL (http://localhost:5173).

### Environment variables

| Variable | What it is |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | The publishable / anon key (safe in the browser) |
| `VITE_SIGNUP_INVITE_CODE` | A shared secret required to create an account |

> The Supabase URL and publishable key are designed to be public — they're safe
> to ship in a browser app. Access to your data is protected by Row Level
> Security and the login.

## First-run: create the two accounts

1. Start the app and click **Create account**.
2. Enter your name, email, password, and the **invite code**
   (default: `sweetteam` — change it in `.env.local`).
3. Have your teammate do the same on their own device.
4. Once both accounts exist, change `VITE_SIGNUP_INVITE_CODE` to something new
   (and redeploy) so no one else can register.

> **Email confirmation:** By default the app signs you straight in. If you've
> turned on email confirmation in **Supabase → Authentication → Providers →
> Email**, you'll be asked to confirm via email before signing in. For a quick
> two-person setup you can leave confirmation off.

## How it's organised

```
src/
  lib/         supabase client, shared types, money/date formatting
  context/     AuthContext (session + profile)
  hooks/       useCakeItems, useOrders (with realtime subscriptions)
  components/
    AuthScreen, Header, SummaryBar
    cakes/     CakeMenu, CakeCard, CakeForm
    orders/    OrdersView, OrderRow, OrderForm
    ui/        Button, Input, Modal, Badge, Toast, EmptyState
```

## Backend (Supabase)

The database has three tables, all protected with Row Level Security so only
signed-in users can read or write:

- **`profiles`** — a display name per user (auto-created on signup).
- **`cake_items`** — your editable cake menu.
- **`orders`** — the sales ledger (customer, payment status, deposit, total,
  who recorded it).

`cake_items` and `orders` are published to Supabase Realtime, which is what
keeps both teammates in sync.

## Build & deploy

```bash
npm run build      # type-checks and builds to dist/
npm run preview    # preview the production build locally
```

`dist/` is a static site — deploy it to any static host (Vercel, Netlify,
Cloudflare Pages, etc.). Set the three `VITE_*` environment variables in your
host's dashboard.
