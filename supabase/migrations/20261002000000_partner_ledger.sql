-- Partner Ledger schema: rotating-draw savings groups ("partner"), their members,
-- monthly contributions and payouts. Only users listed in app_admins can read or
-- write anything. Safe to run on the existing project: it does not touch the old
-- cake_items / orders tables.

-- ─── Profiles (display names). Only created if the project doesn't have them yet.
do $$
begin
  if to_regclass('public.profiles') is null then
    create table public.profiles (
      id uuid primary key references auth.users (id) on delete cascade,
      display_name text not null,
      created_at timestamptz not null default now()
    );
    alter table public.profiles enable row level security;
    create policy "profiles readable by signed-in users" on public.profiles
      for select to authenticated using (true);
    create policy "users update own profile" on public.profiles
      for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

    create or replace function public.handle_new_user()
    returns trigger language plpgsql security definer set search_path = '' as $fn$
    begin
      insert into public.profiles (id, display_name)
      values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
      )
      on conflict (id) do nothing;
      return new;
    end;
    $fn$;

    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- ─── Admins (bankers). Signing up alone grants no access to any data.
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

drop policy if exists "admins see admin list" on public.app_admins;
create policy "admins see admin list" on public.app_admins
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- The very first signed-in user to call this becomes the banker. After that it
-- only reports whether the caller is already an admin. Add co-bankers via SQL.
create or replace function public.claim_admin()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  lock table public.app_admins in exclusive mode;
  if exists (select 1 from public.app_admins) then
    return exists (select 1 from public.app_admins where user_id = auth.uid());
  end if;
  insert into public.app_admins (user_id) values (auth.uid());
  return true;
end;
$$;

-- Lets the app show "claim" vs "ask the banker" without exposing the admin list.
create or replace function public.has_admins()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins);
$$;

revoke execute on function public.claim_admin() from public, anon;
revoke execute on function public.has_admins() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.claim_admin() to authenticated;
grant execute on function public.has_admins() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- ─── Partners: one row per savings group / cycle.
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  hand_amount numeric(12, 2) not null check (hand_amount > 0),
  start_date date not null,
  term_months integer not null check (term_months between 1 and 120),
  fee_type text not null default 'flat' check (fee_type in ('flat', 'percent')),
  fee_value numeric(12, 2) not null default 0 check (fee_value >= 0),
  -- Member ids, one entry per hand, in draw order. Reconciled client-side when
  -- members or hands change, so it never needs to be perfectly in sync.
  draw_order uuid[] not null default '{}',
  notes text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint percent_fee_max check (fee_type <> 'percent' or fee_value <= 100)
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists partners_touch_updated_at on public.partners;
create trigger partners_touch_updated_at
  before update on public.partners
  for each row execute function public.touch_updated_at();

-- ─── Members of a partner. A person throwing two hands draws twice.
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  phone text,
  hands integer not null default 1 check (hands between 1 and 50),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, partner_id)
);
create index if not exists members_partner_idx on public.members (partner_id);

-- ─── Money in. "period" is the month number of the cycle (1 = first month).
-- Several rows per member/period are allowed (part payments).
-- The member FK is NO ACTION (not cascade): a member with money recorded
-- can't be deleted on their own, but deleting the whole partner still works.
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  member_id uuid not null,
  period integer not null check (period >= 1),
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  note text,
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (member_id, partner_id) references public.members (id, partner_id)
);
create index if not exists contributions_partner_idx on public.contributions (partner_id);
create index if not exists contributions_member_idx on public.contributions (member_id, partner_id);

-- ─── Money out: a draw handed to a member, with the banker's fee kept back.
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  member_id uuid not null,
  period integer not null check (period >= 1),
  gross numeric(12, 2) not null check (gross > 0),
  fee numeric(12, 2) not null default 0 check (fee >= 0 and fee <= gross),
  net numeric(12, 2) generated always as (gross - fee) stored,
  paid_on date not null default current_date,
  note text,
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (member_id, partner_id) references public.members (id, partner_id)
);
create index if not exists payouts_partner_idx on public.payouts (partner_id);
create index if not exists payouts_member_idx on public.payouts (member_id, partner_id);

-- ─── Row Level Security: admins only, for everything.
alter table public.partners enable row level security;
alter table public.members enable row level security;
alter table public.contributions enable row level security;
alter table public.payouts enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['partners', 'members', 'contributions', 'payouts'] loop
    execute format('drop policy if exists "admins full access" on public.%I', t);
    execute format(
      'create policy "admins full access" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end;
$$;

-- ─── Realtime, so two bankers on different phones stay in sync.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['partners', 'members', 'contributions', 'payouts'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
