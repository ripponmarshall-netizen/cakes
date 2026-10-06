-- Partner Ledger v3: retry-safe draws, cash counts, a reminder log, starting the
-- next round, managing co-bankers in the app, and how members pay the banker.
-- Run after 20261003000000_ledger_v2.sql. Safe to re-run.

-- ─── How members pay you (Lynk handle, bank account…), shown on their statement.
alter table public.partners add column if not exists pay_details text;
alter table public.partners drop constraint if exists partners_pay_details_len;
alter table public.partners add constraint partners_pay_details_len
  check (pay_details is null or char_length(pay_details) <= 300);

-- ─── Record a draw and any arrears taken out of it in one transaction.
-- Ids come from the phone, so sending the same draw twice (a retry after a
-- dropped connection) records it once. Returns false when it was already there.
create or replace function public.record_payout(p_payout jsonb, p_deductions jsonb default '[]'::jsonb)
returns boolean language plpgsql set search_path = '' as $$
declare
  new_id uuid;
  d jsonb;
  pid uuid := (p_payout ->> 'partner_id')::uuid;
  mid uuid := (p_payout ->> 'member_id')::uuid;
  paid date := coalesce((p_payout ->> 'paid_on')::date, current_date);
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  insert into public.payouts (id, partner_id, member_id, period, gross, fee, kind, method, ref, paid_on, note)
  values (
    coalesce((p_payout ->> 'id')::uuid, gen_random_uuid()),
    pid,
    mid,
    (p_payout ->> 'period')::integer,
    (p_payout ->> 'gross')::numeric,
    coalesce((p_payout ->> 'fee')::numeric, 0),
    'draw',
    coalesce(p_payout ->> 'method', 'cash'),
    nullif(btrim(coalesce(p_payout ->> 'ref', '')), ''),
    paid,
    nullif(btrim(coalesce(p_payout ->> 'note', '')), '')
  )
  on conflict (id) do nothing
  returning id into new_id;

  if new_id is null then
    return false;
  end if;

  for d in select value from jsonb_array_elements(coalesce(p_deductions, '[]'::jsonb)) loop
    insert into public.contributions (id, partner_id, member_id, period, amount, paid_on, method, note)
    values (
      coalesce((d ->> 'id')::uuid, gen_random_uuid()),
      pid,
      mid,
      (d ->> 'period')::integer,
      (d ->> 'amount')::numeric,
      paid,
      'deduction',
      nullif(btrim(coalesce(d ->> 'note', '')), '')
    )
    on conflict (id) do nothing;
  end loop;
  return true;
end;
$$;

revoke execute on function public.record_payout(jsonb, jsonb) from public, anon;
grant execute on function public.record_payout(jsonb, jsonb) to authenticated;

-- ─── Cash counts: what was physically in the box against what the ledger says.
create table if not exists public.cash_counts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  counted_on date not null default current_date,
  counted numeric(12, 2) not null,
  expected numeric(12, 2) not null,
  note text check (note is null or char_length(note) <= 200),
  counted_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cash_counts_partner_idx on public.cash_counts (partner_id, created_at);

-- ─── Reminder log: who was nudged on WhatsApp, and when.
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  kind text not null default 'reminder' check (kind in ('reminder', 'statement', 'receipt')),
  sent_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists reminders_partner_idx on public.reminders (partner_id, created_at);

-- Both are append-only from the app: read and add, never edit or delete.
alter table public.cash_counts enable row level security;
alter table public.reminders enable row level security;
do $$
declare
  t text;
begin
  foreach t in array array['cash_counts', 'reminders'] loop
    execute format('drop policy if exists "admins read" on public.%I', t);
    execute format('drop policy if exists "admins insert" on public.%I', t);
    execute format('create policy "admins read" on public.%I for select to authenticated using (public.is_admin())', t);
    execute format('create policy "admins insert" on public.%I for insert to authenticated with check (public.is_admin())', t);
  end loop;
end;
$$;

drop trigger if exists cash_counts_audit on public.cash_counts;
create trigger cash_counts_audit after insert or update or delete on public.cash_counts
  for each row execute function public.write_audit();

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['cash_counts', 'reminders'] loop
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

-- ─── Start the next round: same settings and the same (current) members,
-- starting fresh. Members keep the order they joined the old round in.
create or replace function public.start_next_round(p_partner uuid, p_name text, p_start date)
returns uuid language plpgsql set search_path = '' as $$
declare
  old_p public.partners%rowtype;
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  select * into old_p from public.partners where id = p_partner;
  if not found then
    raise exception 'Partner not found';
  end if;

  insert into public.partners (name, hand_amount, start_date, term_months, fee_type, fee_value, notes, share_schedule, pay_details)
  values (btrim(p_name), old_p.hand_amount, p_start, old_p.term_months, old_p.fee_type, old_p.fee_value,
          old_p.notes, old_p.share_schedule, old_p.pay_details)
  returning id into new_id;

  -- now() is the same for the whole transaction; space the join times out so
  -- the join order (which sets the default draw order) is kept.
  insert into public.members (partner_id, name, phone, hands, notes, created_at)
  select new_id, m.name, m.phone, m.hands, m.notes,
         now() + (row_number() over (order by m.created_at, m.id)) * interval '1 millisecond'
  from public.members m
  where m.partner_id = p_partner and m.replaced_by is null;

  return new_id;
end;
$$;

revoke execute on function public.start_next_round(uuid, text, date) from public, anon;
grant execute on function public.start_next_round(uuid, text, date) to authenticated;

-- ─── Co-bankers, managed from the app instead of the SQL editor.
create or replace function public.list_admins()
returns table (user_id uuid, display_name text, email text, added_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return query
    select a.user_id, coalesce(p.display_name, split_part(u.email, '@', 1))::text, u.email::text, a.created_at
    from public.app_admins a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    order by a.created_at;
end;
$$;

-- They must have signed up first; this only grants access to an existing account.
create or replace function public.add_admin(p_email text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  select id into uid from auth.users where lower(email) = lower(btrim(p_email));
  if uid is null then
    raise exception 'No account uses that email yet. Ask them to create one first, then add them.';
  end if;
  insert into public.app_admins (user_id) values (uid) on conflict (user_id) do nothing;
  return uid;
end;
$$;

create or replace function public.remove_admin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  lock table public.app_admins in exclusive mode;
  if (select count(*) from public.app_admins) <= 1 then
    raise exception 'There has to be at least one banker.';
  end if;
  delete from public.app_admins where user_id = p_user;
end;
$$;

revoke execute on function public.list_admins() from public, anon;
revoke execute on function public.add_admin(text) from public, anon;
revoke execute on function public.remove_admin(uuid) from public, anon;
grant execute on function public.list_admins() to authenticated;
grant execute on function public.add_admin(text) to authenticated;
grant execute on function public.remove_admin(uuid) to authenticated;

-- ─── Member statement link: now also shows how to pay the banker.
create or replace function public.member_statement(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  m public.members%rowtype;
  p public.partners%rowtype;
  lineage uuid[];
begin
  select * into m from public.members where share_token = p_token;
  if not found then
    return null;
  end if;
  select * into p from public.partners where id = m.partner_id;

  -- This member plus anyone whose hand they bought.
  with recursive chain(id) as (
    select m.id
    union
    select x.id from public.members x join chain c on x.replaced_by = c.id where x.transfer_mode = 'buyout'
  )
  select array_agg(id) into lineage from chain;

  return jsonb_build_object(
    'member_id', m.id,
    'partner', jsonb_build_object(
      'id', p.id, 'name', p.name, 'hand_amount', p.hand_amount, 'start_date', p.start_date,
      'term_months', p.term_months, 'fee_type', p.fee_type, 'fee_value', p.fee_value,
      'draw_order', to_jsonb(p.draw_order), 'share_schedule', p.share_schedule,
      'pay_details', p.pay_details,
      'created_at', p.created_at, 'updated_at', p.updated_at
    ),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'partner_id', x.partner_id, 'hands', x.hands, 'created_at', x.created_at,
        'replaced_by', x.replaced_by, 'transfer_mode', x.transfer_mode, 'left_on', x.left_on,
        'name', case when x.id = any(lineage) or p.share_schedule then x.name else 'Member' end
      ))
      from public.members x where x.partner_id = p.id
    ), '[]'::jsonb),
    'contributions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'partner_id', c.partner_id, 'member_id', c.member_id, 'period', c.period,
        'amount', c.amount, 'paid_on', c.paid_on, 'method', c.method, 'created_at', c.created_at
      ) order by c.paid_on, c.created_at)
      from public.contributions c
      where c.member_id = any(lineage) and c.voided_at is null
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'partner_id', o.partner_id, 'member_id', o.member_id, 'period', o.period,
        'gross', o.gross, 'fee', o.fee, 'net', o.net, 'kind', o.kind, 'paid_on', o.paid_on,
        'created_at', o.created_at
      ) order by o.paid_on, o.created_at)
      from public.payouts o
      where o.partner_id = p.id and o.voided_at is null and o.kind = 'draw'
        and (o.member_id = any(lineage) or p.share_schedule)
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.member_statement(uuid) from public;
grant execute on function public.member_statement(uuid) to anon, authenticated;
