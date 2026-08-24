-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6 — المستخلصات
-- ترقيم آلي 1..ختامي لكل (مشروع + مقاول)، والكميات السابقة والأسعار
-- والحدود تُستدعى من العقد آليًا — المهندس لا يُدخل إلا كمية هذا المستخلص
-- [الحسابات 18]. الاعتماد يحسب الاستقطاعات ويولّد طلب الدفع.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.extracts (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  -- الترقيم داخل عقد المقاول: 1، 2، 3 … حتى الختامي
  seq integer not null check (seq > 0),
  project_id uuid not null references public.projects (id) on delete restrict,
  contractor_id uuid not null references public.contractors (id) on delete restrict,
  extract_date date not null default current_date,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'paid', 'cancelled')),
  is_final boolean not null default false,
  gross_amount numeric(16, 2) not null default 0,
  deductions_amount numeric(16, 2) not null default 0,
  retention_released numeric(16, 2) not null default 0,
  net_amount numeric(16, 2) not null default 0,
  notes text not null default '',
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (project_id, contractor_id, seq)
);

comment on table public.extracts is
  'مستخلص المقاول. الترقيم آلي والكميات السابقة مستدعاة — صفر إدخال مكرّر.';

create index if not exists extracts_contractor_idx
  on public.extracts (contractor_id, project_id, seq desc);
create index if not exists extracts_project_idx on public.extracts (project_id, status);

drop trigger if exists extracts_set_updated_at on public.extracts;
create trigger extracts_set_updated_at before update on public.extracts
  for each row execute function public.set_updated_at();

drop trigger if exists extracts_set_created_by on public.extracts;
create trigger extracts_set_created_by before insert on public.extracts
  for each row execute function public.set_created_by();

create table if not exists public.extract_lines (
  id uuid primary key default gen_random_uuid(),
  extract_id uuid not null references public.extracts (id) on delete cascade,
  boq_item_id uuid not null references public.boq_items (id) on delete restrict,
  -- لقطة من العقد وقت التوليد: لا يتغيّر سعر مستخلص معتمَد بتغيّر العقد
  unit_price numeric(16, 2) not null check (unit_price >= 0),
  max_qty numeric(16, 3) not null check (max_qty >= 0),
  prev_qty numeric(16, 3) not null default 0 check (prev_qty >= 0),
  current_qty numeric(16, 3) not null default 0 check (current_qty >= 0),
  notes text not null default '',
  unique (extract_id, boq_item_id)
);

comment on column public.extract_lines.prev_qty is
  'مجموع الكميات المعتمدة في المستخلصات السابقة — يُحسب آليًا وقت التوليد.';

create index if not exists extract_lines_extract_idx on public.extract_lines (extract_id);

/**
 * حارس الكمية: المطلوب في هذا المستخلص + السابق لا يتجاوز حد العقد،
 * ولا تُعدَّل أسطر مستخلص معتمَد.
 */
create or replace function public.guard_extract_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  select status into v_status from public.extracts where id = new.extract_id;

  if v_status is distinct from 'draft' and v_status is distinct from 'submitted' then
    raise exception 'لا تُعدَّل أسطر مستخلص غير مسودّة' using errcode = 'check_violation';
  end if;

  if new.max_qty > 0 and (new.prev_qty + new.current_qty) > new.max_qty then
    raise exception 'الكمية تتجاوز حد العقد: المتبقّي %',
      greatest(new.max_qty - new.prev_qty, 0)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists extract_lines_guard on public.extract_lines;
create trigger extract_lines_guard
  before insert or update on public.extract_lines
  for each row execute function public.guard_extract_line();

-- ── الاستقطاعات المحسوبة لكل مستخلص (لقطة من الإعداد وقت الاعتماد) ─────
create table if not exists public.extract_deductions (
  id uuid primary key default gen_random_uuid(),
  extract_id uuid not null references public.extracts (id) on delete cascade,
  deduction_type_id uuid references public.deduction_types (id) on delete set null,
  key text not null,
  name text not null,
  rate numeric(6, 3) not null,
  account_code text not null,
  amount numeric(16, 2) not null check (amount >= 0),
  unique (extract_id, key)
);

comment on table public.extract_deductions is
  'لقطة الاستقطاع وقت الاعتماد: تغيير النسبة لاحقًا لا يمسّ مستخلصًا معتمَدًا.';

-- ── استحقاق العمال من المستخلص ─────────────────────────────────────────
create table if not exists public.extract_workers (
  id uuid primary key default gen_random_uuid(),
  extract_id uuid not null references public.extracts (id) on delete cascade,
  worker_id uuid not null references public.profiles (id) on delete restrict,
  share numeric(16, 2) not null check (share >= 0),
  deduction numeric(16, 2) not null default 0 check (deduction >= 0),
  note text not null default '',
  unique (extract_id, worker_id)
);

comment on table public.extract_workers is
  'استحقاق العمال من قيمة المستخلص — يُحتسب آليًا عند الاعتماد.';

-- ═══════════════════════════════════════════════════════════════════════
-- الدوال
-- ═══════════════════════════════════════════════════════════════════════

/**
 * توليد مستخلص جديد: الرقم التالي في عقد المقاول، وأسطره من بنود العقد
 * بأسعارها وحدودها، والكميات السابقة مجموعة من المستخلصات المعتمدة.
 */
create or replace function public.generate_extract(
  p_project_id uuid,
  p_contractor_id uuid,
  p_extract_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_extract_id uuid;
  v_seq integer;
  v_last public.extracts%rowtype;
  v_count integer;
begin
  if not public.has_permission('extract.create') then
    raise exception 'يتطلّب صلاحية extract.create'
      using errcode = 'insufficient_privilege';
  end if;

  -- لا يُحرَّر مستخلص لمشروع غير معتمد للمستخدم [الحسابات 20، 34]
  if not (public.has_permission('project.read_all')
          or public.is_assigned_to_project(p_project_id)) then
    raise exception 'المشروع غير معتمد لك' using errcode = 'insufficient_privilege';
  end if;

  select * into v_last
    from public.extracts
   where project_id = p_project_id and contractor_id = p_contractor_id
   order by seq desc
   limit 1;

  if found then
    if v_last.is_final then
      raise exception 'صدر المستخلص الختامي لهذا العقد' using errcode = 'check_violation';
    end if;
    -- الكميات السابقة لا تصحّ إلا بعد اعتماد ما قبلها
    if v_last.status in ('draft', 'submitted') then
      raise exception 'المستخلص رقم % ما زال مفتوحًا — اعتمده أولًا', v_last.seq
        using errcode = 'check_violation';
    end if;
  end if;

  v_seq := coalesce(v_last.seq, 0) + 1;

  insert into public.extracts
    (seq, project_id, contractor_id, extract_date, status, created_by)
  values
    (v_seq, p_project_id, p_contractor_id, coalesce(p_extract_date, current_date),
     'draft', auth.uid())
  returning id into v_extract_id;

  -- الأسطر من العقد: السعر والحد لقطة، والسابق مجموع المعتمد
  insert into public.extract_lines
    (extract_id, boq_item_id, unit_price, max_qty, prev_qty, current_qty)
  select
    v_extract_id,
    c.boq_item_id,
    c.unit_price,
    c.max_qty,
    coalesce((
      select sum(l.current_qty)
      from public.extract_lines l
      join public.extracts e on e.id = l.extract_id
      where e.project_id = p_project_id
        and e.contractor_id = p_contractor_id
        and e.status in ('approved', 'paid')
        and l.boq_item_id = c.boq_item_id
    ), 0),
    0
  from public.contractor_boq_contracts c
  where c.project_id = p_project_id and c.contractor_id = p_contractor_id;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'لا توجد بنود تعاقد لهذا المقاول في هذا المشروع'
      using errcode = 'no_data_found';
  end if;

  return v_extract_id;
end;
$$;

/**
 * اعتماد المستخلص: يحسب الإجمالي والاستقطاعات النشطة وصافي المستحقّ،
 * ويردّ الضمان في الختامي، ثم يولّد طلب الدفع.
 * القيد المحاسبي يُطلق بعدها عبر Edge Function [القسم 8].
 */
create or replace function public.approve_extract(p_extract_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_extract public.extracts%rowtype;
  v_gross numeric(16, 2);
  v_deductions numeric(16, 2) := 0;
  v_retention_released numeric(16, 2) := 0;
  v_net numeric(16, 2);
begin
  if not public.has_permission('extract.approve') then
    raise exception 'يتطلّب صلاحية extract.approve'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_extract from public.extracts where id = p_extract_id;
  if not found then
    raise exception 'المستخلص غير موجود' using errcode = 'no_data_found';
  end if;
  if v_extract.status not in ('draft', 'submitted') then
    raise exception 'المستخلص معتمَد بالفعل' using errcode = 'check_violation';
  end if;

  -- «لا توقيع على مشروع غير معتمد» — قاعدة أمنية لا تُستثنى
  if not public.can_sign_project(v_extract.project_id) then
    raise exception 'لا يحقّ لك التوقيع على مستندات هذا المشروع'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(sum(current_qty * unit_price), 0) into v_gross
    from public.extract_lines where extract_id = p_extract_id;

  if v_gross <= 0 then
    raise exception 'قيمة المستخلص صفر — أدخل الكميات قبل الاعتماد'
      using errcode = 'check_violation';
  end if;

  -- استقطاعات من الإعداد الحالي، تُحفظ كلقطة
  delete from public.extract_deductions where extract_id = p_extract_id;

  insert into public.extract_deductions
    (extract_id, deduction_type_id, key, name, rate, account_code, amount)
  select
    p_extract_id, d.id, d.key, d.name, d.rate, d.account_code,
    round(v_gross * d.rate / 100, 2)
  from public.deduction_types d
  where d.is_active and d.applies_to = 'extract' and d.rate > 0;

  select coalesce(sum(amount), 0) into v_deductions
    from public.extract_deductions where extract_id = p_extract_id;

  -- الختامي يردّ ما احتُجز من ضمان في المستخلصات السابقة
  if v_extract.is_final then
    select coalesce(sum(d.amount), 0) into v_retention_released
      from public.extract_deductions d
      join public.extracts e on e.id = d.extract_id
     where e.project_id = v_extract.project_id
       and e.contractor_id = v_extract.contractor_id
       and e.id <> p_extract_id
       and d.key = 'retention';
  end if;

  v_net := v_gross - v_deductions + v_retention_released;

  if v_net <= 0 then
    raise exception 'صافي المستخلص صفر أو سالب — راجع الاستقطاعات'
      using errcode = 'check_violation';
  end if;

  update public.extracts
     set status = 'approved',
         gross_amount = v_gross,
         deductions_amount = v_deductions,
         retention_released = v_retention_released,
         net_amount = v_net,
         approved_at = now(),
         approved_by = auth.uid()
   where id = p_extract_id;

  -- طلب الدفع يمرّ بنفس آلة التحويلات البنكية في المشتريات
  insert into public.payment_requests
    (source_type, source_id, party_type, party_id, project_id, amount, status, created_by)
  values
    ('extract', p_extract_id, 'contractor', v_extract.contractor_id,
     v_extract.project_id, v_net, 'pending', auth.uid())
  on conflict (source_type, source_id, party_id) do nothing;

  return p_extract_id;
end;
$$;

revoke execute on function public.generate_extract(uuid, uuid, date) from public, anon;
revoke execute on function public.approve_extract(uuid) from public, anon;
grant execute on function public.generate_extract(uuid, uuid, date) to authenticated;
grant execute on function public.approve_extract(uuid) to authenticated;

-- ── مديونية المقاولين: ما استُحقّ ناقص ما حُوِّل ────────────────────────
create or replace view public.contractor_balances
with (security_invoker = true) as
select
  c.id as contractor_id,
  c.code as contractor_code,
  c.name as contractor_name,
  e.project_id,
  p.name as project_name,
  count(*) filter (where e.status in ('approved', 'paid'))     as extracts_count,
  coalesce(sum(e.gross_amount) filter (where e.status in ('approved', 'paid')), 0)
    as gross_total,
  coalesce(sum(e.deductions_amount) filter (where e.status in ('approved', 'paid')), 0)
    as deductions_total,
  coalesce(sum(e.net_amount) filter (where e.status in ('approved', 'paid')), 0)
    as net_total,
  coalesce((
    select sum(pr.amount)
    from public.payment_requests pr
    where pr.party_type = 'contractor'
      and pr.party_id = c.id
      and pr.status = 'transferred'
      and (pr.project_id is null or pr.project_id = e.project_id)
  ), 0) as paid_total
from public.extracts e
join public.contractors c on c.id = e.contractor_id
join public.projects p on p.id = e.project_id
group by c.id, c.code, c.name, e.project_id, p.name;

comment on view public.contractor_balances is
  'تقرير مديونية المقاولين: المستحقّ والمصروف والفرق، لكل مشروع.';
