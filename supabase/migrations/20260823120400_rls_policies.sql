-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1 — سياسات RLS
-- RLS هو خط الدفاع الأساسي؛ الواجهة تُخفي وتُظهر لأغراض تجربة الاستخدام فقط.
-- كل سياسة تتحقّق من: (أ) صلاحية المستخدم، (ب) اعتماده على المشروع.
-- ═══════════════════════════════════════════════════════════════════════

-- ── تعبئة created_by آليًا ─────────────────────────────────────────────
create or replace function public.set_created_by()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

-- ── حماية أعمدة profiles الحسّاسة من التعديل الذاتي ────────────────────
-- RLS تعمل على مستوى الصف، فنمنع تعديل الأعمدة الإدارية بمُشغِّل.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.has_permission('user.update') then
    return new;
  end if;

  -- المستخدم العادي يعدّل اسمه فقط
  new.code := old.code;
  new.email := old.email;
  new.employee_type := old.employee_type;
  new.is_active := old.is_active;
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

drop trigger if exists projects_set_created_by on public.projects;
create trigger projects_set_created_by
  before insert on public.projects
  for each row execute function public.set_created_by();

drop trigger if exists project_assignments_set_created_by on public.project_assignments;
create trigger project_assignments_set_created_by
  before insert on public.project_assignments
  for each row execute function public.set_created_by();

drop trigger if exists user_roles_set_created_by on public.user_roles;
create trigger user_roles_set_created_by
  before insert on public.user_roles
  for each row execute function public.set_created_by();

drop trigger if exists role_permissions_set_created_by on public.role_permissions;
create trigger role_permissions_set_created_by
  before insert on public.role_permissions
  for each row execute function public.set_created_by();

-- ── تفعيل RLS على كل الجداول ───────────────────────────────────────────
alter table public.profiles            enable row level security;
alter table public.profile_salaries    enable row level security;
alter table public.permissions         enable row level security;
alter table public.roles               enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.user_roles          enable row level security;
alter table public.projects            enable row level security;
alter table public.project_assignments enable row level security;
alter table public.settings            enable row level security;

-- الزائر غير المسجّل لا يلمس شيئًا
revoke all on public.profiles, public.profile_salaries, public.permissions,
  public.roles, public.role_permissions, public.user_roles, public.projects,
  public.project_assignments, public.settings
  from anon;

-- ── profiles ───────────────────────────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.has_permission('user.read'));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.has_permission('user.create'));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.has_permission('user.update'))
  with check (id = (select auth.uid()) or public.has_permission('user.update'));

-- لا سياسة حذف: الموظف يُعطَّل ولا يُحذف حفاظًا على تاريخ المستندات.

-- ── profile_salaries — الحقل الأكثر حساسية ─────────────────────────────
drop policy if exists profile_salaries_select on public.profile_salaries;
create policy profile_salaries_select on public.profile_salaries
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.has_permission('user.read_salary')
  );

drop policy if exists profile_salaries_write on public.profile_salaries;
create policy profile_salaries_write on public.profile_salaries
  for all to authenticated
  using (public.has_permission('user.manage_salary'))
  with check (public.has_permission('user.manage_salary'));

-- ── permissions — تُعرَّف بالـ migrations فقط ──────────────────────────
drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select to authenticated
  using (public.has_permission('role.read'));

-- ── roles ──────────────────────────────────────────────────────────────
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to authenticated
  using (public.has_permission('role.read'));

drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles
  for insert to authenticated
  with check (public.has_permission('role.manage'));

drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles
  for update to authenticated
  using (public.has_permission('role.manage'))
  with check (public.has_permission('role.manage'));

drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles
  for delete to authenticated
  using (public.has_permission('role.manage') and not is_system);

-- ── role_permissions ───────────────────────────────────────────────────
drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (public.has_permission('role.read'));

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (public.has_permission('role.manage'))
  with check (public.has_permission('role.manage'));

-- ── user_roles ─────────────────────────────────────────────────────────
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('user.read'));

drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (public.has_permission('user.assign_role'))
  with check (public.has_permission('user.assign_role'));

-- ── projects — تطبيق قاعدة «المشاريع المعتمدة» ─────────────────────────
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (
    public.has_permission('project.read_all')
    or public.is_assigned_to_project(id)
  );

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.has_permission('project.create'));

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (
    public.has_permission('project.update')
    and (
      public.has_permission('project.read_all')
      or public.is_assigned_to_project(id)
    )
  )
  with check (public.has_permission('project.update'));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (public.has_permission('project.delete'));

-- ── project_assignments ────────────────────────────────────────────────
drop policy if exists project_assignments_select on public.project_assignments;
create policy project_assignments_select on public.project_assignments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission('project.assign')
    or public.has_permission('project.read_all')
  );

drop policy if exists project_assignments_write on public.project_assignments;
create policy project_assignments_write on public.project_assignments
  for all to authenticated
  using (public.has_permission('project.assign'))
  with check (public.has_permission('project.assign'));

-- ── settings ───────────────────────────────────────────────────────────
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to authenticated
  using (public.is_active_user());

drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings
  for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));
