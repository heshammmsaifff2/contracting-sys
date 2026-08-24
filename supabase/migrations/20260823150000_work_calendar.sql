-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4 — تقويم العمل: الأقسام ومواعيد الدوام والإجازات.
-- هذا أساس العدّاد التنازلي الذي «يُحسب داخل مواعيد العمل فقط،
-- ويتوقّف خارج الدوام وأيام الإجازات ويكمل اليوم التالي» [المراسلات 3، 7].
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

-- الموظف ينتمي لقسم؛ يُستخدم في توجيه مراحل سير العمل
alter table public.profiles
  add column if not exists department_id uuid
  references public.departments (id) on delete set null;

-- ── مواعيد العمل ───────────────────────────────────────────────────────
-- إعداد عام لكل الموظفين + استثناءات فردية [المراسلات 8].
-- صف بـ scope='user' يُلغي العام لذلك اليوم لذلك الموظف.
create table if not exists public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global' check (scope in ('global', 'user')),
  user_id uuid references public.profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_schedules_valid_range check (end_time > start_time),
  constraint work_schedules_user_scope
    check ((scope = 'user') = (user_id is not null))
);

comment on column public.work_schedules.day_of_week is
  '0 = الأحد … 6 = السبت (يطابق extract(dow))';

create unique index if not exists work_schedules_global_day_idx
  on public.work_schedules (day_of_week, start_time)
  where scope = 'global';
create index if not exists work_schedules_user_idx
  on public.work_schedules (user_id, day_of_week);

drop trigger if exists work_schedules_set_updated_at on public.work_schedules;
create trigger work_schedules_set_updated_at before update on public.work_schedules
  for each row execute function public.set_updated_at();

-- ── الإجازات ───────────────────────────────────────────────────────────
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  description text not null default '',
  scope text not null default 'global' check (scope in ('global', 'user')),
  user_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint holidays_user_scope check ((scope = 'user') = (user_id is not null))
);

create unique index if not exists holidays_global_date_idx
  on public.holidays (holiday_date) where scope = 'global';
create index if not exists holidays_user_idx on public.holidays (user_id, holiday_date);

-- ── الإعدادات المرتبطة ─────────────────────────────────────────────────
insert into public.settings (key, value, description, category) values
  ('timezone', '"Africa/Cairo"', 'المنطقة الزمنية المعتمدة لحساب الدوام', 'workflow')
on conflict (key) do update set description = excluded.description;

create or replace function public.app_timezone()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (value #>> '{}') from public.settings where key = 'timezone'),
    'UTC'
  );
$$;

-- ── دوام افتراضي: الأحد إلى الخميس 9 ص – 5 م ───────────────────────────
-- قابل للتعديل بالكامل من الواجهة؛ وجوده ضروري لئلّا يكون كل الوقت خارج الدوام.
insert into public.work_schedules (scope, day_of_week, start_time, end_time)
select 'global', d, time '09:00', time '17:00'
from generate_series(0, 4) as d
on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════════════
-- الدالتان المحوريتان: قياس وقت العمل، وإضافة وقت عمل.
-- ═══════════════════════════════════════════════════════════════════════

/**
 * عدد دقائق العمل الفعلية بين لحظتين، مع تخطّي خارج الدوام والإجازات.
 * الاستثناء الفردي للموظف يُلغي الجدول العام لذلك اليوم.
 */
create or replace function public.business_minutes_between(
  p_from timestamptz,
  p_to timestamptz,
  p_user_id uuid default null
)
returns integer
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_tz text := public.app_timezone();
  v_from timestamp;
  v_to timestamp;
  v_date date;
  v_last date;
  v_total int := 0;
  v_sched record;
  v_seg_start timestamp;
  v_seg_end timestamp;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    return 0;
  end if;

  v_from := p_from at time zone v_tz;
  v_to := p_to at time zone v_tz;
  v_date := v_from::date;
  v_last := v_to::date;

  while v_date <= v_last loop
    -- يوم إجازة (عامة أو خاصة بالموظف) لا يُحتسب إطلاقًا
    if not exists (
      select 1 from public.holidays h
      where h.holiday_date = v_date
        and (h.scope = 'global' or h.user_id = p_user_id)
    ) then
      for v_sched in
        select ws.start_time, ws.end_time
        from public.work_schedules ws
        where ws.day_of_week = extract(dow from v_date)::smallint
          and (
            (ws.scope = 'user' and ws.user_id = p_user_id)
            or (
              ws.scope = 'global'
              and not exists (
                select 1 from public.work_schedules u
                where u.scope = 'user'
                  and u.user_id = p_user_id
                  and u.day_of_week = ws.day_of_week
              )
            )
          )
      loop
        v_seg_start := greatest(v_date + v_sched.start_time, v_from);
        v_seg_end := least(v_date + v_sched.end_time, v_to);
        if v_seg_end > v_seg_start then
          v_total := v_total
            + floor(extract(epoch from (v_seg_end - v_seg_start)) / 60)::int;
        end if;
      end loop;
    end if;

    v_date := v_date + 1;
  end loop;

  return v_total;
end;
$$;

comment on function public.business_minutes_between(timestamptz, timestamptz, uuid) is
  'دقائق العمل بين لحظتين — يتوقّف خارج الدوام وأيام الإجازات [المراسلات 3].';

/**
 * موعد الاستحقاق: يضيف دقائق عمل إلى لحظة، فيتخطّى المساء والإجازات.
 * محدودة بسنة للأمام حتى لا تدور بلا نهاية إن لم يُعرَّف أي دوام.
 */
create or replace function public.add_business_minutes(
  p_from timestamptz,
  p_minutes integer,
  p_user_id uuid default null
)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_tz text := public.app_timezone();
  v_from timestamp;
  v_date date;
  v_guard date;
  v_left int := greatest(coalesce(p_minutes, 0), 0);
  v_sched record;
  v_seg_start timestamp;
  v_seg_end timestamp;
  v_available int;
begin
  if p_from is null then
    return null;
  end if;
  if v_left = 0 then
    return p_from;
  end if;

  v_from := p_from at time zone v_tz;
  v_date := v_from::date;
  v_guard := v_date + 365;

  while v_date <= v_guard loop
    if not exists (
      select 1 from public.holidays h
      where h.holiday_date = v_date
        and (h.scope = 'global' or h.user_id = p_user_id)
    ) then
      for v_sched in
        select ws.start_time, ws.end_time
        from public.work_schedules ws
        where ws.day_of_week = extract(dow from v_date)::smallint
          and (
            (ws.scope = 'user' and ws.user_id = p_user_id)
            or (
              ws.scope = 'global'
              and not exists (
                select 1 from public.work_schedules u
                where u.scope = 'user'
                  and u.user_id = p_user_id
                  and u.day_of_week = ws.day_of_week
              )
            )
          )
        order by ws.start_time
      loop
        v_seg_start := greatest(v_date + v_sched.start_time, v_from);
        v_seg_end := v_date + v_sched.end_time;

        if v_seg_end > v_seg_start then
          v_available := floor(extract(epoch from (v_seg_end - v_seg_start)) / 60)::int;

          if v_available >= v_left then
            return (v_seg_start + make_interval(mins => v_left)) at time zone v_tz;
          end if;

          v_left := v_left - v_available;
        end if;
      end loop;
    end if;

    v_date := v_date + 1;
  end loop;

  -- لا دوام معرَّف يكفي لاستيعاب المدة
  return null;
end;
$$;

comment on function public.add_business_minutes(timestamptz, integer, uuid) is
  'موعد الاستحقاق بعد إضافة دقائق عمل — يتخطّى المساء والإجازات.';

revoke execute on function public.business_minutes_between(timestamptz, timestamptz, uuid)
  from public, anon;
revoke execute on function public.add_business_minutes(timestamptz, integer, uuid)
  from public, anon;
revoke execute on function public.app_timezone() from public, anon;
grant execute on function public.business_minutes_between(timestamptz, timestamptz, uuid)
  to authenticated;
grant execute on function public.add_business_minutes(timestamptz, integer, uuid)
  to authenticated;
grant execute on function public.app_timezone() to authenticated;
