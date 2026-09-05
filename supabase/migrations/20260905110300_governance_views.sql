-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٧ — عروض الحوكمة
--
-- عرضان قائمان يتّسعان: الأزرار تحمل **ما ينقصها** من شروط الجاهزية،
-- وصندوق الوارد يحمل حالة الحجز.
-- ═══════════════════════════════════════════════════════════════════════

/**
 * أزرار المرحلة، ومعها ما ينقص كل زرّ.
 *
 * تُحسَب هنا لا في الواجهة: الشرط يُقاس على لقطة المعاملة بلغة مغلقة لها
 * مفسّر واحد في القاعدة. تنزيل اللقطة والشروط إلى المتصفّح ليُعاد تفسيرها
 * هناك يعني مفسّرًا ثانيًا يتباعد عن الأول. والواجهة تعطّل الزرّ قبل الضغط
 * بدل أن تدع الموظف يصطدم برسالة الخادم.
 */
create or replace view public.assignment_available_actions
with (security_invoker = true) as
select
  a.id                as assignment_id,
  a.transaction_id,
  a.stage_instance_id,
  a.assignee_id,
  act.id              as action_id,
  act.action_key,
  act.label,
  act.kind,
  act.sort_order,
  act.requires_note,
  act.requires_attachment,
  act.requires_evaluation,
  act.return_minutes,
  (select count(*) from public.workflow_action_routes r where r.action_id = act.id)
                      as routes_count,
  (select count(*) from public.transaction_attachments att
    where att.assignment_id = a.id)
                      as attachment_count,
  coalesce(
    (select array_agg(u.message order by u.message)
       from public.unmet_stage_requirements(a.id, act.kind) u),
    '{}'::text[]
  )                   as unmet_requirements
from public.transaction_assignments a
join public.transaction_stage_instances si on si.id = a.stage_instance_id
join public.workflow_actions act on act.stage_id = si.stage_id
where a.status = 'in_progress';

comment on view public.assignment_available_actions is
  'أزرار المرحلة كما تظهر للمكلَّف: ما أرفقه، وما ينقص من شروط الجاهزية.';

revoke all on public.assignment_available_actions from anon;
grant select on public.assignment_available_actions to authenticated;

/**
 * عمودا الحجز في صندوق الوارد.
 *
 * يُضافان في **ذيل** قائمة الأعمدة لا وسطها: `create or replace view` لا
 * تقبل تغيير ترتيب ما هو قائم. والتعريف يُقرأ من القاعدة ويُلصَق فيه العمودان
 * بدل إعادة كتابة عرضٍ من ثلاثة آلاف حرف بيدٍ تُخطئ سطرًا فتغيّر عدّادًا.
 */
do $$
declare
  v_def text := pg_get_viewdef('public.transaction_inbox'::regclass, true);
  v_anchor text := E'    a.extended_minutes\n   FROM transaction_assignments a';
  v_new text;
begin
  if position('claim_policy' in v_def) > 0 then
    return;
  end if;

  if position(v_anchor in v_def) = 0 then
    raise exception 'تعذّر تحديد ذيل قائمة أعمدة transaction_inbox';
  end if;

  v_new := replace(
    v_def,
    v_anchor,
    E'    a.extended_minutes,\n'
    || E'    a.claimed_at,\n'
    || E'    si.claim_policy\n'
    || E'   FROM transaction_assignments a'
  );

  execute 'create or replace view public.transaction_inbox '
       || 'with (security_invoker = true) as ' || v_new;
end $$;

comment on view public.transaction_inbox is
  'صندوق الوارد: صفّ لكل تكليف. عدّاد داخل الدوام وألوان الحالة [المراسلات 25]، '
  'وحالة الحجز حين تكون سياسة المرحلة حصريّة [المرحلة ٠٧].';
