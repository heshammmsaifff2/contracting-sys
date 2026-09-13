-- ═══════════════════════════════════════════════════════════════════════
-- الهيكل التنظيمي — المخطّط
--
--   التصنيف (إداري · تشغيلي)
--     └─ القسم
--          └─ الوظيفة  ← تحمل دور صلاحيات
--               └─ الموظف  ← وظيفة واحدة
--
-- الموظف يرث قسمه وتصنيفه وصلاحياته من وظيفته (المُشغّلات في الهجرة التالية).
-- والتصنيفات الأربعة القديمة تُطوى في اثنين: مدير → إداري، والباقي → تشغيلي.
-- وأوزان التقييم تتبعها: الإداري يرث أوزان «مدير»، والتشغيلي أوزان «مهندس».
-- ═══════════════════════════════════════════════════════════════════════

-- ── ١) صلاحية الهيكل التنظيمي ─────────────────────────────────────────
insert into public.permissions (key, description, module)
values ('org.manage', 'إدارة الأقسام والوظائف وإخفاء مرفقات الأقسام', 'identity')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'admin' and p.key = 'org.manage'
on conflict do nothing;

-- ── ٢) التصنيف: إداري · تشغيلي ────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_employee_type_check;
update public.profiles
   set employee_type = case when employee_type = 'admin' then 'administrative' else 'operational' end
 where employee_type not in ('administrative', 'operational');
alter table public.profiles
  add constraint profiles_employee_type_check
  check (employee_type in ('administrative', 'operational'));
alter table public.profiles alter column employee_type set default 'administrative';

-- «مشرف» و«عامل» تُطوى في التشغيلي، فأوزانهما تُحذف ويبقى وزن «مهندس»
alter table public.evaluation_weights drop constraint if exists evaluation_weights_employee_type_check;
delete from public.evaluation_weights where employee_type in ('supervisor', 'worker');
update public.evaluation_weights set employee_type = 'administrative' where employee_type = 'admin';
update public.evaluation_weights set employee_type = 'operational'    where employee_type = 'engineer';
alter table public.evaluation_weights
  add constraint evaluation_weights_employee_type_check
  check (employee_type in ('administrative', 'operational'));

alter table public.evaluation_rules drop constraint if exists evaluation_rules_employee_type_check;
update public.evaluation_rules
   set employee_type = case when employee_type = 'admin' then 'administrative' else 'operational' end
 where employee_type is not null and employee_type not in ('administrative', 'operational');
alter table public.evaluation_rules
  add constraint evaluation_rules_employee_type_check
  check (employee_type is null or employee_type in ('administrative', 'operational'));

-- لقطات التقييم تاريخٌ مجمَّد لا تُعاد كتابته؛ والواجهة تُسمّي قيمها القديمة

-- ── ٣) القسم يتبع تصنيفًا ─────────────────────────────────────────────
alter table public.departments
  add column if not exists classification text not null default 'administrative',
  add column if not exists description text not null default '',
  add column if not exists restrict_attachments boolean not null default false,
  add column if not exists sort_order integer not null default 0;

alter table public.departments drop constraint if exists departments_classification_check;
alter table public.departments
  add constraint departments_classification_check
  check (classification in ('administrative', 'operational'));

alter table public.departments drop constraint if exists departments_name_check;
alter table public.departments
  add constraint departments_name_check check (btrim(name) <> '');

-- ── ٤) الوظيفة تتبع قسمًا وتحمل صلاحيات ──────────────────────────────
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  role_id uuid not null references public.roles (id) on delete restrict,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (department_id, name)
);
create index if not exists jobs_role_idx on public.jobs (role_id);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();
drop trigger if exists jobs_set_created_by on public.jobs;
create trigger jobs_set_created_by before insert on public.jobs
  for each row execute function public.set_created_by();

-- ── ٥) الموظف ← وظيفة واحدة ───────────────────────────────────────────
alter table public.profiles
  add column if not exists job_id uuid references public.jobs (id) on delete restrict;
create index if not exists profiles_job_idx on public.profiles (job_id);

-- ── ٦) مصدر الدور: يدويّ أم من الوظيفة ────────────────────────────────
-- تغيير الوظيفة يسحب ما منحته السابقة وحده، ولا يمسّ ما أُسند يدويًّا
alter table public.user_roles
  add column if not exists source text not null default 'manual';
alter table public.user_roles drop constraint if exists user_roles_source_check;
alter table public.user_roles
  add constraint user_roles_source_check check (source in ('manual', 'job'));

-- ── ٧) قائمة الاستثناء لمرفقات القسم المخفية ──────────────────────────
create table if not exists public.department_attachment_access (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  kind text not null check (kind in ('user', 'department')),
  user_id uuid references public.profiles (id) on delete cascade,
  allowed_department_id uuid references public.departments (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint access_shape check (
    (kind = 'user' and user_id is not null and allowed_department_id is null)
    or (kind = 'department' and allowed_department_id is not null and user_id is null)
  ),
  constraint access_not_self check (allowed_department_id is distinct from department_id)
);
create unique index if not exists daa_user_uniq
  on public.department_attachment_access (department_id, user_id) where kind = 'user';
create unique index if not exists daa_dept_uniq
  on public.department_attachment_access (department_id, allowed_department_id)
  where kind = 'department';

drop trigger if exists daa_set_created_by on public.department_attachment_access;
create trigger daa_set_created_by before insert on public.department_attachment_access
  for each row execute function public.set_created_by();

-- ── ٨) المرفق يحمل قسم رافعه ──────────────────────────────────────────
-- `restrict` لا `set null`: حذف القسم يجعل مرفقاته المخفية مكشوفة بصمت
alter table public.transaction_attachments
  add column if not exists owner_department_id uuid
    references public.departments (id) on delete restrict;
create index if not exists ta_owner_dept_idx
  on public.transaction_attachments (owner_department_id);

-- ── ٩) مشاركو المسار: الوظيفة والقسم ──────────────────────────────────
alter table public.workflow_stage_participants
  add column if not exists job_id uuid references public.jobs (id) on delete restrict;

-- كان `cascade`: حذف قسمٍ يمحو مشاركي المسارات معه صامتًا
alter table public.workflow_stage_participants
  drop constraint if exists workflow_stage_participants_department_id_fkey;
alter table public.workflow_stage_participants
  add constraint workflow_stage_participants_department_id_fkey
  foreign key (department_id) references public.departments (id) on delete restrict;

alter table public.workflow_stage_participants
  drop constraint if exists workflow_stage_participants_kind_check;
alter table public.workflow_stage_participants
  add constraint workflow_stage_participants_kind_check
  check (kind in ('user', 'role', 'project_role', 'department_role', 'requester',
                  'audience', 'job', 'project_job', 'department'));

alter table public.workflow_stage_participants drop constraint if exists participant_shape;
alter table public.workflow_stage_participants add constraint participant_shape check (
  (kind = 'user'
     and user_id is not null and role_id is null and department_id is null and job_id is null)
  or (kind in ('role', 'project_role')
     and role_id is not null and user_id is null and department_id is null and job_id is null)
  or (kind = 'department_role'
     and role_id is not null and department_id is not null and user_id is null and job_id is null)
  or (kind in ('job', 'project_job')
     and job_id is not null and user_id is null and role_id is null and department_id is null)
  or (kind = 'department'
     and department_id is not null and user_id is null and role_id is null and job_id is null)
  or (kind in ('requester', 'audience')
     and user_id is null and role_id is null and department_id is null and job_id is null)
);

alter table public.workflow_stage_participants drop constraint if exists participant_sign_scope;
alter table public.workflow_stage_participants
  add constraint participant_sign_scope
  check (requires_sign = false or kind in ('project_role', 'project_job'));

-- ── ١٠) RLS والصلاحيات ────────────────────────────────────────────────
alter table public.jobs enable row level security;
alter table public.department_attachment_access enable row level security;

revoke all on public.jobs from anon;
revoke all on public.department_attachment_access from anon;
grant select, insert, update, delete on public.jobs to authenticated;
grant select, insert, update, delete on public.department_attachment_access to authenticated;

drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs for select to authenticated
  using (public.is_active_user());
drop policy if exists jobs_write on public.jobs;
create policy jobs_write on public.jobs for all to authenticated
  using (public.has_permission('org.manage'))
  with check (public.has_permission('org.manage'));

-- قائمة الاستثناء تكشف من يرى ماذا، فقراءتها لصاحب الهيكل وحده
drop policy if exists daa_select on public.department_attachment_access;
create policy daa_select on public.department_attachment_access for select to authenticated
  using (public.has_permission('org.manage'));
drop policy if exists daa_write on public.department_attachment_access;
create policy daa_write on public.department_attachment_access for all to authenticated
  using (public.has_permission('org.manage'))
  with check (public.has_permission('org.manage'));

-- الأقسام صارت من الهيكل التنظيمي لا من مواعيد العمل
drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments for all to authenticated
  using (public.has_permission('org.manage'))
  with check (public.has_permission('org.manage'));
