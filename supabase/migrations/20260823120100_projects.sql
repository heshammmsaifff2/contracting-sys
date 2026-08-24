-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1 — المشاريع وربط الموظفين بها
-- project_assignments هو مفتاح تطبيق القاعدة الأمنية المتكرّرة في المواصفات:
-- «ليس من حق أي أحد التوقيع على شيء يخص مشروعًا هو غير معتمد عليه».
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  owner_entity text,
  contract_value numeric(16, 2) not null default 0 check (contract_value >= 0),
  received_at date,
  manager_id uuid references public.profiles (id) on delete set null,
  extracts_officer_id uuid references public.profiles (id) on delete set null,
  status text not null default 'active'
    check (status in ('draft', 'active', 'suspended', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on column public.projects.owner_entity is 'الجهة المالكة للمشروع';
comment on column public.projects.extracts_officer_id is 'موظف المستخلصات المسؤول';

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create index if not exists projects_manager_idx on public.projects (manager_id);
create index if not exists projects_status_idx on public.projects (status);

-- ── project_assignments ────────────────────────────────────────────────
create table if not exists public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  can_sign boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (project_id, user_id)
);

comment on column public.project_assignments.can_sign is
  'هل يحقّ للموظف التوقيع على مستندات هذا المشروع';

create index if not exists project_assignments_user_idx
  on public.project_assignments (user_id);
