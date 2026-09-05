-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٣ — سياسات المرفقات وعرضها
-- ═══════════════════════════════════════════════════════════════════════

alter table public.transaction_attachments enable row level security;

revoke all on public.transaction_attachments from anon;
-- الكتابة عبر الدوال وحدها، كبقيّة جداول المحرّك
revoke insert, update, delete on public.transaction_attachments from authenticated;
grant select on public.transaction_attachments to authenticated;

-- التقييد داخل الصفّ لا في الواجهة: من لا يراه لا يصل إلى رابطه
drop policy if exists transaction_attachments_select on public.transaction_attachments;
create policy transaction_attachments_select on public.transaction_attachments
  for select to authenticated
  using (
    (
      public.has_permission('transaction.read_all')
      or public.is_transaction_participant(transaction_id)
    )
    and (
      visibility = 'participants'
      or (visibility = 'department' and (
            public.has_permission('attachment.read_restricted')
            or exists (
              select 1 from public.profiles p
              where p.id = (select auth.uid())
                and p.department_id = transaction_attachments.department_id)))
      or (visibility = 'permission'
          and public.has_permission(required_permission))
    )
  );

-- ── عرض المرفقات ──────────────────────────────────────────────────────
create or replace view public.transaction_attachment_list
with (security_invoker = true) as
select
  a.id,
  a.transaction_id,
  a.assignment_id,
  a.stage_instance_id,
  a.action_log_id,
  a.name,
  a.file,
  a.content_type,
  a.size_bytes,
  a.visibility,
  a.department_id,
  d.name          as department_name,
  a.required_permission,
  a.is_authenticated,
  a.uploaded_by,
  up.full_name    as uploaded_by_name,
  a.created_at,
  si.seq,
  si.name         as stage_name
from public.transaction_attachments a
left join public.profiles up on up.id = a.uploaded_by
left join public.departments d on d.id = a.department_id
left join public.transaction_stage_instances si on si.id = a.stage_instance_id;

comment on view public.transaction_attachment_list is
  'مرفقات المعاملة بأسماء رافعيها ومراحلها — محكومة بسياسة الجدول نفسه.';

revoke all on public.transaction_attachment_list from anon;
grant select on public.transaction_attachment_list to authenticated;

-- ── عدّاد المرفقات على التكليف ─────────────────────────────────────────
-- الواجهة تحتاجه لتعطّل زرًّا يشترط مرفقًا قبل أن يُردّ من الخادم.
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
  (select count(*) from public.workflow_action_routes r where r.action_id = act.id)
                      as routes_count,
  (select count(*) from public.transaction_attachments att
    where att.assignment_id = a.id)
                      as attachment_count
from public.transaction_assignments a
join public.transaction_stage_instances si on si.id = a.stage_instance_id
join public.workflow_actions act on act.stage_id = si.stage_id
where a.status = 'in_progress';

comment on view public.assignment_available_actions is
  'أزرار المرحلة كما تظهر للمكلَّف، ومعها عدد ما أرفقه على تكليفه.';

revoke all on public.assignment_available_actions from anon;
grant select on public.assignment_available_actions to authenticated;
