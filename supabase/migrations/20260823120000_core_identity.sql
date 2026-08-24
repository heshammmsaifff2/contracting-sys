-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1 — الهوية والأدوار والصلاحيات
-- كل الجداول idempotent ليمكن إعادة تطبيقها بأمان.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- دالة مشتركة لتحديث updated_at في كل الجداول العملياتية
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── profiles ───────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  code text unique,
  email text,
  full_name text not null,
  employee_type text not null default 'admin'
    check (employee_type in ('admin', 'engineer', 'supervisor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.profiles is
  'ملف الموظف، مرتبط 1:1 بـ auth.users. الراتب في profile_salaries لأنه حقل حسّاس.';
comment on column public.profiles.employee_type is
  'تصنيف الموظف: admin=إداري، engineer=مهندس، supervisor=مشرف';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── profile_salaries ───────────────────────────────────────────────────
-- الراتب في جدول منفصل لأن RLS تعمل على مستوى الصف لا العمود،
-- ففصله هو الطريقة الوحيدة لإخفائه فعليًا عمّن لا يملك صلاحية الرواتب.
create table if not exists public.profile_salaries (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  base_salary numeric(14, 2) not null default 0 check (base_salary >= 0),
  currency text not null default 'EGP',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

drop trigger if exists profile_salaries_set_updated_at on public.profile_salaries;
create trigger profile_salaries_set_updated_at
  before update on public.profile_salaries
  for each row execute function public.set_updated_at();

-- ── permissions ────────────────────────────────────────────────────────
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text not null,
  module text not null default 'core',
  created_at timestamptz not null default now()
);

comment on column public.permissions.key is
  'مفتاح الصلاحية بصيغة entity.action مثل material_request.create';

-- ── roles ──────────────────────────────────────────────────────────────
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on column public.roles.is_system is
  'أدوار النظام لا تُحذف ولا يُعدَّل مفتاحها';

drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

-- ── role_permissions ───────────────────────────────────────────────────
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (role_id, permission_id)
);

create index if not exists role_permissions_permission_idx
  on public.role_permissions (permission_id);

-- ── user_roles ─────────────────────────────────────────────────────────
create table if not exists public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role_id)
);

create index if not exists user_roles_role_idx on public.user_roles (role_id);
