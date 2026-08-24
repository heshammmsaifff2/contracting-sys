-- ═══════════════════════════════════════════════════════════════════════
-- Phase 5 — المعدّات: ملف المعدّة وصورتها، صيانتها، حركتها بين المشاريع،
-- والمعدّات الشاغرة المتاحة لبقية المشاريع.
-- الحركة هي مصدر الحقيقة لموقع المعدّة — الحقل current_project_id يتبعها آليًا.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default '',
  current_project_id uuid references public.projects (id) on delete set null,
  status text not null default 'idle'
    check (status in ('working', 'idle', 'maintenance', 'out_of_service')),
  -- مواصفات حرّة يحدّدها المستخدم: {"model": "...", "plate": "...", "year": 2020}
  spec jsonb not null default '{}'::jsonb,
  -- Cloudinary: {public_id, url}
  photo jsonb,
  acquired_at date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.equipment is
  'ملف المعدّة: بياناتها وصورتها ومشروعها الحالي. الصورة مرجع Cloudinary فقط.';

create index if not exists equipment_project_idx on public.equipment (current_project_id);
create index if not exists equipment_status_idx on public.equipment (status);

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at before update on public.equipment
  for each row execute function public.set_updated_at();

drop trigger if exists equipment_set_created_by on public.equipment;
create trigger equipment_set_created_by before insert on public.equipment
  for each row execute function public.set_created_by();

-- ── الصيانة ────────────────────────────────────────────────────────────
create table if not exists public.equipment_maintenance (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  kind text not null default 'repair' check (kind in ('periodic', 'repair')),
  part text not null default '',
  notes text not null default '',
  cost numeric(16, 2) not null default 0 check (cost >= 0),
  performed_at date not null default current_date,
  next_due_at date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.equipment_maintenance is
  'تاريخ الصيانة وقطع الغيار لكل معدّة — أساس تقرير تكلفة المعدّة.';

create index if not exists equipment_maintenance_equipment_idx
  on public.equipment_maintenance (equipment_id, performed_at desc);

drop trigger if exists equipment_maintenance_set_created_by on public.equipment_maintenance;
create trigger equipment_maintenance_set_created_by
  before insert on public.equipment_maintenance
  for each row execute function public.set_created_by();

-- ── الحركة بين المشاريع ────────────────────────────────────────────────
create table if not exists public.equipment_movements (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  from_date date not null default current_date,
  to_date date,
  supervisor_id uuid references public.profiles (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (to_date is null or to_date >= from_date)
);

comment on table public.equipment_movements is
  'أين كانت المعدّة ومتى ومع من — الحركة المفتوحة هي موقعها الحالي.';

create index if not exists equipment_movements_equipment_idx
  on public.equipment_movements (equipment_id, from_date desc);
create index if not exists equipment_movements_project_idx
  on public.equipment_movements (project_id);

-- معدّة واحدة لا تكون في مشروعين في آن واحد
create unique index if not exists equipment_movements_one_open_idx
  on public.equipment_movements (equipment_id) where to_date is null;

drop trigger if exists equipment_movements_set_created_by on public.equipment_movements;
create trigger equipment_movements_set_created_by
  before insert on public.equipment_movements
  for each row execute function public.set_created_by();

-- ── المعدّات الشاغرة ───────────────────────────────────────────────────
create table if not exists public.idle_equipment (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  available_from date not null default current_date,
  available_to date,
  note text not null default '',
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (available_to is null or available_to >= available_from)
);

comment on table public.idle_equipment is
  'المعدّة الشاغرة معروضة لبقية المشاريع بدل استئجار جديد.';

create index if not exists idle_equipment_open_idx
  on public.idle_equipment (is_closed, available_from desc);

drop trigger if exists idle_equipment_set_created_by on public.idle_equipment;
create trigger idle_equipment_set_created_by before insert on public.idle_equipment
  for each row execute function public.set_created_by();

/**
 * نقل معدّة إلى مشروع: تُغلق الحركة المفتوحة، وتُفتح أخرى،
 * ويتبعها موقع المعدّة وحالتها آليًا — بلا إدخال مكرّر.
 */
create or replace function public.move_equipment(
  p_equipment_id uuid,
  p_project_id uuid,
  p_from_date date default current_date,
  p_supervisor_id uuid default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_movement_id uuid;
  v_from date := coalesce(p_from_date, current_date);
begin
  if not public.has_permission('equipment.move') then
    raise exception 'يتطلّب صلاحية equipment.move'
      using errcode = 'insufficient_privilege';
  end if;

  if not (public.has_permission('project.read_all')
          or public.is_assigned_to_project(p_project_id)) then
    raise exception 'المشروع غير معتمد لك' using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.equipment where id = p_equipment_id and is_active) then
    raise exception 'المعدّة غير موجودة أو غير نشطة' using errcode = 'check_violation';
  end if;

  update public.equipment_movements
     set to_date = greatest(from_date, v_from)
   where equipment_id = p_equipment_id and to_date is null;

  insert into public.equipment_movements
    (equipment_id, project_id, from_date, supervisor_id, note, created_by)
  values
    (p_equipment_id, p_project_id, v_from, p_supervisor_id,
     coalesce(p_note, ''), auth.uid())
  returning id into v_movement_id;

  update public.equipment
     set current_project_id = p_project_id,
         status = case when status = 'maintenance' then status else 'working' end
   where id = p_equipment_id;

  -- المعدّة لم تعد شاغرة
  update public.idle_equipment
     set is_closed = true,
         available_to = coalesce(available_to, v_from)
   where equipment_id = p_equipment_id and not is_closed;

  return v_movement_id;
end;
$$;

/**
 * إخلاء معدّة من مشروعها وإعلانها شاغرة للجميع.
 */
create or replace function public.release_equipment(
  p_equipment_id uuid,
  p_to_date date default current_date,
  p_available_to date default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idle_id uuid;
  v_to date := coalesce(p_to_date, current_date);
begin
  if not public.has_permission('equipment.move') then
    raise exception 'يتطلّب صلاحية equipment.move'
      using errcode = 'insufficient_privilege';
  end if;

  update public.equipment_movements
     set to_date = greatest(from_date, v_to)
   where equipment_id = p_equipment_id and to_date is null;

  update public.equipment
     set current_project_id = null,
         status = case when status = 'maintenance' then status else 'idle' end
   where id = p_equipment_id;

  insert into public.idle_equipment
    (equipment_id, available_from, available_to, note, created_by)
  values
    (p_equipment_id, v_to, p_available_to, coalesce(p_note, ''), auth.uid())
  returning id into v_idle_id;

  -- من يبحث عن معدّة يعرف فورًا بما شغر
  perform public.notify_users(
    array(select public.users_to_notify('equipment.read', null)),
    'equipment_idle',
    'معدّة شاغرة متاحة',
    (select format('%s — %s', e.code, e.name)
       from public.equipment e where e.id = p_equipment_id),
    'equipment', p_equipment_id, null
  );

  return v_idle_id;
end;
$$;

revoke execute on function public.move_equipment(uuid, uuid, date, uuid, text)
  from public, anon;
revoke execute on function public.release_equipment(uuid, date, date, text)
  from public, anon;
grant execute on function public.move_equipment(uuid, uuid, date, uuid, text)
  to authenticated;
grant execute on function public.release_equipment(uuid, date, date, text)
  to authenticated;
