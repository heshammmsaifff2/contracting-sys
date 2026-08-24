-- ═══════════════════════════════════════════════════════════════════════
-- Phase 5 — المخازن: هرم المنشآت، المندوب كمخزن فرعي، استهلاك المنشآت
-- سلسلة المادة: استلام المشتريات ⇒ site_stock ⇒ عهدة المندوب ⇒ منشأة.
-- كل حركة تُقيَّد في stock_movements فلا يتغيّر رصيد بلا أثر.
-- ═══════════════════════════════════════════════════════════════════════

-- ── هرم المنشآت: تجمّع ← حي ← منشأة ────────────────────────────────────
create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  code text not null,
  group_name text not null default '',
  district text not null default '',
  name text not null,
  -- الوزن النسبي للمنشأة (مساحة/عدد وحدات/أي مقياس حجم يحدّده المستخدم).
  -- عليه يقوم تقرير الهدر: الاستهلاك لكل وحدة وزن يُقارَن بمتوسط المشروع [المخازن 9].
  weight numeric(12, 3) not null default 1 check (weight > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (project_id, code)
);

comment on table public.facilities is
  'المنشأة داخل هرم: تجمّع ← حي ← منشأة. الوزن النسبي أساس كشف الهدر [المخازن 9].';

create index if not exists facilities_project_idx on public.facilities (project_id);
create index if not exists facilities_group_idx
  on public.facilities (project_id, group_name, district);

drop trigger if exists facilities_set_updated_at on public.facilities;
create trigger facilities_set_updated_at before update on public.facilities
  for each row execute function public.set_updated_at();

drop trigger if exists facilities_set_created_by on public.facilities;
create trigger facilities_set_created_by before insert on public.facilities
  for each row execute function public.set_created_by();

-- ── المندوب كمخزن فرعي ─────────────────────────────────────────────────
create table if not exists public.mandoub_stock (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  item_id uuid not null references public.items (id) on delete restrict,
  quantity numeric(16, 3) not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id, item_id)
);

comment on table public.mandoub_stock is
  'عهدة المندوب — مخزن فرعي. تزيد بالتسليم من الموقع وتنقص بتنزيل الكميات.';

create index if not exists mandoub_stock_user_idx on public.mandoub_stock (user_id);

drop trigger if exists mandoub_stock_set_updated_at on public.mandoub_stock;
create trigger mandoub_stock_set_updated_at before update on public.mandoub_stock
  for each row execute function public.set_updated_at();

-- ── سجل الحركة: لا رصيد يتغيّر بلا أثر ─────────────────────────────────
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  qty numeric(16, 3) not null check (qty > 0),
  direction text not null check (
    direction in ('site_to_mandoub', 'mandoub_to_site', 'mandoub_to_facility')
  ),
  mandoub_id uuid references public.profiles (id) on delete set null,
  facility_id uuid references public.facilities (id) on delete set null,
  batch_id uuid not null default gen_random_uuid(),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.stock_movements is
  'أثر كل حركة مخزنية بين الموقع والمندوب والمنشأة — سجل لا يُعدَّل.';

create index if not exists stock_movements_project_idx
  on public.stock_movements (project_id, created_at desc);
create index if not exists stock_movements_mandoub_idx
  on public.stock_movements (mandoub_id, created_at desc);
create index if not exists stock_movements_batch_idx on public.stock_movements (batch_id);

-- ── استهلاك المنشآت ────────────────────────────────────────────────────
create table if not exists public.facility_consumption (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  -- مكرّر عن المنشأة عمدًا: سياسات RLS وتقارير المقارنة تقيس بالمشروع مباشرة.
  project_id uuid not null references public.projects (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  qty numeric(16, 3) not null check (qty > 0),
  mandoub_id uuid references public.profiles (id) on delete set null,
  supervisor_id uuid references public.profiles (id) on delete set null,
  batch_id uuid not null default gen_random_uuid(),
  consumed_at timestamptz not null default now(),
  note text not null default '',
  -- Cloudinary: [{public_id, url}] — لا ملفّات في قاعدة البيانات
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.facility_consumption is
  'ما نزل فعليًا على المنشأة بصوره. ينقص عهدة المندوب آليًا ويُطلق إشعارًا [المخازن 18].';

create index if not exists facility_consumption_facility_idx
  on public.facility_consumption (facility_id, consumed_at desc);
create index if not exists facility_consumption_project_idx
  on public.facility_consumption (project_id, consumed_at desc);
create index if not exists facility_consumption_supervisor_idx
  on public.facility_consumption (supervisor_id, consumed_at desc);

drop trigger if exists facility_consumption_set_created_by on public.facility_consumption;
create trigger facility_consumption_set_created_by
  before insert on public.facility_consumption
  for each row execute function public.set_created_by();

-- ── المواد الزائدة عن الحاجة ───────────────────────────────────────────
create table if not exists public.surplus_materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  qty numeric(16, 3) not null check (qty > 0),
  status text not null default 'available'
    check (status in ('available', 'reserved', 'transferred')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (project_id, item_id)
);

comment on table public.surplus_materials is
  'مواد زائدة عن حاجة المشروع — تُعرض لبقية المشاريع بدل الشراء.';

drop trigger if exists surplus_materials_set_updated_at on public.surplus_materials;
create trigger surplus_materials_set_updated_at before update on public.surplus_materials
  for each row execute function public.set_updated_at();

drop trigger if exists surplus_materials_set_created_by on public.surplus_materials;
create trigger surplus_materials_set_created_by
  before insert on public.surplus_materials
  for each row execute function public.set_created_by();

-- ═══════════════════════════════════════════════════════════════════════
-- الدوال: كل تغيير رصيد يقع في معاملة واحدة على الخادم
-- ═══════════════════════════════════════════════════════════════════════

/**
 * تسليم أصناف من مخزون الموقع إلى عهدة مندوب.
 * p_lines: [{"item_id": uuid, "qty": numeric}]
 */
create or replace function public.issue_stock_to_mandoub(
  p_project_id uuid,
  p_mandoub_id uuid,
  p_lines jsonb,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_line record;
  v_available numeric;
  v_item_name text;
  v_mandoub_name text;
  v_project_name text;
  v_count int := 0;
begin
  if not public.has_permission('mandoub_stock.issue') then
    raise exception 'يتطلّب صلاحية mandoub_stock.issue'
      using errcode = 'insufficient_privilege';
  end if;

  if not (public.has_permission('project.read_all')
          or public.is_assigned_to_project(p_project_id)) then
    raise exception 'المشروع غير معتمد لك' using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.profiles where id = p_mandoub_id and is_active) then
    raise exception 'المندوب غير موجود أو غير نشط' using errcode = 'check_violation';
  end if;

  for v_line in
    select (l ->> 'item_id')::uuid as item_id, (l ->> 'qty')::numeric as qty
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as l
  loop
    if v_line.qty is null or v_line.qty <= 0 then
      raise exception 'الكمية يجب أن تكون أكبر من صفر' using errcode = 'check_violation';
    end if;

    select quantity into v_available
      from public.site_stock
     where project_id = p_project_id and item_id = v_line.item_id
     for update;

    select name into v_item_name from public.items where id = v_line.item_id;

    if v_available is null or v_available < v_line.qty then
      raise exception 'الرصيد بالموقع لا يكفي للصنف %: المتاح %',
        coalesce(v_item_name, '?'), coalesce(v_available, 0)
        using errcode = 'check_violation';
    end if;

    update public.site_stock
       set quantity = quantity - v_line.qty, recorded_by = auth.uid()
     where project_id = p_project_id and item_id = v_line.item_id;

    insert into public.mandoub_stock (project_id, user_id, item_id, quantity)
    values (p_project_id, p_mandoub_id, v_line.item_id, v_line.qty)
    on conflict (project_id, user_id, item_id) do update
      set quantity = public.mandoub_stock.quantity + excluded.quantity;

    insert into public.stock_movements
      (project_id, item_id, qty, direction, mandoub_id, batch_id, note, created_by)
    values
      (p_project_id, v_line.item_id, v_line.qty, 'site_to_mandoub',
       p_mandoub_id, v_batch_id, coalesce(p_note, ''), auth.uid());

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'لا أصناف في السند' using errcode = 'check_violation';
  end if;

  select full_name into v_mandoub_name from public.profiles where id = p_mandoub_id;
  select name into v_project_name from public.projects where id = p_project_id;

  -- المندوب يعرف ما دخل عهدته فور تسليمه
  perform public.notify_users(
    array[p_mandoub_id],
    'stock_issued',
    'استلمت عهدة أصناف جديدة',
    format('%s صنفًا في مشروع %s', v_count, coalesce(v_project_name, '')),
    'stock_batch', v_batch_id, p_project_id
  );

  perform public.notify_users(
    array(select public.users_to_notify('warehouse.notify', p_project_id)),
    'stock_issued',
    'تسليم عهدة لمندوب',
    format('%s: %s صنفًا في مشروع %s',
           coalesce(v_mandoub_name, ''), v_count, coalesce(v_project_name, '')),
    'stock_batch', v_batch_id, p_project_id
  );

  return v_batch_id;
end;
$$;

/**
 * ردّ أصناف من عهدة المندوب إلى مخزون الموقع.
 */
create or replace function public.return_mandoub_stock(
  p_project_id uuid,
  p_mandoub_id uuid,
  p_lines jsonb,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_line record;
  v_held numeric;
  v_item_name text;
  v_count int := 0;
begin
  if not public.has_permission('mandoub_stock.issue') then
    raise exception 'يتطلّب صلاحية mandoub_stock.issue'
      using errcode = 'insufficient_privilege';
  end if;

  if not (public.has_permission('project.read_all')
          or public.is_assigned_to_project(p_project_id)) then
    raise exception 'المشروع غير معتمد لك' using errcode = 'insufficient_privilege';
  end if;

  for v_line in
    select (l ->> 'item_id')::uuid as item_id, (l ->> 'qty')::numeric as qty
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as l
  loop
    if v_line.qty is null or v_line.qty <= 0 then
      raise exception 'الكمية يجب أن تكون أكبر من صفر' using errcode = 'check_violation';
    end if;

    select quantity into v_held
      from public.mandoub_stock
     where project_id = p_project_id
       and user_id = p_mandoub_id
       and item_id = v_line.item_id
     for update;

    select name into v_item_name from public.items where id = v_line.item_id;

    if v_held is null or v_held < v_line.qty then
      raise exception 'عهدة المندوب لا تكفي للصنف %: المتاح %',
        coalesce(v_item_name, '?'), coalesce(v_held, 0)
        using errcode = 'check_violation';
    end if;

    update public.mandoub_stock
       set quantity = quantity - v_line.qty
     where project_id = p_project_id
       and user_id = p_mandoub_id
       and item_id = v_line.item_id;

    insert into public.site_stock (project_id, item_id, quantity, recorded_by)
    values (p_project_id, v_line.item_id, v_line.qty, auth.uid())
    on conflict (project_id, item_id) do update
      set quantity = public.site_stock.quantity + excluded.quantity,
          recorded_by = excluded.recorded_by;

    insert into public.stock_movements
      (project_id, item_id, qty, direction, mandoub_id, batch_id, note, created_by)
    values
      (p_project_id, v_line.item_id, v_line.qty, 'mandoub_to_site',
       p_mandoub_id, v_batch_id, coalesce(p_note, ''), auth.uid());

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'لا أصناف في السند' using errcode = 'check_violation';
  end if;

  return v_batch_id;
end;
$$;

/**
 * تنزيل كميات على منشأة: ينقص عهدة المندوب، يسجّل الاستهلاك بصوره،
 * ويُطلق إشعارًا فوريًا لأصحاب الصلاحية [المخازن 18، 19].
 * p_lines:  [{"item_id": uuid, "qty": numeric}]
 * p_photos: [{"public_id": text, "url": text}]
 */
create or replace function public.record_facility_consumption(
  p_facility_id uuid,
  p_mandoub_id uuid,
  p_lines jsonb,
  p_photos jsonb default '[]'::jsonb,
  p_note text default '',
  p_consumed_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch_id uuid := gen_random_uuid();
  v_project_id uuid;
  v_facility_name text;
  v_project_name text;
  v_mandoub_name text;
  v_line record;
  v_held numeric;
  v_item_name text;
  v_count int := 0;
begin
  if not public.has_permission('consumption.record') then
    raise exception 'يتطلّب صلاحية consumption.record'
      using errcode = 'insufficient_privilege';
  end if;

  select project_id, name into v_project_id, v_facility_name
    from public.facilities where id = p_facility_id and is_active;

  if not found then
    raise exception 'المنشأة غير موجودة أو غير نشطة' using errcode = 'check_violation';
  end if;

  if not (public.has_permission('project.read_all')
          or public.is_assigned_to_project(v_project_id)) then
    raise exception 'المشروع غير معتمد لك' using errcode = 'insufficient_privilege';
  end if;

  for v_line in
    select (l ->> 'item_id')::uuid as item_id, (l ->> 'qty')::numeric as qty
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as l
  loop
    if v_line.qty is null or v_line.qty <= 0 then
      raise exception 'الكمية يجب أن تكون أكبر من صفر' using errcode = 'check_violation';
    end if;

    select quantity into v_held
      from public.mandoub_stock
     where project_id = v_project_id
       and user_id = p_mandoub_id
       and item_id = v_line.item_id
     for update;

    select name into v_item_name from public.items where id = v_line.item_id;

    if v_held is null or v_held < v_line.qty then
      raise exception 'عهدة المندوب لا تكفي للصنف %: المتاح %',
        coalesce(v_item_name, '?'), coalesce(v_held, 0)
        using errcode = 'check_violation';
    end if;

    update public.mandoub_stock
       set quantity = quantity - v_line.qty
     where project_id = v_project_id
       and user_id = p_mandoub_id
       and item_id = v_line.item_id;

    insert into public.facility_consumption
      (facility_id, project_id, item_id, qty, mandoub_id, supervisor_id,
       batch_id, consumed_at, note, photos)
    values
      (p_facility_id, v_project_id, v_line.item_id, v_line.qty, p_mandoub_id,
       auth.uid(), v_batch_id, coalesce(p_consumed_at, now()),
       coalesce(p_note, ''), coalesce(p_photos, '[]'::jsonb));

    insert into public.stock_movements
      (project_id, item_id, qty, direction, mandoub_id, facility_id,
       batch_id, note, created_by)
    values
      (v_project_id, v_line.item_id, v_line.qty, 'mandoub_to_facility',
       p_mandoub_id, p_facility_id, v_batch_id, coalesce(p_note, ''), auth.uid());

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'لا أصناف في التنزيل' using errcode = 'check_violation';
  end if;

  select full_name into v_mandoub_name from public.profiles where id = p_mandoub_id;
  select name into v_project_name from public.projects where id = v_project_id;

  perform public.notify_users(
    array(select public.users_to_notify('warehouse.notify', v_project_id))
      || array[p_mandoub_id],
    'consumption_recorded',
    format('تنزيل كميات على %s', coalesce(v_facility_name, '')),
    format('%s صنفًا — مندوب: %s — مشروع: %s',
           v_count, coalesce(v_mandoub_name, ''), coalesce(v_project_name, '')),
    'consumption_batch', v_batch_id, v_project_id
  );

  return v_batch_id;
end;
$$;

revoke execute on function public.issue_stock_to_mandoub(uuid, uuid, jsonb, text)
  from public, anon;
revoke execute on function public.return_mandoub_stock(uuid, uuid, jsonb, text)
  from public, anon;
revoke execute on function
  public.record_facility_consumption(uuid, uuid, jsonb, jsonb, text, timestamptz)
  from public, anon;

grant execute on function public.issue_stock_to_mandoub(uuid, uuid, jsonb, text)
  to authenticated;
grant execute on function public.return_mandoub_stock(uuid, uuid, jsonb, text)
  to authenticated;
grant execute on function
  public.record_facility_consumption(uuid, uuid, jsonb, jsonb, text, timestamptz)
  to authenticated;
