-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٢ — سياسات وعروض الإجراءات
-- ═══════════════════════════════════════════════════════════════════════

alter table public.workflow_actions       enable row level security;
alter table public.workflow_action_routes enable row level security;
alter table public.transaction_action_log enable row level security;

revoke all on
  public.workflow_actions,
  public.workflow_action_routes,
  public.transaction_action_log
  from anon;

grant select, insert, update, delete
  on public.workflow_actions, public.workflow_action_routes
  to authenticated;

-- سجلّ الإجراءات لا يُكتب إلا من داخل المحرّك
revoke insert, update, delete on public.transaction_action_log from authenticated;
grant select on public.transaction_action_log to authenticated;

drop policy if exists workflow_actions_select on public.workflow_actions;
create policy workflow_actions_select on public.workflow_actions
  for select to authenticated
  using (public.has_permission('transaction.read'));

drop policy if exists workflow_actions_write on public.workflow_actions;
create policy workflow_actions_write on public.workflow_actions
  for all to authenticated
  using (public.has_permission('workflow.manage'))
  with check (public.has_permission('workflow.manage'));

drop policy if exists war_select on public.workflow_action_routes;
create policy war_select on public.workflow_action_routes
  for select to authenticated
  using (public.has_permission('transaction.read'));

drop policy if exists war_write on public.workflow_action_routes;
create policy war_write on public.workflow_action_routes
  for all to authenticated
  using (public.has_permission('workflow.manage'))
  with check (public.has_permission('workflow.manage'));

drop policy if exists tal_select on public.transaction_action_log;
create policy tal_select on public.transaction_action_log
  for select to authenticated
  using (
    public.has_permission('transaction.read')
    and (
      public.has_permission('transaction.read_all')
      or public.is_transaction_participant(transaction_id)
    )
  );

-- ── الأزرار المتاحة لكل تكليف مفتوح ────────────────────────────────────
-- الواجهة تعرض ما تُرجعه هذه، لا زرًّا واحدًا اسمه «إنجاز».
create or replace view public.assignment_available_actions
with (security_invoker = true) as
select
  a.id                as assignment_id,
  a.transaction_id,
  a.stage_instance_id,
  a.assignee_id,
  act.id              as action_id,
  act.action_key,
  act.label,
  act.kind,
  act.sort_order,
  act.requires_note,
  act.requires_attachment,
  act.requires_evaluation,
  act.return_minutes,
  -- عدد الوجهات المعرَّفة: صفر يعني زرًّا لا يقود إلى شيء
  (select count(*) from public.workflow_action_routes r where r.action_id = act.id)
                      as routes_count
from public.transaction_assignments a
join public.transaction_stage_instances si on si.id = a.stage_instance_id
join public.workflow_actions act on act.stage_id = si.stage_id
where a.status = 'in_progress';

comment on view public.assignment_available_actions is
  'أزرار المرحلة كما تظهر للمكلَّف — مصدر أزرار شاشة المعاملة.';

-- ── الخطّ الزمني ───────────────────────────────────────────────────────
create or replace view public.transaction_timeline
with (security_invoker = true) as
select
  l.id,
  l.transaction_id,
  l.stage_instance_id,
  l.assignment_id,
  l.action_id,
  l.action_key,
  l.action_label,
  l.kind,
  l.notes,
  l.acted_by,
  p.full_name    as acted_by_name,
  l.acted_at,
  si.seq,
  si.name        as stage_name
from public.transaction_action_log l
left join public.profiles p on p.id = l.acted_by
left join public.transaction_stage_instances si on si.id = l.stage_instance_id;

comment on view public.transaction_timeline is
  'كل إجراء اتُّخذ على المعاملة ومن اتّخذه ومتى — بما فيه الملاحظات.';

revoke all on public.assignment_available_actions, public.transaction_timeline
  from anon;
grant select on public.assignment_available_actions, public.transaction_timeline
  to authenticated;
