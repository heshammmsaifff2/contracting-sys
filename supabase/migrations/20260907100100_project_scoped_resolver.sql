-- ═══════════════════════════════════════════════════════════════════════
-- حلّ المشاركين مع وعي بالمشروع
--
-- الفرع الجديد `project_role` يقاطع حاملي الدور بالمسنَدين على مشروع
-- المعاملة. ومعاملةٌ بلا مشروع لا يتحقّق لها أحد — فتقف المرحلة `pending`
-- بانتظار تدخّل بشري، ولا تُغلق صامتة. وهذا **مقصود**: مرحلةٌ تسأل عن
-- «مهندس هذا المشروع» لا جواب لها حين لا مشروع، والسكوت عنها بإرسالها
-- لكل مهندسي الشركة يُعيد الثغرة نفسها من باب خلفيّ.
-- ═══════════════════════════════════════════════════════════════════════

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
       -- صاحب الوظيفة **في مشروع هذه المعاملة** وحده
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
  )
  -- الموظف الواحد لا يُكلَّف مرتين على المرحلة نفسها؛ والإلزامي يغلب الاختياري
  select distinct on (m.assignee_id) m.assignee_id, m.participant_id, m.is_optional
  from matched m
  order by m.assignee_id, m.is_optional, m.sort_order, m.participant_id;
$$;

comment on function public.resolve_stage_participants(uuid, uuid) is
  'يحلّ مشاركي المرحلة إلى موظفين فعليين؛ project_role يقصرهم على مشروع المعاملة.';

revoke all on function public.resolve_stage_participants(uuid, uuid) from public, anon;
grant execute on function public.resolve_stage_participants(uuid, uuid) to authenticated;
