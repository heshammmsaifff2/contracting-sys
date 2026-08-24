-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4 — محرّك سير العمل: التعريفات والمراحل والمعاملات.
-- يُعاد استخدامه لكل مستند قابل للاعتماد (خطاب، مستخلص، عهدة، طلب احتياج).
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

drop trigger if exists workflow_definitions_set_updated_at on public.workflow_definitions;
create trigger workflow_definitions_set_updated_at
  before update on public.workflow_definitions
  for each row execute function public.set_updated_at();

drop trigger if exists workflow_definitions_set_created_by on public.workflow_definitions;
create trigger workflow_definitions_set_created_by
  before insert on public.workflow_definitions
  for each row execute function public.set_created_by();

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null
    references public.workflow_definitions (id) on delete cascade,
  order_no smallint not null check (order_no > 0),
  name text not null,
  role_id uuid references public.roles (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  -- التوزيع الآلي [المراسلات 23]: كل معاملات هذا النوع تذهب لهذا الموظف
  default_assignee_id uuid references public.profiles (id) on delete set null,
  -- مرحلة مدير البرنامج — إجبارية لتحديد المدة أول مرة [المراسلات 3]
  is_program_manager boolean not null default false,
  -- مرحلة الأرشيف لاستلام الأصل [المراسلات 22]
  is_archive boolean not null default false,
  created_at timestamptz not null default now(),
  unique (definition_id, order_no)
);

comment on column public.workflow_steps.default_assignee_id is
  'التوزيع الآلي بدل تجميع المعاملات على المدير [المراسلات 23]';

-- ── المعاملات ──────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  type text not null,
  subject text not null default '',
  -- مرجع متعدّد الأشكال للمستند المصدر (مستخلص، عهدة، طلب احتياج…)
  entity_type text,
  entity_id uuid,
  project_id uuid references public.projects (id) on delete restrict,
  definition_id uuid references public.workflow_definitions (id) on delete restrict,
  current_step_instance_id uuid,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'awaiting_confirmation', 'completed', 'cancelled')),
  requested_by uuid references public.profiles (id) on delete set null,
  is_closed boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.transactions is
  'أي معاملة تسير في النظام. الترقيم آلي [المراسلات 20].';

create index if not exists transactions_type_idx on public.transactions (type);
create index if not exists transactions_project_idx on public.transactions (project_id);
create index if not exists transactions_status_idx on public.transactions (status);

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_created_by on public.transactions;
create trigger transactions_set_created_by before insert on public.transactions
  for each row execute function public.set_created_by();

-- ── مراحل المعاملة الفعلية ─────────────────────────────────────────────
create table if not exists public.transaction_step_instances (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  step_id uuid references public.workflow_steps (id) on delete set null,
  order_no smallint not null,
  name text not null default '',
  assignee_id uuid references public.profiles (id) on delete set null,
  -- NULL = بانتظار مدير البرنامج ليحدّد المدة [المراسلات 3]. العدّاد لا يبدأ قبلها.
  allocated_minutes integer check (allocated_minutes is null or allocated_minutes > 0),
  arrived_at timestamptz,
  completed_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  score numeric(6, 2),
  notes text not null default '',
  -- ملاحظات المدير: إمّا لموظف بعينه أو لكل من له توقيع [المراسلات 19]
  manager_note text not null default '',
  manager_note_visible_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (transaction_id, order_no)
);

create index if not exists tsi_transaction_idx
  on public.transaction_step_instances (transaction_id);
create index if not exists tsi_assignee_idx
  on public.transaction_step_instances (assignee_id, status);

alter table public.transactions
  drop constraint if exists transactions_current_step_fkey;
alter table public.transactions
  add constraint transactions_current_step_fkey
  foreign key (current_step_instance_id)
  references public.transaction_step_instances (id) on delete set null;

-- ── إعدادات المدد: تُدخَل مرة واحدة ─────────────────────────────────────
-- [المراسلات 1، 2، 6]: لكل موظف/نوع معاملة مدة، مع خيار التكرار.
create table if not exists public.step_duration_settings (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null,
  role_id uuid references public.roles (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  minutes integer not null check (minutes > 0),
  -- all_occurrences = تُطبَّق في كل مرة · single = تُسأل من جديد بعدها
  duration_scope text not null default 'all_occurrences'
    check (duration_scope in ('all_occurrences', 'single')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on column public.step_duration_settings.duration_scope is
  'هل المدة لكل مرات التكرار أم لمرة واحدة [المراسلات 2]';

-- الموظف أدقّ من الدور: مفاتيح فريدة منفصلة
create unique index if not exists sds_user_idx
  on public.step_duration_settings (transaction_type, user_id)
  where user_id is not null;
create unique index if not exists sds_role_idx
  on public.step_duration_settings (transaction_type, role_id)
  where user_id is null and role_id is not null;
create unique index if not exists sds_type_idx
  on public.step_duration_settings (transaction_type)
  where user_id is null and role_id is null;

drop trigger if exists sds_set_updated_at on public.step_duration_settings;
create trigger sds_set_updated_at before update on public.step_duration_settings
  for each row execute function public.set_updated_at();

drop trigger if exists sds_set_created_by on public.step_duration_settings;
create trigger sds_set_created_by before insert on public.step_duration_settings
  for each row execute function public.set_created_by();

-- ── سجلّ تعديل المدد [المراسلات 5] ─────────────────────────────────────
create table if not exists public.duration_change_log (
  id uuid primary key default gen_random_uuid(),
  step_instance_id uuid not null
    references public.transaction_step_instances (id) on delete cascade,
  old_minutes integer,
  new_minutes integer not null,
  reason text not null default '',
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

comment on table public.duration_change_log is
  'تقرير بالمدد المعدّلة: قبل/بعد/الموظف [المراسلات 5].';

create index if not exists duration_change_log_step_idx
  on public.duration_change_log (step_instance_id);

-- ── استلام الأصل من الأرشيف [المراسلات 22] ─────────────────────────────
create table if not exists public.archive_receipts (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique
    references public.transactions (id) on delete cascade,
  received boolean not null default false,
  received_at timestamptz,
  has_original boolean not null default false,
  received_by uuid references public.profiles (id) on delete set null,
  notes text not null default ''
);
