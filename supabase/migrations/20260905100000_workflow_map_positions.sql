-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٦ — مواضع العُقَد في محرّر المسار المرئي
--
-- العمودان `pos_x` / `pos_y` هُيِّئا في المرحلة ٠١ ولم يُكتب فيهما شيء.
-- هنا تُفتح الكتابة — دفعةً واحدة لا صفًّا صفًّا: سحب عشرين مرحلة يعني
-- عشرين رسالة PATCH، وكلٌّ منها يمرّ بـ RLS ويوقظ مُشغّل `updated_at`.
--
-- ولماذا دالّة أصلًا وسياسة `workflow_stages_write` تسمح بالتحديث المباشر؟
-- لأن التحديث المباشر يفتح **كل** الأعمدة: من يملك تحريك عقدة يملك تغيير
-- `is_final` و`sla_minutes` في الرسالة نفسها. الدالّة تكتب عمودَي الموضع
-- ولا غيرهما.
-- ═══════════════════════════════════════════════════════════════════════

/**
 * حفظ مواضع عُقَد مسار واحد. تُرجع عدد الصفوف التي تحرّكت فعلًا.
 * المواضع: [{"id": uuid, "x": numeric, "y": numeric}, …]
 */
create or replace function public.set_stage_positions(
  p_definition_id uuid,
  p_positions jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  if not public.has_permission('workflow.manage') then
    raise exception 'لا صلاحية لتحرير مسارات سير العمل'
      using errcode = 'insufficient_privilege';
  end if;

  if p_definition_id is null then
    raise exception 'المسار مطلوب' using errcode = 'null_value_not_allowed';
  end if;

  if jsonb_typeof(p_positions) is distinct from 'array' then
    raise exception 'المواضع تُمرَّر مصفوفةً' using errcode = 'invalid_parameter_value';
  end if;

  -- حارس ضدّ رسالة عملاقة تُقفل الجدول: لا مسار عمليّ فيه مئتا مرحلة
  if jsonb_array_length(p_positions) > 200 then
    raise exception 'عدد المواضع يتجاوز الحدّ المسموح (٢٠٠)'
      using errcode = 'program_limit_exceeded';
  end if;

  with incoming as (
    select
      (elem ->> 'id')::uuid as id,
      -- التقييد قبل التقريب: إحداثيّ شارد لا يدفع بقيّة الرسم خارج اللوحة
      round(least(greatest((elem ->> 'x')::numeric, -100000), 100000), 2) as x,
      round(least(greatest((elem ->> 'y')::numeric, -100000), 100000), 2) as y
    from jsonb_array_elements(p_positions) as elem
  )
  update public.workflow_stages s
     set pos_x = i.x,
         pos_y = i.y
    from incoming i
   where s.id = i.id
     -- الانتماء شرط: لا تُحرَّك عقدة مسار آخر برسالة موجَّهة لهذا المسار
     and s.definition_id = p_definition_id
     and (s.pos_x, s.pos_y) is distinct from (i.x, i.y);

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

comment on function public.set_stage_positions(uuid, jsonb) is
  'حفظ مواضع عُقَد محرّر المسار دفعةً واحدة — عمودا الموضع وحدهما.';

revoke execute on function public.set_stage_positions(uuid, jsonb) from public, anon;
grant  execute on function public.set_stage_positions(uuid, jsonb) to authenticated;
