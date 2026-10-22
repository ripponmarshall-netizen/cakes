-- Partner Ledger v4: months with no draw. Everyone still pays in those
-- months; nobody draws, and the draws are spread over the other months.
-- Run after 20261006000000_ledger_v3.sql. Safe to re-run.

alter table public.partners add column if not exists no_draw_months integer[] not null default '{}';
alter table public.partners drop constraint if exists partners_no_draw_months_range;
alter table public.partners add constraint partners_no_draw_months_range
  check (1 <= all (no_draw_months) and term_months >= all (no_draw_months) and cardinality(no_draw_months) < term_months);

-- ─── The next round keeps the same no-draw months.
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

  insert into public.partners (name, hand_amount, start_date, term_months, fee_type, fee_value, notes, share_schedule, pay_details,
                               no_draw_months)
  values (btrim(p_name), old_p.hand_amount, p_start, old_p.term_months, old_p.fee_type, old_p.fee_value,
          old_p.notes, old_p.share_schedule, old_p.pay_details, old_p.no_draw_months)
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

-- ─── Member statement link: needs the no-draw months to work out draw months.
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
      'pay_details', p.pay_details, 'no_draw_months', to_jsonb(p.no_draw_months),
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
