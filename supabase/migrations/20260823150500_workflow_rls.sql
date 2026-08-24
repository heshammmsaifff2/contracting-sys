-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4 — صلاحيات سير العمل وسياسات RLS
-- ═══════════════════════════════════════════════════════════════════════

insert into public.permissions (key, description, module) values
  ('workflow.manage',      'تعريف مسارات سير العمل ومراحلها',     'workflow'),
  ('transaction.read',     'عرض المعاملات',                       'workflow'),
  ('transaction.read_all', 'عرض كل المعاملات بلا استثناء',        'workflow'),
  ('transaction.create',   'إنشاء معاملة',                        'workflow'),
  ('transaction.override', 'التدخّل في معاملات الآخرين وإلغاؤها', 'workflow'),
  ('duration.manage',      'تحديد وتعديل مدد المراحل',            'workflow'),
  ('work_calendar.manage', 'تعديل مواعيد العمل والإجازات',        'workflow'),
  ('archive.receive',      'تسجيل استلام أصول المعاملات',         'workflow'),
  ('auto_letter.manage',   'إدارة الخطابات الآلية',               'workflow'),
  ('evaluation.read',      'عرض تقارير التقييم',                  'workflow'),
  ('evaluation.rate',      'تقييم الموظفين',                      'workflow'),
  ('evaluation.manage',    'تعديل بنود التقييم وأوزانها',         'workflow')
on conflict (key) do update
  set description = excluded.description, module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'workflow.manage', 'transaction.read', 'transaction.read_all', 'transaction.create',
  'transaction.override', 'duration.manage', 'work_calendar.manage',
  'auto_letter.manage', 'evaluation.read', 'evaluation.rate', 'evaluation.manage'
)
where r.key = 'program_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('transaction.read', 'transaction.create')
where r.key in ('engineer', 'project_manager', 'employee')
on conflict do nothing;

alter table public.departments                enable row level security;
alter table public.work_schedules             enable row level security;
alter table public.holidays                   enable row level security;
alter table public.workflow_definitions       enable row level security;
alter table public.workflow_steps             enable row level security;
alter table public.transactions               enable row level security;
alter table public.transaction_step_instances enable row level security;
alter table public.step_duration_settings     enable row level security;
alter table public.duration_change_log        enable row level security;
alter table public.archive_receipts           enable row level security;
alter table public.auto_letter_rules          enable row level security;
alter table public.evaluation_criteria        enable row level security;
alter table public.evaluation_weights         enable row level security;
alter table public.evaluation_scores          enable row level security;
alter table public.evaluation_exclusions      enable row level security;

revoke all on public.departments, public.work_schedules, public.holidays,
  public.workflow_definitions, public.workflow_steps, public.transactions,
  public.transaction_step_instances, public.step_duration_settings,
  public.duration_change_log, public.archive_receipts, public.auto_letter_rules,
  public.evaluation_criteria, public.evaluation_weights, public.evaluation_scores,
  public.evaluation_exclusions
  from anon;

-- تقويم العمل: يقرأه الجميع، ويعدّله صاحب الصلاحية
drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated using (public.is_active_user());
drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments
  for all to authenticated
  using (public.has_permission('work_calendar.manage'))
  with check (public.has_permission('work_calendar.manage'));

drop policy if exists work_schedules_select on public.work_schedules;
create policy work_schedules_select on public.work_schedules
  for select to authenticated using (public.is_active_user());
drop policy if exists work_schedules_write on public.work_schedules;
create policy work_schedules_write on public.work_schedules
  for all to authenticated
  using (public.has_permission('work_calendar.manage'))
  with check (public.has_permission('work_calendar.manage'));

drop policy if exists holidays_select on public.holidays;
create policy holidays_select on public.holidays
  for select to authenticated using (public.is_active_user());
drop policy if exists holidays_write on public.holidays;
create policy holidays_write on public.holidays
  for all to authenticated
  using (public.has_permission('work_calendar.manage'))
  with check (public.has_permission('work_calendar.manage'));

drop policy if exists workflow_definitions_select on public.workflow_definitions;
create policy workflow_definitions_select on public.workflow_definitions
  for select to authenticated using (public.has_permission('transaction.read'));
drop policy if exists workflow_definitions_write on public.workflow_definitions;
create policy workflow_definitions_write on public.workflow_definitions
  for all to authenticated
  using (public.has_permission('workflow.manage'))
  with check (public.has_permission('workflow.manage'));

drop policy if exists workflow_steps_select on public.workflow_steps;
create policy workflow_steps_select on public.workflow_steps
  for select to authenticated using (public.has_permission('transaction.read'));
drop policy if exists workflow_steps_write on public.workflow_steps;
create policy workflow_steps_write on public.workflow_steps
  for all to authenticated
  using (public.has_permission('workflow.manage'))
  with check (public.has_permission('workflow.manage'));

-- المعاملات: التفاصيل للموقّعين فقط [المراسلات 19]
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

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (
    public.has_permission('transaction.override')
    or public.is_transaction_participant(id)
  )
  with check (
    public.has_permission('transaction.override')
    or public.is_transaction_participant(id)
  );

drop policy if exists tsi_select on public.transaction_step_instances;
create policy tsi_select on public.transaction_step_instances
  for select to authenticated
  using (exists (select 1 from public.transactions t where t.id = transaction_id));

drop policy if exists tsi_update on public.transaction_step_instances;
create policy tsi_update on public.transaction_step_instances
  for update to authenticated
  using (
    assignee_id = (select auth.uid())
    or public.has_permission('transaction.override')
    or public.has_permission('duration.manage')
  )
  with check (
    assignee_id = (select auth.uid())
    or public.has_permission('transaction.override')
    or public.has_permission('duration.manage')
  );

drop policy if exists sds_select on public.step_duration_settings;
create policy sds_select on public.step_duration_settings
  for select to authenticated using (public.has_permission('transaction.read'));
drop policy if exists sds_write on public.step_duration_settings;
create policy sds_write on public.step_duration_settings
  for all to authenticated
  using (public.has_permission('duration.manage'))
  with check (public.has_permission('duration.manage'));

drop policy if exists duration_change_log_select on public.duration_change_log;
create policy duration_change_log_select on public.duration_change_log
  for select to authenticated using (public.has_permission('duration.manage'));

drop policy if exists archive_receipts_select on public.archive_receipts;
create policy archive_receipts_select on public.archive_receipts
  for select to authenticated
  using (exists (select 1 from public.transactions t where t.id = transaction_id));
drop policy if exists archive_receipts_write on public.archive_receipts;
create policy archive_receipts_write on public.archive_receipts
  for all to authenticated
  using (public.has_permission('archive.receive'))
  with check (public.has_permission('archive.receive'));

drop policy if exists auto_letter_rules_select on public.auto_letter_rules;
create policy auto_letter_rules_select on public.auto_letter_rules
  for select to authenticated using (public.has_permission('auto_letter.manage'));
drop policy if exists auto_letter_rules_write on public.auto_letter_rules;
create policy auto_letter_rules_write on public.auto_letter_rules
  for all to authenticated
  using (public.has_permission('auto_letter.manage'))
  with check (public.has_permission('auto_letter.manage'));

drop policy if exists evaluation_criteria_select on public.evaluation_criteria;
create policy evaluation_criteria_select on public.evaluation_criteria
  for select to authenticated using (public.is_active_user());
drop policy if exists evaluation_criteria_write on public.evaluation_criteria;
create policy evaluation_criteria_write on public.evaluation_criteria
  for all to authenticated
  using (public.has_permission('evaluation.manage'))
  with check (public.has_permission('evaluation.manage'));

drop policy if exists evaluation_weights_select on public.evaluation_weights;
create policy evaluation_weights_select on public.evaluation_weights
  for select to authenticated using (public.is_active_user());
drop policy if exists evaluation_weights_write on public.evaluation_weights;
create policy evaluation_weights_write on public.evaluation_weights
  for all to authenticated
  using (public.has_permission('evaluation.manage'))
  with check (public.has_permission('evaluation.manage'));

-- كل موظف يرى تقييمه؛ وصاحب الصلاحية يرى الجميع
drop policy if exists evaluation_scores_select on public.evaluation_scores;
create policy evaluation_scores_select on public.evaluation_scores
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission('evaluation.read')
  );
drop policy if exists evaluation_scores_write on public.evaluation_scores;
create policy evaluation_scores_write on public.evaluation_scores
  for all to authenticated
  using (public.has_permission('evaluation.rate'))
  with check (public.has_permission('evaluation.rate'));

drop policy if exists evaluation_exclusions_select on public.evaluation_exclusions;
create policy evaluation_exclusions_select on public.evaluation_exclusions
  for select to authenticated using (public.has_permission('evaluation.read'));
drop policy if exists evaluation_exclusions_write on public.evaluation_exclusions;
create policy evaluation_exclusions_write on public.evaluation_exclusions
  for all to authenticated
  using (public.has_permission('evaluation.manage'))
  with check (public.has_permission('evaluation.manage'));
