-- ═══════════════════════════════════════════════════════════════════════
-- دوال المراقب والموعد
-- ═══════════════════════════════════════════════════════════════════════

-- ── ١) الحلّ يستثني المراقب ────────────────────────────────────────────
/**
 * المراقب لا يُحلّ إلى تكليف. ولو حُلَّ لظهرت المرحلة في وارده وطُولب
 * بإجراء، ولو كان تحت سياسة «الكل» لأوقف إغلاقها حتى يتصرّف — وهو لا
 * يتصرّف. رؤيته تأتي من `is_transaction_participant` لا من صفٍّ في
 * `transaction_assignments`.
 */
create or replace function public.resolve_stage_participants(
  p_stage_id uuid,
  p_transaction_id uuid
)
returns table (assignee_id uuid, participant_id uuid, is_optional boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with tx as (
    select t.requested_by, t.project_id,
           coalesce(t.audience_ids, '{}'::uuid[]) as audience_ids
    from public.transactions t
    where t.id = p_transaction_id
  ),
  matched as (
    select sp.id as participant_id, sp.is_optional, sp.sort_order, p.id as assignee_id
    from public.workflow_stage_participants sp
    left join tx on true
    join public.profiles p
      on p.is_active
     and (
       (sp.kind = 'user' and p.id = sp.user_id)
       or (sp.kind = 'requester' and p.id = tx.requested_by)
       or (sp.kind = 'audience' and p.id = any (tx.audience_ids))
       or (sp.kind = 'role' and exists (
             select 1 from public.user_roles ur
             where ur.user_id = p.id and ur.role_id = sp.role_id))
       or (sp.kind = 'project_role'
           and tx.project_id is not null
           and exists (
             select 1 from public.user_roles ur
             where ur.user_id = p.id and ur.role_id = sp.role_id)
           and exists (
             select 1 from public.project_assignments pa
             where pa.project_id = tx.project_id
               and pa.user_id = p.id
               and (sp.requires_sign = false or pa.can_sign)))
       or (sp.kind = 'department_role'
           and p.department_id = sp.department_id
           and exists (
             select 1 from public.user_roles ur
             where ur.user_id = p.id and ur.role_id = sp.role_id))
     )
    where sp.stage_id = p_stage_id
      and sp.is_observer = false
  )
  select distinct on (m.assignee_id) m.assignee_id, m.participant_id, m.is_optional
  from matched m
  order by m.assignee_id, m.is_optional, m.sort_order, m.participant_id;
$$;

revoke all on function public.resolve_stage_participants(uuid, uuid) from public, anon;
grant execute on function public.resolve_stage_participants(uuid, uuid) to authenticated;

-- ── ٢) رؤية المراقب ────────────────────────────────────────────────────
/**
 * المراقب على أيّ مرحلة يرى **المعاملة كلها** من أوّلها، لا مرحلته وحدها.
 * وهذا هو المقصود: «مدير عام يرى كل شيء» لا يُراد به أن يرى الخطوة السابعة
 * دون الأولى. ولذلك يُبحث عنه في مراحل التعريف كلّه.
 */
create or replace function public.is_transaction_observer(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.transactions t
    join public.workflow_stages s on s.definition_id = t.definition_id
    join public.workflow_stage_participants sp
      on sp.stage_id = s.id and sp.is_observer
    join public.profiles p on p.id = (select auth.uid()) and p.is_active
    where t.id = p_transaction_id
      and (
        (sp.kind = 'user' and sp.user_id = p.id)
        or (sp.kind = 'requester' and t.requested_by = p.id)
        or (sp.kind = 'audience' and p.id = any (coalesce(t.audience_ids, '{}'::uuid[])))
        or (sp.kind = 'role' and exists (
              select 1 from public.user_roles ur
              where ur.user_id = p.id and ur.role_id = sp.role_id))
        or (sp.kind = 'project_role'
            and t.project_id is not null
            and exists (
              select 1 from public.user_roles ur
              where ur.user_id = p.id and ur.role_id = sp.role_id)
            and exists (
              select 1 from public.project_assignments pa
              where pa.project_id = t.project_id and pa.user_id = p.id
                and (sp.requires_sign = false or pa.can_sign)))
        or (sp.kind = 'department_role'
            and p.department_id = sp.department_id
            and exists (
              select 1 from public.user_roles ur
              where ur.user_id = p.id and ur.role_id = sp.role_id))
      )
  );
$$;

revoke all on function public.is_transaction_observer(uuid) from public, anon;
grant execute on function public.is_transaction_observer(uuid) to authenticated;

create or replace function public.is_transaction_participant(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.transactions t
    where t.id = p_transaction_id and t.requested_by = (select auth.uid())
  ) or exists (
    select 1 from public.transaction_assignments a
    where a.transaction_id = p_transaction_id
      and a.assignee_id = (select auth.uid())
  ) or public.is_transaction_observer(p_transaction_id);
$$;

-- ── ٣) الموعد يُحسب عند فتح المرحلة ────────────────────────────────────
/**
 * الموعد يُثبَّت في نسخة المرحلة لحظة فتحها، ولا يُقرأ من التعريف بعدها.
 * فلو عدّلت الشركة الموعد غدًا، لا تنقلب مواعيد معاملاتٍ جارية تحت أصحابها.
 */
create or replace function public.stage_deadline_for(
  p_stage_id uuid,
  p_from timestamptz default now()
)
returns timestamptz
language sql
stable
set search_path = public, pg_temp
as $$
  select case
    when s.deadline_spec is null then null
    else public.compute_next_run('weekly', s.deadline_spec, p_from, false)
  end
  from public.workflow_stages s
  where s.id = p_stage_id;
$$;

revoke all on function public.stage_deadline_for(uuid, timestamptz) from public, anon;
grant execute on function public.stage_deadline_for(uuid, timestamptz) to authenticated;
