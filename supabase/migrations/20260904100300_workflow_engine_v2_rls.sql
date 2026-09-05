-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠١ — سياسات RLS للمحرّك v2
--
-- تغيير أمني مقصود: جداول المحرّك صارت **للقراءة فقط** من `authenticated`.
--
-- كانت سياسة tsi_update القديمة تسمح للمكلَّف بتحديث صفّ مرحلته مباشرةً —
-- وبين أعمدة ذلك الصفّ `score`. أي أن الموظف كان يستطيع منح نفسه ١٠٠ برسالة
-- PATCH واحدة إلى PostgREST. الآن كل انتقال حالة يمرّ عبر دالة
-- SECURITY DEFINER تتحقّق من الصلاحية، ولا كتابة مباشرة البتّة.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.workflow_stages              enable row level security;
alter table public.workflow_stage_participants  enable row level security;
alter table public.transaction_stage_instances  enable row level security;
alter table public.transaction_assignments      enable row level security;
alter table public.duration_change_log          enable row level security;

revoke all on
  public.workflow_stages,
  public.workflow_stage_participants,
  public.transaction_stage_instances,
  public.transaction_assignments,
  public.duration_change_log
  from anon;

-- ── تعريف المسار: يقرؤه من يرى المعاملات، ويحرّره صاحب workflow.manage ──
grant select, insert, update, delete
  on public.workflow_stages, public.workflow_stage_participants
  to authenticated;

drop policy if exists workflow_stages_select on public.workflow_stages;
create policy workflow_stages_select on public.workflow_stages
  for select to authenticated
  using (public.has_permission('transaction.read'));

drop policy if exists workflow_stages_write on public.workflow_stages;
create policy workflow_stages_write on public.workflow_stages
  for all to authenticated
  using (public.has_permission('workflow.manage'))
  with check (public.has_permission('workflow.manage'));

drop policy if exists wsp_select on public.workflow_stage_participants;
create policy wsp_select on public.workflow_stage_participants
  for select to authenticated
  using (public.has_permission('transaction.read'));

drop policy if exists wsp_write on public.workflow_stage_participants;
create policy wsp_write on public.workflow_stage_participants
  for all to authenticated
  using (public.has_permission('workflow.manage'))
  with check (public.has_permission('workflow.manage'));

-- ── المعاملات وما تحتها: قراءة فقط ─────────────────────────────────────
revoke insert, update, delete on
  public.transactions,
  public.transaction_stage_instances,
  public.transaction_assignments,
  public.duration_change_log
  from authenticated;

grant select on
  public.transactions,
  public.transaction_stage_instances,
  public.transaction_assignments,
  public.duration_change_log
  to authenticated;

-- التفاصيل للموقّعين وحدهم [المراسلات 19]
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated
  using (
    public.has_permission('transaction.read')
    and (
      public.has_permission('transaction.read_all')
      or public.is_transaction_participant(id)
    )
  );

-- كانت هناك سياسة تحديث مباشر للمشاركين — أُلغيت عمدًا
drop policy if exists transactions_update on public.transactions;

drop policy if exists tsi_select on public.transaction_stage_instances;
create policy tsi_select on public.transaction_stage_instances
  for select to authenticated
  using (
    public.has_permission('transaction.read')
    and (
      public.has_permission('transaction.read_all')
      or public.is_transaction_participant(transaction_id)
    )
  );

drop policy if exists tsi_update on public.transaction_stage_instances;

drop policy if exists ta_select on public.transaction_assignments;
create policy ta_select on public.transaction_assignments
  for select to authenticated
  using (
    assignee_id = (select auth.uid())
    or (
      public.has_permission('transaction.read')
      and (
        public.has_permission('transaction.read_all')
        or public.is_transaction_participant(transaction_id)
      )
    )
  );

-- ── سجل تعديل المدد: لمن يملك duration.manage ──────────────────────────
drop policy if exists duration_change_log_select on public.duration_change_log;
create policy duration_change_log_select on public.duration_change_log
  for select to authenticated
  using (public.has_permission('duration.manage'));

-- ── تنظيف بقايا الطبقة القديمة ─────────────────────────────────────────
-- سياسات الجداول المسقَطة زالت معها؛ يبقى تأكيد أن لا صلاحية مباشرة
-- على step_duration_settings سوى ما ينصّ عليه duration.manage.
revoke insert, update, delete on public.step_duration_settings from authenticated;
grant select on public.step_duration_settings to authenticated;

drop policy if exists sds_write on public.step_duration_settings;
drop policy if exists sds_select on public.step_duration_settings;
create policy sds_select on public.step_duration_settings
  for select to authenticated
  using (public.has_permission('transaction.read'));
