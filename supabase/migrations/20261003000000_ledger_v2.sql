-- Partner Ledger v2: half hands, payment methods, void-instead-of-delete with a
-- full audit trail, member replacement, and read-only member statement links.
-- Run after 20261002000000_partner_ledger.sql. Safe to re-run.

-- ─── Half hands: hands is now a multiple of 0.5 (½, 1, 1½, 2, …).
alter table public.members drop constraint if exists members_hands_check;
alter table public.members alter column hands type numeric(4, 1) using hands::numeric;
alter table public.members drop constraint if exists members_hands_half_steps;
alter table public.members add constraint members_hands_half_steps
  check (hands >= 0.5 and hands <= 50 and hands * 2 = trunc(hands * 2));

-- ─── Draw order entries are now text: "id" = a full hand's draw,
-- "id|id" = one draw shared by two half hands, "id|" = a half hand waiting for a partner.
alter table public.partners alter column draw_order drop default;
alter table public.partners alter column draw_order type text[] using draw_order::text[];
alter table public.partners alter column draw_order set default '{}';

-- Whether members' statement links show the whole draw order (with names).
alter table public.partners add column if not exists share_schedule boolean not null default false;

-- ─── Members: statement link token, and replacement mid-cycle.
-- A replaced member keeps their row (history stays true) and points at whoever
-- took over. 'buyout' = the new member bought the hand, so the old member's
-- payments and draws count toward it. 'refund' = the old member was refunded
-- from the pot and the new member starts from scratch.
alter table public.members add column if not exists share_token uuid not null default gen_random_uuid();
alter table public.members add column if not exists replaced_by uuid references public.members (id) on delete set null;
alter table public.members add column if not exists left_on date;
alter table public.members add column if not exists transfer_mode text;
alter table public.members drop constraint if exists members_transfer_mode_check;
alter table public.members add constraint members_transfer_mode_check
  check (transfer_mode is null or transfer_mode in ('buyout', 'refund'));
create unique index if not exists members_share_token_idx on public.members (share_token);

-- ─── Money rows: payment method, reference, and voiding.
alter table public.contributions add column if not exists method text not null default 'cash';
alter table public.contributions add column if not exists ref text;
alter table public.contributions add column if not exists voided_at timestamptz;
alter table public.contributions add column if not exists voided_by uuid references auth.users (id) on delete set null;
alter table public.contributions add column if not exists void_reason text;
alter table public.contributions drop constraint if exists contributions_method_check;
alter table public.contributions add constraint contributions_method_check
  check (method in ('cash', 'transfer', 'lynk', 'deduction', 'other'));

alter table public.payouts add column if not exists kind text not null default 'draw';
alter table public.payouts add column if not exists method text not null default 'cash';
alter table public.payouts add column if not exists ref text;
alter table public.payouts add column if not exists voided_at timestamptz;
alter table public.payouts add column if not exists voided_by uuid references auth.users (id) on delete set null;
alter table public.payouts add column if not exists void_reason text;
alter table public.payouts drop constraint if exists payouts_kind_check;
alter table public.payouts add constraint payouts_kind_check check (kind in ('draw', 'refund'));
alter table public.payouts drop constraint if exists payouts_method_check;
alter table public.payouts add constraint payouts_method_check
  check (method in ('cash', 'transfer', 'lynk', 'other'));

-- Recorded amounts can't be edited, only voided and re-entered. Notes, method
-- and reference can still be corrected; every change lands in the audit log.
create or replace function public.guard_money_row()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.voided_at is not null and new.voided_at is distinct from old.voided_at then
    raise exception 'A voided record can''t be restored. Record it again instead.';
  end if;
  if tg_table_name = 'contributions' then
    if (new.partner_id, new.member_id, new.period, new.amount, new.paid_on)
       is distinct from (old.partner_id, old.member_id, old.period, old.amount, old.paid_on) then
      raise exception 'Payments can''t be edited. Void it and record it again.';
    end if;
  else
    if (new.partner_id, new.member_id, new.period, new.gross, new.fee, new.kind, new.paid_on)
       is distinct from (old.partner_id, old.member_id, old.period, old.gross, old.fee, old.kind, old.paid_on) then
      raise exception 'Payouts can''t be edited. Void it and record it again.';
    end if;
  end if;
  if new.voided_at is not null and old.voided_at is null then
    new.voided_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists contributions_guard on public.contributions;
create trigger contributions_guard before update on public.contributions
  for each row execute function public.guard_money_row();
drop trigger if exists payouts_guard on public.payouts;
create trigger payouts_guard before update on public.payouts
  for each row execute function public.guard_money_row();

-- Money rows can no longer be deleted by the app (deleting a whole partner
-- still cascades). Replace the blanket policy with select/insert/update only.
do $$
declare
  t text;
begin
  foreach t in array array['contributions', 'payouts'] loop
    execute format('drop policy if exists "admins full access" on public.%I', t);
    execute format('drop policy if exists "admins read" on public.%I', t);
    execute format('drop policy if exists "admins insert" on public.%I', t);
    execute format('drop policy if exists "admins update" on public.%I', t);
    execute format('create policy "admins read" on public.%I for select to authenticated using (public.is_admin())', t);
    execute format('create policy "admins insert" on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format(
      'create policy "admins update" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end;
$$;

-- ─── Audit log: every insert, update and delete on the ledger tables.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(),
  partner_id uuid,
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('insert', 'update', 'delete', 'void')),
  old_row jsonb,
  new_row jsonb
);
create index if not exists audit_log_partner_idx on public.audit_log (partner_id, at desc);
alter table public.audit_log enable row level security;
drop policy if exists "admins read audit" on public.audit_log;
create policy "admins read audit" on public.audit_log for select to authenticated using (public.is_admin());
-- No insert/update/delete policies: only the trigger below (security definer) writes here.

create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  act text := lower(tg_op);
  pid uuid;
begin
  if tg_op = 'UPDATE' then
    -- Skip no-op updates (e.g. only updated_at moved).
    if (o - 'updated_at') = (n - 'updated_at') then
      return new;
    end if;
    if (o ->> 'voided_at') is null and (n ->> 'voided_at') is not null then
      act := 'void';
    end if;
  end if;
  pid := case when tg_table_name = 'partners' then coalesce(n, o) ->> 'id' else coalesce(n, o) ->> 'partner_id' end;
  insert into public.audit_log (actor, partner_id, table_name, row_id, action, old_row, new_row)
  values (auth.uid(), pid, tg_table_name, (coalesce(n, o) ->> 'id')::uuid, act, o, n);
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['partners', 'members', 'contributions', 'payouts'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.write_audit()',
      t || '_audit', t
    );
  end loop;
end;
$$;

-- ─── Replace a member mid-cycle, atomically. Runs with the caller's rights, so
-- RLS still limits it to admins.
create or replace function public.replace_member(
  p_member uuid,
  p_name text,
  p_phone text,
  p_mode text,
  p_left_on date,
  p_refund numeric default 0,
  p_refund_period integer default 1,
  p_method text default 'cash',
  p_ref text default null
)
returns uuid language plpgsql set search_path = '' as $$
declare
  old_m public.members%rowtype;
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_mode not in ('buyout', 'refund') then
    raise exception 'Unknown transfer mode %', p_mode;
  end if;
  select * into old_m from public.members where id = p_member for update;
  if not found then
    raise exception 'Member not found';
  end if;
  if old_m.replaced_by is not null then
    raise exception '% has already been replaced', old_m.name;
  end if;
  if p_mode = 'refund' and exists (
    select 1 from public.payouts
    where member_id = p_member and kind = 'draw' and voided_at is null
  ) then
    raise exception '% has already drawn, so they can''t be refunded. Use a buy-out instead.', old_m.name;
  end if;

  insert into public.members (partner_id, name, phone, hands, notes)
  values (
    old_m.partner_id,
    btrim(p_name),
    nullif(btrim(coalesce(p_phone, '')), ''),
    old_m.hands,
    format('Took over from %s on %s (%s).', old_m.name, to_char(p_left_on, 'Mon DD, YYYY'),
           case when p_mode = 'buyout' then 'bought the hand' else 'old member refunded' end)
  )
  returning id into new_id;

  update public.members
  set replaced_by = new_id, left_on = p_left_on, transfer_mode = p_mode
  where id = p_member;

  -- Hand the old member's draw slots to the new member, keeping their positions.
  update public.partners
  set draw_order = array(
    select replace(e, p_member::text, new_id::text)
    from unnest(draw_order) with ordinality as x(e, i)
    order by i
  )
  where id = old_m.partner_id;

  if p_mode = 'refund' and coalesce(p_refund, 0) > 0 then
    insert into public.payouts (partner_id, member_id, period, gross, fee, kind, method, ref, paid_on, note)
    values (old_m.partner_id, p_member, greatest(p_refund_period, 1), p_refund, 0, 'refund', p_method,
            nullif(btrim(coalesce(p_ref, '')), ''), p_left_on, 'Refund on leaving');
  end if;

  return new_id;
end;
$$;

revoke execute on function public.replace_member(uuid, text, text, text, date, numeric, integer, text, text) from public, anon;
grant execute on function public.replace_member(uuid, text, text, text, date, numeric, integer, text, text) to authenticated;

-- ─── Read-only member statement, for the link a banker shares with a member.
-- Works without signing in. Returns only that member's own money, plus what's
-- needed to work out their draw months. Names of other members and their draw
-- status are only included when the partner has share_schedule turned on.
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
