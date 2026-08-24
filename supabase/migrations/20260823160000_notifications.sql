-- ═══════════════════════════════════════════════════════════════════════
-- Phase 5 — الإشعارات الفورية
-- المخازن تتطلّب «إشعارًا فوريًا عند تنزيل الكميات» [المخازن 18، 19].
-- الجدول عام لأن كل الوحدات ستحتاجه؛ الكتابة فيه من دوال الخادم فقط،
-- فلا يستطيع مستخدم أن يصنع إشعارًا باسم غيره.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  entity_type text,
  entity_id uuid,
  project_id uuid references public.projects (id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'إشعارات المستخدم. تُكتب من دوال SECURITY DEFINER فقط — لا كتابة من الواجهة.';

create index if not exists notifications_user_idx
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists notifications_entity_idx
  on public.notifications (entity_type, entity_id);

-- ── من يُشعَر؟ أصحاب صلاحية بعينها ضمن المشروع ─────────────────────────
-- تُستدعى من داخل دوال المالك فقط، فلا تُمنح لأحد.
create or replace function public.users_to_notify(
  p_permission_key text,
  p_project_id uuid default null
)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct ur.user_id
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions perm on perm.id = rp.permission_id
  join public.profiles pr on pr.id = ur.user_id
  where perm.key = p_permission_key
    and pr.is_active
    and (
      p_project_id is null
      or exists (
        select 1 from public.project_assignments pa
        where pa.project_id = p_project_id and pa.user_id = ur.user_id
      )
    );
$$;

/**
 * Fan-out إشعار لعدّة مستخدمين. المُرسِل لا يُشعر نفسه.
 */
create or replace function public.notify_users(
  p_user_ids uuid[],
  p_kind text,
  p_title text,
  p_body text default '',
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_project_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  insert into public.notifications
    (user_id, kind, title, body, entity_type, entity_id, project_id)
  select distinct u, p_kind, p_title, p_body, p_entity_type, p_entity_id, p_project_id
  from unnest(coalesce(p_user_ids, '{}'::uuid[])) as u
  join public.profiles pr on pr.id = u and pr.is_active
  where u is distinct from auth.uid();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.users_to_notify(text, uuid) from public, anon, authenticated;
revoke execute on function public.notify_users(uuid[], text, text, text, text, uuid, uuid)
  from public, anon, authenticated;

-- ── تعليم الإشعار مقروءًا ──────────────────────────────────────────────
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  update public.notifications
     set is_read = true, read_at = now()
   where user_id = auth.uid()
     and not is_read
     and (p_ids is null or id = any (p_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ── RLS: كل مستخدم يرى إشعاراته وحده، ولا يكتب أحد يدويًا ──────────────
alter table public.notifications enable row level security;
revoke all on public.notifications from anon;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

-- لا سياسة insert ولا update ولا delete: القراءة فقط من الواجهة،
-- والكتابة عبر notify_users و mark_notifications_read (SECURITY DEFINER).
