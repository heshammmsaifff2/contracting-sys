-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠١ — نواة محرّك المسارات v2: المراحل والمشاركون
--
-- يستبدل الطبقة الخطّية بالكامل. المرجع: docs/decisions/0001-workflow-engine-v2.md
--
-- الفرق الجوهري: كانت المرحلة والمكلَّف صفًّا واحدًا، فاستحال أن تقف المرحلة
-- عند أكثر من موظف. الآن المرحلة حاوية، والتكليف صفّ مستقل يحمل المدة
-- والعدّاد والدرجة — وهو شرط بقاء التقييم الفردي تحت التوازي.
-- ═══════════════════════════════════════════════════════════════════════

-- ── إسقاط الطبقة الخطّية ────────────────────────────────────────────────
-- العروض أولًا: تعتمد على الجداول ولا تُسقَط معها تلقائيًا بأمان.
drop view if exists public.overdue_transactions_report;
drop view if exists public.duration_change_report;
drop view if exists public.department_frequency_report;
drop view if exists public.employee_evaluation_summary;
drop view if exists public.transaction_inbox;

drop function if exists public.open_step_instance(uuid, uuid, smallint);
drop function if exists public.complete_step(uuid, text);
drop function if exists public.set_step_duration(uuid, integer, text, text);
drop function if exists public.resolve_step_assignee(uuid);

drop table if exists public.duration_change_log;
drop table if exists public.transaction_step_instances cascade;
drop table if exists public.workflow_steps cascade;

alter table public.transactions drop column if exists current_step_instance_id;

-- ── تعريف المرحلة ──────────────────────────────────────────────────────
-- لا `order_no`: التسلسل يأتي من `default_next_stage_id` هنا، ومن
-- `workflow_action_routes` في المرحلة ٠٢. `sort_order` للعرض فقط.
create table public.workflow_stages (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null
    references public.workflow_definitions (id) on delete cascade,
  stage_key text not null
    check (stage_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null check (btrim(name) <> ''),
  sort_order smallint not null default 1,

  -- متى تُغلق المرحلة وقد وقفت عند أكثر من مشارك
  completion_policy text not null default 'all'
    check (completion_policy in ('all', 'any', 'quorum')),
  quorum_count smallint check (quorum_count is null or quorum_count > 0),

  is_start boolean not null default false,
  is_final boolean not null default false,
  is_archive boolean not null default false,
  -- مرحلة مدير البرنامج — إعلامية؛ ما يوقف العدّاد فعلًا هو مدة فارغة [المراسلات 3]
  is_program_manager boolean not null default false,
  -- يلزم الضغط على «استلام» قبل الإنجاز
  requires_receive boolean not null default false,

  -- مهلة احتياطية حين لا توجد مدة معتمَدة للموظف؛ NULL ⇒ تقف على مدير البرنامج
  sla_minutes integer check (sla_minutes is null or sla_minutes > 0),

  default_next_stage_id uuid
    references public.workflow_stages (id) on delete set null,

  -- إحداثيات محرّر الخريطة (المرحلة ٠٦)
  pos_x numeric(10, 2) not null default 0,
  pos_y numeric(10, 2) not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  unique (definition_id, stage_key),
  constraint stages_quorum_needs_count
    check ((completion_policy = 'quorum') = (quorum_count is not null)),
  constraint stages_no_self_loop
    check (default_next_stage_id is distinct from id)
);

comment on table public.workflow_stages is
  'مرحلة في تعريف مسار. حاوية لا مكلَّف — المكلَّفون في workflow_stage_participants.';
comment on column public.workflow_stages.completion_policy is
  'all = ينجز الجميع · any = أوّلهم يكفي · quorum = عدد محدَّد';
comment on column public.workflow_stages.sla_minutes is
  'مهلة احتياطية. الأولوية لمدة الموظف في step_duration_settings [المراسلات 1، 6].';

create index workflow_stages_definition_idx
  on public.workflow_stages (definition_id, sort_order);
create index workflow_stages_next_idx
  on public.workflow_stages (default_next_stage_id);
-- بداية واحدة لكل تعريف
create unique index workflow_stages_one_start_idx
  on public.workflow_stages (definition_id) where is_start;

create trigger workflow_stages_set_updated_at
  before update on public.workflow_stages
  for each row execute function public.set_updated_at();
create trigger workflow_stages_set_created_by
  before insert on public.workflow_stages
  for each row execute function public.set_created_by();

-- ── من يقف على المرحلة ─────────────────────────────────────────────────
-- صفّ لكل مشارك. `role` يتمدّد إلى **كل** حاملي الدور — وهذا هو التوازي:
-- الدالة القديمة كانت تُرجع واحدًا بـ limit 1.
create table public.workflow_stage_participants (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null
    references public.workflow_stages (id) on delete cascade,
  kind text not null
    check (kind in ('user', 'role', 'department_role', 'requester')),
  user_id uuid references public.profiles (id) on delete cascade,
  role_id uuid references public.roles (id) on delete cascade,
  department_id uuid references public.departments (id) on delete cascade,
  -- الاختياري لا يمنع الإغلاق تحت سياسة all
  is_optional boolean not null default false,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),

  constraint participant_shape check (
    (kind = 'user'
       and user_id is not null and role_id is null and department_id is null)
    or (kind = 'role'
       and role_id is not null and user_id is null and department_id is null)
    or (kind = 'department_role'
       and role_id is not null and department_id is not null and user_id is null)
    or (kind = 'requester'
       and user_id is null and role_id is null and department_id is null)
  )
);

comment on table public.workflow_stage_participants is
  'مشاركو المرحلة. kind=role يتمدّد لكل حاملي الدور — أساس وقوف المرحلة عند أكثر من موظف.';
comment on column public.workflow_stage_participants.kind is
  'requester = طالب المعاملة — يجعل «تمام الإنجاز» [المراسلات 9] قابلًا للنمذجة صراحةً';

create index wsp_stage_idx on public.workflow_stage_participants (stage_id, sort_order);
create index wsp_user_fk_idx on public.workflow_stage_participants (user_id);
create index wsp_role_fk_idx on public.workflow_stage_participants (role_id);
create index wsp_department_fk_idx on public.workflow_stage_participants (department_id);

-- منع تكرار المشارك نفسه على المرحلة نفسها
create unique index wsp_uniq_user_idx
  on public.workflow_stage_participants (stage_id, user_id) where kind = 'user';
create unique index wsp_uniq_role_idx
  on public.workflow_stage_participants (stage_id, role_id) where kind = 'role';
create unique index wsp_uniq_dept_role_idx
  on public.workflow_stage_participants (stage_id, role_id, department_id)
  where kind = 'department_role';
create unique index wsp_uniq_requester_idx
  on public.workflow_stage_participants (stage_id) where kind = 'requester';

-- ── المرحلة وقد دخلتها معاملة ──────────────────────────────────────────
-- لا قيد `unique (transaction_id, order_no)`: أكثر من مرحلة نشطة ممكن،
-- وهو شرط التفريع المتوازي في المرحلة ٠٢.
create table public.transaction_stage_instances (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null
    references public.transactions (id) on delete cascade,
  stage_id uuid references public.workflow_stages (id) on delete set null,
  -- لقطة من التعريف: تعديل المسار لاحقًا لا يعيد كتابة التاريخ
  stage_key text not null default '',
  name text not null default '',
  seq integer not null check (seq > 0),
  completion_policy text not null default 'all'
    check (completion_policy in ('all', 'any', 'quorum')),
  quorum_count smallint check (quorum_count is null or quorum_count > 0),
  status text not null default 'in_progress'
    check (status in ('pending', 'in_progress', 'done', 'cancelled', 'skipped')),
  is_final boolean not null default false,
  is_archive boolean not null default false,
  requires_receive boolean not null default false,
  entered_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (transaction_id, seq)
);

comment on table public.transaction_stage_instances is
  'مرحلة فعلية على معاملة. تحمل لقطة من التعريف فلا يعيد تعديل المسار كتابة التاريخ.';

create index tsi_transaction_idx
  on public.transaction_stage_instances (transaction_id, seq);
create index tsi_open_idx
  on public.transaction_stage_instances (transaction_id)
  where status in ('pending', 'in_progress');
create index tsi_stage_fk_idx on public.transaction_stage_instances (stage_id);

-- ── التكليف: المدة والعدّاد والدرجة ────────────────────────────────────
create table public.transaction_assignments (
  id uuid primary key default gen_random_uuid(),
  stage_instance_id uuid not null
    references public.transaction_stage_instances (id) on delete cascade,
  -- مكرَّر عمدًا: يختصر RLS واستعلامات الوارد إلى انضمام واحد
  transaction_id uuid not null
    references public.transactions (id) on delete cascade,
  assignee_id uuid references public.profiles (id) on delete set null,
  participant_id uuid
    references public.workflow_stage_participants (id) on delete set null,
  is_optional boolean not null default false,

  -- NULL = بانتظار مدير البرنامج ليحدّد المدة [المراسلات 3]؛ العدّاد لا يبدأ قبلها
  allocated_minutes integer
    check (allocated_minutes is null or allocated_minutes > 0),
  arrived_at timestamptz not null default now(),
  received_at timestamptz,
  completed_at timestamptz,
  status text not null default 'in_progress'
    check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  score numeric(6, 2) check (score is null or (score >= 0 and score <= 100)),
  notes text not null default '',
  -- ملاحظة المدير: للجميع إن لم تُخصَّص، وإلا لصاحبها وحده [المراسلات 19]
  manager_note text not null default '',
  manager_note_visible_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  unique (stage_instance_id, assignee_id)
);

comment on table public.transaction_assignments is
  'تكليف موظف واحد بمرحلة. المدة والعدّاد والدرجة هنا لا على المرحلة — '
  'فخمسة مشاركين على مرحلة واحدة يعطون خمس درجات مستقلة [المراسلات 11-18].';

create index ta_stage_instance_idx
  on public.transaction_assignments (stage_instance_id);
create index ta_transaction_idx
  on public.transaction_assignments (transaction_id);
-- صندوق الوارد: «ما ينتظر تصرّفي»
create index ta_assignee_open_idx
  on public.transaction_assignments (assignee_id, status)
  where status in ('pending', 'in_progress');
create index ta_assignee_idx on public.transaction_assignments (assignee_id);
create index ta_participant_fk_idx on public.transaction_assignments (participant_id);
create index ta_manager_note_visible_idx
  on public.transaction_assignments (manager_note_visible_to);

-- ── سجل تعديل المدد [المراسلات 5] ──────────────────────────────────────
create table public.duration_change_log (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null
    references public.transaction_assignments (id) on delete cascade,
  old_minutes integer,
  new_minutes integer not null check (new_minutes > 0),
  reason text not null default '',
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

comment on table public.duration_change_log is
  'تقرير المدد المعدّلة: قبل/بعد/من عدّل [المراسلات 5].';

create index duration_change_log_assignment_idx
  on public.duration_change_log (assignment_id);
create index duration_change_log_changed_by_idx
  on public.duration_change_log (changed_by);
