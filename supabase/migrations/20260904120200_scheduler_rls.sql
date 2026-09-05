-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٤ — سياسات المجدوِل ونبضته
-- ═══════════════════════════════════════════════════════════════════════

alter table public.scheduled_tasks     enable row level security;
alter table public.scheduled_task_runs enable row level security;

revoke all on public.scheduled_tasks, public.scheduled_task_runs from anon;

grant select, insert, update, delete on public.scheduled_tasks to authenticated;
-- سجلّ التشغيل لا يُكتب إلا من داخل المجدوِل
revoke insert, update, delete on public.scheduled_task_runs from authenticated;
grant select on public.scheduled_task_runs to authenticated;

drop policy if exists scheduled_tasks_select on public.scheduled_tasks;
create policy scheduled_tasks_select on public.scheduled_tasks
  for select to authenticated
  using (public.has_permission('schedule.manage'));

drop policy if exists scheduled_tasks_write on public.scheduled_tasks;
create policy scheduled_tasks_write on public.scheduled_tasks
  for all to authenticated
  using (public.has_permission('schedule.manage'))
  with check (public.has_permission('schedule.manage'));

drop policy if exists scheduled_task_runs_select on public.scheduled_task_runs;
create policy scheduled_task_runs_select on public.scheduled_task_runs
  for select to authenticated
  using (public.has_permission('schedule.manage'));

-- ── عرض حالة المجدوِل ──────────────────────────────────────────────────
-- المجدوِل يعمل بلا رقيب؛ هذا العرض هو ما يجعل فشله مرئيًا.
create or replace view public.scheduled_task_status
with (security_invoker = true) as
select
  s.id,
  s.name,
  s.is_active,
  s.action,
  s.transaction_type,
  s.project_id,
  pr.name                        as project_name,
  s.audience,
  s.schedule_kind,
  s.schedule_spec,
  s.shift_to_workday,
  s.next_run_at,
  s.last_run_at,
  s.last_status,
  s.last_error,
  s.run_count,
  -- كم سيصل هذا التعميم الآن لو عمل — يُحسب حيًّا لا وقت الإعداد
  (select count(*) from public.resolve_audience(s.audience)) as audience_size,
  (select count(*) from public.scheduled_task_runs r
    where r.task_id = s.id and r.status = 'error')           as error_runs,
  (select max(r.fired_at) from public.scheduled_task_runs r
    where r.task_id = s.id)                                  as last_fired_at
from public.scheduled_tasks s
left join public.projects pr on pr.id = s.project_id;

comment on view public.scheduled_task_status is
  'حالة كل مهمة مجدولة وحجم جمهورها الآن وعدد مرات فشلها.';

revoke all on public.scheduled_task_status from anon;
grant select on public.scheduled_task_status to authenticated;

-- ── النبضة ─────────────────────────────────────────────────────────────
-- pg_cron يقرّر متى يعمل **المشغِّل**؛ واستحقاق كل مهمة يقرّره next_run_at.
-- نبضة كل دقيقة: أدقّ ما يمكن، وكلفتها استعلام واحد على فهرس جزئي.
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  perform cron.unschedule('run-scheduled-tasks');
exception when others then
  -- لم تكن مجدولة بعد
  null;
end $$;

select cron.schedule(
  'run-scheduled-tasks',
  '* * * * *',
  $cron$select public.run_scheduled_tasks()$cron$
);
