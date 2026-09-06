-- ═══════════════════════════════════════════════════════════════════════
-- حذف تعريف مسار — بإصداره
--
-- الحذف هنا **لا رجعة فيه**: يذهب معه كل ما تحته من مراحل ومشاركين وأزرار
-- ووجهات وشروط جاهزية. فله حارسان:
--
-- ١) **معاملة واحدة تكفي للمنع.** التعريف ليس تعريفًا فحسب: نسخة المرحلة
--    تحمل لقطتها، لكن التوجيه والتاريخ يشيران إليه. ومعاملة بلا تعريفها
--    سجلٌّ يشير إلى عدم — وهو ما يمنعه `on delete restrict` أصلًا، لكنّ
--    رسالته لا تُفهَم، فنسبقه برسالة تقول العدد.
--
-- ٢) **الحارس المجمِّد.** المنشور لا تُحذف مراحله. فيُخفَّض هنا إلى مسودّة
--    داخل المعاملة نفسها قبل الحذف — لا لتجاوز الحارس، بل لأن ما يُحذف
--    كاملًا لم يعد منشورًا بحال.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.delete_workflow_definition(p_definition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_def public.workflow_definitions%rowtype;
  v_txns integer;
  v_stages integer;
begin
  if not public.has_permission('workflow.manage') then
    raise exception 'حذف المسارات يتطلّب صلاحية workflow.manage'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_def from public.workflow_definitions where id = p_definition_id;
  if not found then
    raise exception 'المسار غير موجود' using errcode = 'no_data_found';
  end if;

  select count(*) into v_txns
    from public.transactions where definition_id = p_definition_id;

  if v_txns > 0 then
    raise exception
      'لا يُحذف: % معاملة تسير على هذا الإصدار أو سارت عليه. عطّله بدل حذفه.',
      v_txns
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_stages
    from public.workflow_stages where definition_id = p_definition_id;

  update public.workflow_definitions
     set status = 'draft', is_active = false
   where id = p_definition_id and status <> 'draft';

  delete from public.workflow_stages where definition_id = p_definition_id;
  delete from public.workflow_definitions where id = p_definition_id;

  return jsonb_build_object(
    'deleted', true,
    'transaction_type', v_def.transaction_type,
    'version', v_def.version,
    'stages_removed', v_stages);
end;
$fn$;

comment on function public.delete_workflow_definition(uuid) is
  'حذف تعريف مسار وكل ما تحته — يُرفض إن سارت عليه معاملة واحدة.';

revoke execute on function public.delete_workflow_definition(uuid) from public, anon;
grant  execute on function public.delete_workflow_definition(uuid) to authenticated;
