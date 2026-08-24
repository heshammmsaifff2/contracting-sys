-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1 — دوال الصلاحيات
-- كلها SECURITY DEFINER: تعمل بصلاحيات المالك فتتجاوز RLS، وهو ما يمنع
-- التكرار اللانهائي (recursion) حين تستدعيها سياسات الجداول نفسها.
-- search_path مثبّت لمنع اختطاف الدوال.
-- ═══════════════════════════════════════════════════════════════════════

-- هل المستخدم الحالي نشط؟ الموظف المعطَّل يفقد كل صلاحياته فورًا.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

-- هل يملك المستخدم الحالي هذه الصلاحية؟
create or replace function public.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and pr.is_active
      and p.key = permission_key
  );
$$;

comment on function public.has_permission(text) is
  'خط الدفاع الأول في كل سياسة RLS — يتحقّق من صلاحية دقيقة للمستخدم الحالي.';

-- هل المستخدم معتمد على هذا المشروع؟
create or replace function public.is_assigned_to_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.project_assignments pa
    join public.profiles pr on pr.id = pa.user_id
    where pa.project_id = p_project_id
      and pa.user_id = (select auth.uid())
      and pr.is_active
  );
$$;

comment on function public.is_assigned_to_project(uuid) is
  'تطبيق قاعدة: لا يرى الموظف إلا المشاريع المعتمد عليها.';

-- هل يحقّ له التوقيع على مستندات هذا المشروع؟
create or replace function public.can_sign_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.project_assignments pa
    join public.profiles pr on pr.id = pa.user_id
    where pa.project_id = p_project_id
      and pa.user_id = (select auth.uid())
      and pa.can_sign
      and pr.is_active
  );
$$;

comment on function public.can_sign_project(uuid) is
  'تطبيق قاعدة: ممنوع التوقيع على مستند يخص مشروعًا غير معتمد عليه.';

-- كل مفاتيح صلاحيات المستخدم الحالي — تستهلكها الواجهة مرة واحدة عند الدخول.
create or replace function public.current_permissions()
returns setof text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct p.key
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  join public.profiles pr on pr.id = ur.user_id
  where ur.user_id = (select auth.uid()) and pr.is_active;
$$;

-- معرّفات المشاريع المعتمد عليها المستخدم الحالي.
create or replace function public.current_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pa.project_id
  from public.project_assignments pa
  join public.profiles pr on pr.id = pa.user_id
  where pa.user_id = (select auth.uid()) and pr.is_active;
$$;

-- ── إنشاء ملف الموظف تلقائيًا عند تسجيل مستخدم جديد ────────────────────
-- أول مستخدم في النظام يحصل على دور admin (bootstrap)، وما بعده بلا أدوار
-- حتى يمنحه صاحب الصلاحية دورًا صراحةً.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_first boolean;
  v_admin_role_id uuid;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  insert into public.profiles (id, email, full_name, employee_type)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'employee_type', ''), 'admin')
  )
  on conflict (id) do nothing;

  if v_is_first then
    select id into v_admin_role_id from public.roles where key = 'admin';
    if v_admin_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (new.id, v_admin_role_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- مزامنة البريد عند تغييره في auth.users
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
