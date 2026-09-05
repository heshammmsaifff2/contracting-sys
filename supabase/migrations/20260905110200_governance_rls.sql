-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٧ — RLS الحوكمة
--
-- شروط الجاهزية جزء من تعريف المسار: يقرؤها من يرى المعاملات (وإلا لم
-- يعرف الموظفُ لماذا عُطِّل زرّه)، ويحرّرها صاحب `workflow.manage` — وحارس
-- التجميد فوق ذلك يمنع تحريرها على إصدار منشور.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.workflow_stage_requirements enable row level security;

revoke all on public.workflow_stage_requirements from anon;
grant select, insert, update, delete
  on public.workflow_stage_requirements to authenticated;

drop policy if exists wsr_select on public.workflow_stage_requirements;
create policy wsr_select on public.workflow_stage_requirements
  for select to authenticated
  using (public.has_permission('transaction.read'));

drop policy if exists wsr_write on public.workflow_stage_requirements;
create policy wsr_write on public.workflow_stage_requirements
  for all to authenticated
  using (public.has_permission('workflow.manage'))
  with check (public.has_permission('workflow.manage'));

-- ── طابور الأرشيف ──────────────────────────────────────────────────────
/**
 * ما أُغلق ولم يُفهرس بعد. عرضٌ واحد يخدم شاشتين: صاحب المعاملة يرى ما
 * عليه أن يودعه، وأمين الأرشيف يرى ما ينتظر قبوله.
 *
 * `security_invoker` فيبقى ما يراه كلٌّ محكومًا بسياساته لا بصاحب العرض.
 */
create or replace view public.archive_queue
with (security_invoker = true) as
select
  t.id                    as transaction_id,
  t.no                    as transaction_no,
  t.type                  as transaction_type,
  t.subject,
  t.project_id,
  pr.name                 as project_name,
  t.closed_at,
  t.archive_state,
  t.archive_submitted_at,
  sub.full_name           as submitted_by_name,
  t.archived_at,
  arc.full_name           as archived_by_name,
  t.archive_location,
  -- كم مضى على الإغلاق بلا فهرسة — ما يُرتَّب عليه الطابور
  greatest(0, (extract(epoch from (now() - t.closed_at)) / 86400)::integer)
                          as days_since_closed
from public.transactions t
left join public.projects pr  on pr.id = t.project_id
left join public.profiles sub on sub.id = t.archive_submitted_by
left join public.profiles arc on arc.id = t.archived_by
where t.is_closed and t.archive_state <> 'archived';

comment on view public.archive_queue is
  'المعاملات المغلقة التي لم يصل أصلها الأرشيف بعد — مرتّبة بأقدم إغلاق.';

revoke all on public.archive_queue from anon;
grant select on public.archive_queue to authenticated;
