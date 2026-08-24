-- ═══════════════════════════════════════════════════════════════════════
-- Phase 7 — إصلاح حدّ وقت تسجيل اليوميات [17]
-- الخلل: الحارس كان يقارن work_date بتاريخ «اليوم» بتوقيت التطبيق، بينما
-- الواجهة (وقاعدة البيانات) تُرسل current_date بتوقيت UTC. قرب منتصف
-- الليل يختلف التاريخان فيتخطّى الشرط بصمت ويُسجَّل بعد الموعد بلا صلاحية.
--
-- الإصلاح: القاعدة على *وقت التسجيل* لا على تاريخ اليومية — وهو نصّ الشرط:
-- «منع التسجيل بعد 12 ظهرًا إلا بصلاحية». فيسقط فرق التوقيت من الحساب،
-- ويشمل المنع تصحيح الأيام السابقة بعد الموعد أيضًا (وهو المقصود).
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.guard_attendance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cutoff time;
  v_now time;
  v_other_project text;
begin
  -- المسجَّل في مشروع آخر: رسالة تسمّي المشروع بدل خطأ قيد غامض [16]
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

  -- [17] لا تسجيل ولا تعديل بعد الساعة المحدّدة إلا بصلاحية
  if not public.has_permission('attendance.late_register') then
    v_cutoff := coalesce(
      (select (value #>> '{}')::time from public.settings
        where key = 'attendance_cutoff_time'),
      time '12:00');

    v_now := (now() at time zone public.app_timezone())::time;

    if v_now > v_cutoff then
      raise exception 'انتهى وقت تسجيل اليوميات (%) — يلزم صلاحية خاصة', v_cutoff
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_attendance() from public, anon, authenticated;

comment on function public.guard_attendance() is
  'حارس اليوميات: عامل واحد ليوم واحد [16]، ولا تسجيل بعد الموعد إلا بصلاحية [17].';
