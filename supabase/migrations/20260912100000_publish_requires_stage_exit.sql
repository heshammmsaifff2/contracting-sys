-- ═══════════════════════════════════════════════════════════════════════
-- النشر يرفض مرحلةً بلا زرٍّ يحسم
--
-- ثغرةٌ ظهرت على القاعدة لا في المراجعة: مسارٌ من أربع مراحل نُشر وعليه
-- معاملة، وكلّ مراحله بلا مخرج — واحدةٌ زرُّها الوحيد من نوع «ملاحظة»
-- وثلاثٌ بلا أزرار. فوقفت المعاملة ولم يجد المكلَّف ما يضغطه.
--
-- والسبب تناقضٌ بين طبقتين: المحرّك يعرف `default_next_stage_id` مخرجًا
-- احتياطيًّا، والواجهة لا تعرض للمكلَّف شيئًا حين لا أزرار
-- (`ActionButtons` تُرجع نصًّا لا زرًّا). فالاحتياطيّ **لا يُبلَغ من الشاشة**،
-- وفحصُ النشر كان يسأل عن «زرّ بلا وجهة» ولا يسأل عن «مرحلة بلا زرّ».
--
-- والفحص هنا لا في الواجهة وحدها: الواجهة تُنبّه أثناء التأليف، والقاعدة
-- تمنع النشر — فلا يمرّ مسارٌ معطوب من باب خلفيّ.
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
  if not public.has_permission('workflow.manage') then
    raise exception 'نشر المسارات يتطلّب صلاحية workflow.manage'
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
    raise exception 'لا مرحلة بداية — المعاملة لا تعرف من أين تبدأ'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.workflow_stages
     where definition_id = p_definition_id and is_final
  ) then
    raise exception 'لا مرحلة نهاية — المسار لا يعرف أين ينتهي'
      using errcode = 'check_violation';
  end if;

  select s.name into v_bad
    from public.workflow_stages s
   where s.definition_id = p_definition_id
     and not exists (
       select 1 from public.workflow_stage_participants p
       where p.stage_id = s.id and not p.is_observer
     )
   limit 1;
  if v_bad is not null then
    raise exception
      'المرحلة «%» بلا مشاركين — تُفتَح ولا يُغلقها أحد، فتقف المعاملة فيها',
      v_bad
      using errcode = 'check_violation';
  end if;

  -- المرحلة النهائية ليست استثناءً: تُفتَح كغيرها، فتلزمها زرٌّ يُغلقها
  select s.name into v_bad
    from public.workflow_stages s
   where s.definition_id = p_definition_id
     and not exists (
       select 1 from public.workflow_actions a
       where a.stage_id = s.id and a.kind <> 'note'
     )
   limit 1;
  if v_bad is not null then
    raise exception
      'المرحلة «%» بلا زرٍّ يحسم — الملاحظة لا تحرّك المعاملة، فتقف فيها بلا مخرج',
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
