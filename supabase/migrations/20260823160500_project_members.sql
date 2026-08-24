-- ═══════════════════════════════════════════════════════════════════════
-- Phase 5 — أعضاء المشروع (لاختيار المندوب والمشرف)
-- سياسة profiles تخفي أسماء الموظفين عمّن لا يملك user.read، وهو صواب.
-- لكن مشرف الموقع يحتاج اختيار «مندوب» من فريق مشروعه دون أن يرى دفتر
-- الموظفين كله — فالحل دالة مالك تُعيد أعضاء المشاريع المعتمدة له فقط،
-- بالاسم والفئة، بلا أي حقل حسّاس آخر.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.project_members(p_project_id uuid default null)
returns table (
  user_id uuid,
  project_id uuid,
  full_name text,
  employee_type text,
  can_sign boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    pr.id,
    pa.project_id,
    pr.full_name,
    pr.employee_type,
    pa.can_sign
  from public.project_assignments pa
  join public.profiles pr on pr.id = pa.user_id
  where pr.is_active
    and (p_project_id is null or pa.project_id = p_project_id)
    -- لا يرى إلا أعضاء المشاريع التي يراها هو
    and (
      public.has_permission('project.read_all')
      or pa.project_id in (select public.current_project_ids())
    )
  order by pr.full_name;
$$;

comment on function public.project_members(uuid) is
  'أعضاء المشاريع المعتمدة للمستخدم — بالاسم والفئة فقط، لاختيار المندوب والمشرف.';

revoke execute on function public.project_members(uuid) from public, anon;
grant execute on function public.project_members(uuid) to authenticated;
