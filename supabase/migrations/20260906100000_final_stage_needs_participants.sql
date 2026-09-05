-- ═══════════════════════════════════════════════════════════════════════
-- تصحيح: المرحلة النهائية ليست استثناءً من «بلا مشاركين»
--
-- كان الحارس — في القاعدة وفي `WorkflowGraph` معًا — يعفي المرحلة النهائية
-- من اشتراط المشاركين، ظنًّا أنها لا تُعمَل. وهو ظنٌّ خاطئ: `complete_assignment`
-- **يفتحها** كغيرها عبر `open_stage_instance`، و`populate_stage_assignments`
-- بلا مؤهَّل تجعلها `pending` — فتقف المعاملة هناك ولا تُغلق أبدًا، ولا يقبل
-- الأرشيفُ إيداعَ أصلٍ لمعاملة لم تُغلق.
--
-- رُصد أثناء بذر مسار للتجربة: «اعتماد وإغلاق» فتح مرحلة الأرشفة ووقفت عندها.
-- والمرحلة التي لا تُدخَل أصلًا يرصدها فحص الوصول في الواجهة لا هذا الحارس.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.publish_workflow_version(p_definition_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_def public.workflow_definitions%rowtype;
  v_bad text;
begin
  if not public.has_permission('workflow.publish') then
    raise exception 'النشر يتطلّب صلاحية workflow.publish'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_def from public.workflow_definitions where id = p_definition_id;
  if not found then
    raise exception 'المسار غير موجود' using errcode = 'no_data_found';
  end if;

  if v_def.status <> 'draft' then
    raise exception 'لا يُنشَر إلا ما كان مسودّة' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.workflow_stages
     where definition_id = p_definition_id and is_start
  ) then
    raise exception 'لا مرحلة بداية — المعاملة لا تجد أين تبدأ'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.workflow_stages
     where definition_id = p_definition_id and is_final
  ) then
    raise exception 'لا مرحلة نهائية — المسار لا يعرف أين ينتهي'
      using errcode = 'check_violation';
  end if;

  -- بلا إعفاء للنهائية
  select s.name into v_bad
    from public.workflow_stages s
   where s.definition_id = p_definition_id
     and not exists (
       select 1 from public.workflow_stage_participants p where p.stage_id = s.id
     )
   limit 1;
  if v_bad is not null then
    raise exception
      'المرحلة «%» بلا مشاركين — تُفتَح ولا يُغلقها أحد، فتقف المعاملة فيها',
      v_bad
      using errcode = 'check_violation';
  end if;

  select a.label into v_bad
    from public.workflow_actions a
    join public.workflow_stages s on s.id = a.stage_id
   where s.definition_id = p_definition_id
     and a.kind not in ('note', 'final')
     and not exists (
       select 1 from public.workflow_action_routes r where r.action_id = a.id
     )
   limit 1;
  if v_bad is not null then
    raise exception 'الزرّ «%» بلا وجهة — يقف المسار عند ضغطه', v_bad
      using errcode = 'check_violation';
  end if;

  update public.workflow_definitions
     set status = 'retired', is_active = false, retired_at = now()
   where transaction_type = v_def.transaction_type
     and status = 'published';

  update public.workflow_definitions
     set status = 'published', is_active = true, published_at = now()
   where id = p_definition_id;
end;
$fn$;
