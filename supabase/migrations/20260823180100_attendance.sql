-- ═══════════════════════════════════════════════════════════════════════
-- Phase 7 — اليوميات (الحضور والغياب)
-- ثلاث قواعد تسكن قاعدة البيانات لا الواجهة:
-- (١) عامل واحد ليوم واحد في مشروع واحد [16] — قيد فريد لا مجرّد تحقّق.
-- (٢) لا تسجيل بعد ساعة يحدّدها الإعداد إلا بصلاحية [17].
-- (٣) قيمة اليوم بحسب حالته (حاضر/مريض/غياب بإذن/بدونه) من الإعدادات [3].
-- ═══════════════════════════════════════════════════════════════════════

insert into public.settings (key, value, description, category) values
  ('attendance_cutoff_time', '"12:00"'::jsonb,
   'آخر ساعة يُقبل فيها تسجيل يومية اليوم — بعدها تلزم صلاحية خاصة', 'hr'),
  ('attendance_day_values',
   '{"present": 1, "sick": 0.5, "excused": -1, "absent": -2}'::jsonb,
   'قيمة اليوم لكل حالة: الحاضر يوم، المريض نصف، الغياب بإذن يُخصم يوم وبدونه يومان',
   'hr')
on conflict (key) do update
  set description = excluded.description, category = excluded.category;

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  worker_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null default current_date,
  status text not null default 'present'
    check (status in ('present', 'excused', 'absent', 'sick')),
  -- العامل المؤقّت يُسجَّل ليومه دون أن يدخل حسابات الثبات
  is_temp boolean not null default false,
  note text not null default '',
  registered_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- [16] لا يُسجَّل العامل مرتين في اليوم ولو باختلاف المشروع
  unique (worker_id, work_date)
);

comment on table public.attendance is
  'يومية العامل. القيد الفريد (worker_id, work_date) يمنع تسجيله في مشروعين بيوم واحد [16].';

create index if not exists attendance_project_date_idx
  on public.attendance (project_id, work_date desc);
create index if not exists attendance_worker_idx
  on public.attendance (worker_id, work_date desc);

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

/** قيمة اليوم بحسب حالته — من الإعدادات لا من الكود. */
create or replace function public.attendance_day_value(p_status text)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (value -> p_status)::numeric
       from public.settings where key = 'attendance_day_values'),
    case p_status when 'present' then 1 when 'sick' then 0.5 else 0 end
  );
$$;

revoke execute on function public.attendance_day_value(text) from public, anon;
grant execute on function public.attendance_day_value(text) to authenticated;

/**
 * حارس التسجيل: يمنع تسجيل يومية اليوم بعد الساعة المحدّدة [17]،
 * ويشرح إن كان العامل مسجّلًا في مشروع آخر [16].
 */
create or replace function public.guard_attendance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff time;
  v_other_project text;
begin
  -- المسجَّل في مشروع آخر: رسالة تسمّي المشروع بدل خطأ قيد غامض
  select p.name into v_other_project
    from public.attendance a
    join public.projects p on p.id = a.project_id
   where a.worker_id = new.worker_id
     and a.work_date = new.work_date
     and a.id is distinct from new.id
   limit 1;

  if v_other_project is not null then
    raise exception 'العامل مسجّل اليوم في مشروع %', v_other_project
      using errcode = 'unique_violation';
  end if;

  -- الحدّ الزمني يخصّ يوم اليوم فقط؛ تصحيح الأيام السابقة شأن آخر
  if tg_op = 'INSERT'
     and new.work_date = (now() at time zone public.app_timezone())::date
     and not public.has_permission('attendance.late_register') then
    v_cutoff := coalesce(
      (select (value #>> '{}')::time from public.settings
        where key = 'attendance_cutoff_time'),
      time '12:00');

    if (now() at time zone public.app_timezone())::time > v_cutoff then
      raise exception 'انتهى وقت تسجيل اليوميات (%) — يلزم صلاحية خاصة', v_cutoff
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_guard on public.attendance;
create trigger attendance_guard
  before insert or update on public.attendance
  for each row execute function public.guard_attendance();

revoke execute on function public.guard_attendance() from public, anon, authenticated;

/**
 * اقتراح أسماء الأمس [شؤون الموظفين 2]: عمّال آخر يوم عمل مسجَّل للمشروع،
 * فيؤشّر المستخدم «صح» ويزيل الغائب فقط بدل إعادة الإدخال.
 */
create or replace function public.suggest_attendance(
  p_project_id uuid,
  p_date date default current_date
)
returns table (
  worker_id uuid,
  full_name text,
  card_no text,
  professions text[],
  last_status text,
  last_date date,
  already_registered boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with last_day as (
    select max(work_date) as d
    from public.attendance
    where project_id = p_project_id and work_date < p_date
  )
  select
    a.worker_id,
    p.full_name,
    e.card_no,
    e.professions,
    a.status,
    a.work_date,
    exists (
      select 1 from public.attendance t
      where t.worker_id = a.worker_id and t.work_date = p_date
    )
  from public.attendance a
  join last_day l on a.work_date = l.d
  join public.profiles p on p.id = a.worker_id
  join public.employees e on e.id = a.worker_id
  where a.project_id = p_project_id
    and p.is_active
    and public.has_permission('attendance.read')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(p_project_id))
  order by p.full_name;
$$;

revoke execute on function public.suggest_attendance(uuid, date) from public, anon;
grant execute on function public.suggest_attendance(uuid, date) to authenticated;

/**
 * تسجيل يومية كاملة دفعة واحدة.
 * p_entries: [{"worker_id": uuid, "status": text, "is_temp": bool, "note": text}]
 * الحذف من القائمة يعني غيابًا لم يُسجَّل، لا حذف السجل السابق.
 */
create or replace function public.register_attendance(
  p_project_id uuid,
  p_date date,
  p_entries jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry record;
  v_count integer := 0;
begin
  if not public.has_permission('attendance.register') then
    raise exception 'يتطلّب صلاحية attendance.register'
      using errcode = 'insufficient_privilege';
  end if;

  if not (public.has_permission('project.read_all')
          or public.is_assigned_to_project(p_project_id)) then
    raise exception 'المشروع غير معتمد لك' using errcode = 'insufficient_privilege';
  end if;

  for v_entry in
    select
      (e ->> 'worker_id')::uuid as worker_id,
      coalesce(e ->> 'status', 'present') as status,
      coalesce((e ->> 'is_temp')::boolean, false) as is_temp,
      coalesce(e ->> 'note', '') as note
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
  loop
    insert into public.attendance
      (project_id, worker_id, work_date, status, is_temp, note, registered_by)
    values
      (p_project_id, v_entry.worker_id, coalesce(p_date, current_date),
       v_entry.status, v_entry.is_temp, v_entry.note, auth.uid())
    on conflict (worker_id, work_date) do update
      set status = excluded.status,
          is_temp = excluded.is_temp,
          note = excluded.note,
          project_id = excluded.project_id,
          registered_by = excluded.registered_by;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.register_attendance(uuid, date, jsonb)
  from public, anon;
grant execute on function public.register_attendance(uuid, date, jsonb) to authenticated;

-- ── «كم يومية كلّفني المشروع» ──────────────────────────────────────────
-- عرضان: الأيام بلا مال يراه الجميع، والتكلفة يراها من يرى الأجور.
create or replace view public.project_labor_days
with (security_invoker = true) as
select
  a.project_id,
  p.code as project_code,
  p.name as project_name,
  to_char(a.work_date, 'YYYY-MM') as period,
  count(*) filter (where a.status = 'present')  as present_days,
  count(*) filter (where a.status = 'sick')     as sick_days,
  count(*) filter (where a.status = 'excused')  as excused_days,
  count(*) filter (where a.status = 'absent')   as absent_days,
  count(distinct a.worker_id)                   as workers_count,
  sum(public.attendance_day_value(a.status))    as payable_days
from public.attendance a
join public.projects p on p.id = a.project_id
group by a.project_id, p.code, p.name, to_char(a.work_date, 'YYYY-MM');

comment on view public.project_labor_days is
  'كم يومية كلّفت المشروع — بالأيام لا بالمال، فيراها من لا يرى الأجور.';

create or replace view public.project_labor_cost
with (security_invoker = true) as
select
  a.project_id,
  p.name as project_name,
  to_char(a.work_date, 'YYYY-MM') as period,
  a.worker_id,
  pr.full_name as worker_name,
  sum(public.attendance_day_value(a.status)) as payable_days,
  max(s.daily_wage) as daily_wage,
  round(sum(public.attendance_day_value(a.status)) * max(s.daily_wage), 2) as cost
from public.attendance a
join public.projects p on p.id = a.project_id
join public.profiles pr on pr.id = a.worker_id
join public.profile_salaries s on s.profile_id = a.worker_id
group by a.project_id, p.name, to_char(a.work_date, 'YYYY-MM'), a.worker_id, pr.full_name;

comment on view public.project_labor_cost is
  'تكلفة اليوميات بالمال — تظهر لمن يملك صلاحية رؤية الأجور وحده (RLS على profile_salaries).';
