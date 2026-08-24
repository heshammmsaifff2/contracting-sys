-- ═══════════════════════════════════════════════════════════════════════
-- Phase 7 — شؤون الموظفين: ملف العامل وأجره وحالته
-- العامل ملف (profile) كسائر الموظفين — لأن الخدمة الذاتية تتطلّب حسابًا
-- [شؤون الموظفين 7]، ولأن «الإدخال مرة واحدة» يمنع دفترين للأشخاص.
-- الأجر اليومي يلحق بـ profile_salaries لا بـ employees: الأجر حقل حسّاس
-- تخفيه RLS بجدوله المنفصل.
-- ═══════════════════════════════════════════════════════════════════════

-- فئة رابعة للموظف: العامل
alter table public.profiles drop constraint if exists profiles_employee_type_check;
alter table public.profiles add constraint profiles_employee_type_check
  check (employee_type in ('admin', 'engineer', 'supervisor', 'worker'));

alter table public.profile_salaries
  add column if not exists daily_wage numeric(14, 2) not null default 0
  check (daily_wage >= 0);

comment on column public.profile_salaries.daily_wage is
  'أجر اليومية للعمالة اليومية — يُضرب في اليوميات المستحقّة لحساب تكلفة المشروع.';

-- ── ملف العامل ─────────────────────────────────────────────────────────
create table if not exists public.employees (
  id uuid primary key references public.profiles (id) on delete cascade,
  card_no text unique,
  -- المهن: عامل قد يكون «نجّار» و«حدّاد» معًا
  professions text[] not null default '{}',
  salary_type text not null default 'daily'
    check (salary_type in ('monthly', 'daily', 'production')),
  hired_at date,
  national_id text,
  phone text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.employees is
  'امتداد ملف الموظف ببيانات العمالة: رقم البطاقة والمهن ونوع الأجر.';

create index if not exists employees_card_idx on public.employees (card_no);
create index if not exists employees_professions_idx
  on public.employees using gin (professions);

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists employees_set_created_by on public.employees;
create trigger employees_set_created_by before insert on public.employees
  for each row execute function public.set_created_by();

/**
 * البحث عن عامل بالاسم ولو كُتب بشكل شاذ، أو بالكود أو رقم البطاقة
 * [شؤون الموظفين 2] — بالتطبيع العربي نفسه المستخدم في الأصناف.
 */
create or replace function public.search_workers(p_query text, p_limit int default 50)
returns table (
  id uuid,
  full_name text,
  code text,
  card_no text,
  professions text[],
  salary_type text,
  employee_type text,
  is_active boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id, p.full_name, p.code, e.card_no, e.professions, e.salary_type,
    p.employee_type, p.is_active
  from public.profiles p
  join public.employees e on e.id = p.id
  where public.has_permission('worker.read')
    and (
      coalesce(btrim(p_query), '') = ''
      or public.normalize_ar(p.full_name) like '%' || public.normalize_ar(p_query) || '%'
      or public.normalize_doc_no(p.code) = public.normalize_doc_no(p_query)
      or public.normalize_doc_no(e.card_no) = public.normalize_doc_no(p_query)
    )
  order by p.full_name
  limit least(coalesce(p_limit, 50), 200);
$$;

revoke execute on function public.search_workers(text, int) from public, anon;
grant execute on function public.search_workers(text, int) to authenticated;

-- ── حالة العمالة: شاغرة / منتدبة / بها مشكلة [4، 5، 6] ────────────────
create table if not exists public.labor_pool (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.employees (id) on delete cascade,
  status text not null default 'available'
    check (status in ('available', 'seconded', 'problem')),
  project_id uuid references public.projects (id) on delete set null,
  available_from date not null default current_date,
  available_to date,
  note text not null default '',
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check (available_to is null or available_to >= available_from)
);

comment on table public.labor_pool is
  'حالة العامل الحالية: شاغر متاح، منتدب لمشروع، أو عليه ملاحظة تمنع ندبه.';

-- حالة مفتوحة واحدة لكل عامل — وإلا تناقضت الصفحات الثلاث
create unique index if not exists labor_pool_open_idx
  on public.labor_pool (worker_id) where not is_closed;

create index if not exists labor_pool_status_idx
  on public.labor_pool (status, is_closed);

drop trigger if exists labor_pool_set_updated_at on public.labor_pool;
create trigger labor_pool_set_updated_at before update on public.labor_pool
  for each row execute function public.set_updated_at();

drop trigger if exists labor_pool_set_created_by on public.labor_pool;
create trigger labor_pool_set_created_by before insert on public.labor_pool
  for each row execute function public.set_created_by();

/**
 * تغيير حالة العامل: تُغلق الحالة السابقة وتُفتح الجديدة،
 * فيبقى للحالة تاريخ ولا تتضارب صفحتان.
 */
create or replace function public.set_worker_status(
  p_worker_id uuid,
  p_status text,
  p_project_id uuid default null,
  p_available_from date default current_date,
  p_available_to date default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('worker.manage') then
    raise exception 'يتطلّب صلاحية worker.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if p_status not in ('available', 'seconded', 'problem') then
    raise exception 'حالة غير معروفة: %', p_status using errcode = 'check_violation';
  end if;

  update public.labor_pool
     set is_closed = true,
         available_to = coalesce(available_to, coalesce(p_available_from, current_date))
   where worker_id = p_worker_id and not is_closed;

  insert into public.labor_pool
    (worker_id, status, project_id, available_from, available_to, note, created_by)
  values
    (p_worker_id, p_status, p_project_id, coalesce(p_available_from, current_date),
     p_available_to, coalesce(p_note, ''), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function
  public.set_worker_status(uuid, text, uuid, date, date, text) from public, anon;
grant execute on function
  public.set_worker_status(uuid, text, uuid, date, date, text) to authenticated;
