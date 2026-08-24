-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6 — الدفعات المقدّمة وخطابات الضمان
-- الدفعة المقدّمة أصل على المقاول (1303) يُسترد من مستخلصاته لاحقًا،
-- والضمانات تُتابع بتاريخ انتهائها فلا تسقط سهوًا.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.advance_payments (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  contractor_id uuid not null references public.contractors (id) on delete restrict,
  project_id uuid not null references public.projects (id) on delete restrict,
  boq_item_id uuid references public.boq_items (id) on delete set null,
  amount numeric(16, 2) not null check (amount > 0),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'paid', 'cancelled')),
  notes text not null default '',
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.advance_payments is
  'دفعة مقدّمة لمقاول — تُرحَّل كأصل ويُسترد من المستخلصات باستقطاع advance_recovery.';

create index if not exists advance_payments_contractor_idx
  on public.advance_payments (contractor_id, project_id, status);

drop trigger if exists advance_payments_set_updated_at on public.advance_payments;
create trigger advance_payments_set_updated_at before update on public.advance_payments
  for each row execute function public.set_updated_at();

drop trigger if exists advance_payments_set_created_by on public.advance_payments;
create trigger advance_payments_set_created_by
  before insert on public.advance_payments
  for each row execute function public.set_created_by();

create table if not exists public.guarantees (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  contractor_id uuid references public.contractors (id) on delete set null,
  kind text not null default 'final'
    check (kind in ('initial', 'final', 'maintenance', 'advance')),
  reference_no text not null default '',
  bank_name text not null default '',
  amount numeric(16, 2) not null check (amount > 0),
  issued_at date not null default current_date,
  expires_at date not null,
  status text not null default 'active'
    check (status in ('active', 'released', 'expired')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (expires_at >= issued_at)
);

comment on table public.guarantees is
  'خطابات الضمان — يتابعها تقرير انتهاء الصلاحية وإشعار مسبق.';

create index if not exists guarantees_expiry_idx
  on public.guarantees (status, expires_at);

drop trigger if exists guarantees_set_updated_at on public.guarantees;
create trigger guarantees_set_updated_at before update on public.guarantees
  for each row execute function public.set_updated_at();

drop trigger if exists guarantees_set_created_by on public.guarantees;
create trigger guarantees_set_created_by before insert on public.guarantees
  for each row execute function public.set_created_by();

-- كم يومًا قبل الانتهاء يبدأ التنبيه؟ رقم قابل للتعديل.
insert into public.settings (key, value, description, category) values
  ('guarantee_alert_days', '30'::jsonb,
   'عدد الأيام قبل انتهاء خطاب الضمان التي يبدأ عندها التنبيه', 'accounting')
on conflict (key) do update set description = excluded.description;

/**
 * اعتماد دفعة مقدّمة: يُثبّت الالتزام ويولّد طلب الدفع،
 * والقيد يُطلق بعدها عبر Edge Function [القسم 8].
 */
create or replace function public.approve_advance_payment(p_advance_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_advance public.advance_payments%rowtype;
begin
  if not public.has_permission('advance.approve') then
    raise exception 'يتطلّب صلاحية advance.approve'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_advance from public.advance_payments where id = p_advance_id;
  if not found then
    raise exception 'الدفعة غير موجودة' using errcode = 'no_data_found';
  end if;
  if v_advance.status <> 'draft' then
    raise exception 'الدفعة معتمَدة بالفعل' using errcode = 'check_violation';
  end if;

  if not public.can_sign_project(v_advance.project_id) then
    raise exception 'لا يحقّ لك التوقيع على مستندات هذا المشروع'
      using errcode = 'insufficient_privilege';
  end if;

  update public.advance_payments
     set status = 'approved', approved_at = now(), approved_by = auth.uid()
   where id = p_advance_id;

  insert into public.payment_requests
    (source_type, source_id, party_type, party_id, project_id, amount, status, created_by)
  values
    ('advance_payment', p_advance_id, 'contractor', v_advance.contractor_id,
     v_advance.project_id, v_advance.amount, 'pending', auth.uid())
  on conflict (source_type, source_id, party_id) do nothing;

  return p_advance_id;
end;
$$;

revoke execute on function public.approve_advance_payment(uuid) from public, anon;
grant execute on function public.approve_advance_payment(uuid) to authenticated;

-- ── تقرير الضمانات المقتربة من الانتهاء ────────────────────────────────
create or replace view public.expiring_guarantees
with (security_invoker = true) as
select
  g.id,
  g.project_id,
  p.name as project_name,
  g.contractor_id,
  c.name as contractor_name,
  g.kind,
  g.reference_no,
  g.bank_name,
  g.amount,
  g.issued_at,
  g.expires_at,
  g.status,
  (g.expires_at - current_date) as days_left,
  (g.expires_at < current_date) as is_expired,
  g.note
from public.guarantees g
join public.projects p on p.id = g.project_id
left join public.contractors c on c.id = g.contractor_id
where g.status = 'active'
order by g.expires_at;

comment on view public.expiring_guarantees is
  'الضمانات السارية مرتّبة بالأقرب انتهاءً، مع الأيام المتبقّية.';

/**
 * تنبيه مسبق بانتهاء الضمانات — تُستدعى من الوظيفة المجدولة.
 * تُعلّم المنتهية expired وتُشعر أصحاب صلاحية المتابعة.
 */
create or replace function public.notify_expiring_guarantees()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_days integer;
  v_row record;
  v_count integer := 0;
begin
  v_days := coalesce(
    (select (value #>> '{}')::integer from public.settings where key = 'guarantee_alert_days'),
    30);

  update public.guarantees
     set status = 'expired'
   where status = 'active' and expires_at < current_date;

  for v_row in
    select g.id, g.project_id, g.reference_no, g.expires_at, g.amount, p.name as project_name
    from public.guarantees g
    join public.projects p on p.id = g.project_id
    where g.status = 'active'
      and g.expires_at <= current_date + v_days
      and not exists (
        select 1 from public.notifications n
        where n.entity_type = 'guarantee' and n.entity_id = g.id
          and n.created_at > now() - interval '7 days'
      )
  loop
    perform public.notify_users(
      array(select public.users_to_notify('guarantee.manage', v_row.project_id)),
      'guarantee_expiring',
      'خطاب ضمان يقترب من الانتهاء',
      format('ضمان %s بقيمة %s — مشروع %s — ينتهي في %s',
             v_row.reference_no, v_row.amount, v_row.project_name, v_row.expires_at),
      'guarantee', v_row.id, v_row.project_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.notify_expiring_guarantees()
  from public, anon, authenticated;
grant execute on function public.notify_expiring_guarantees() to service_role;
