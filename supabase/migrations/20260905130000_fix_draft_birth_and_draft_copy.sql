-- ═══════════════════════════════════════════════════════════════════════
-- إصلاح عطبَين أدخلتهما المرحلة ٠٧
--
-- ظهرا عند أول استعمال حقيقيّ للشاشة، لا في الاختبار: كل تجاربي كانت تبدأ
-- من تعريف **قائم** أُنشئ قبل المرحلة ٠٧، فلم يمرّ أحدها بولادة مسار جديد.
-- ═══════════════════════════════════════════════════════════════════════

-- ── العطب الأول: المسار يُولَد مجمَّدًا ─────────────────────────────────
/**
 * `status` كان افتراضه `published` لأن الصفوف القائمة وقت الهجرة كانت
 * منشورةً فعلًا. لكنّ الافتراض يسري على **الجديد** أيضًا، وحارس التجميد يمنع
 * تعديل المنشور — فكان كل مسار يُنشأ يُولَد مجمَّدًا ولا تُضاف إليه مرحلة
 * واحدة: «أضِف مرحلة» تُردّ بـ «الإصدار المنشور لا يُعدَّل».
 *
 * الافتراض الصحيح: يُبنى مسودّةً، ثم يُنشر فيصير حيًّا.
 */
alter table public.workflow_definitions alter column status set default 'draft';

/**
 * جذر السلالة، وتطبيع «نشط».
 *
 * `is_active` لا معنى له على غير المنشور، والقيد `active_only_published`
 * يرفض الجمع بينهما. فبدل أن تُردّ الواجهة بخطأ حين تُرسل مسودّةً «مفعّلة»،
 * تُطبَّع هنا: النشاط صفةُ المنشور وحده، يمنحها النشر ويسحبها التقاعد.
 */
create or replace function public.set_definition_lineage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.lineage_id is null then
    new.lineage_id := new.id;
  end if;

  if new.status is distinct from 'published' then
    new.is_active := false;
  end if;

  return new;
end;
$fn$;

drop trigger if exists workflow_definitions_set_lineage on public.workflow_definitions;
create trigger workflow_definitions_set_lineage
  before insert or update on public.workflow_definitions
  for each row execute function public.set_definition_lineage();

revoke execute on function public.set_definition_lineage() from public, anon, authenticated;

comment on column public.workflow_definitions.status is
  'draft = يُبنى ويُحرَّر (وهو مولد كل مسار جديد) · published = تسير عليه '
  'المعاملات الجديدة · retired = يُقرأ ولا يُبدأ، ومعاملاته تكمل عليه';

-- إصلاح ما وُلد مجمَّدًا بالخطأ: بلا مراحل وبلا معاملات، فإعادته مسودّةً آمنة
update public.workflow_definitions d
   set status = 'draft', is_active = false, published_at = null
 where d.status = 'published'
   and not exists (select 1 from public.workflow_stages s where s.definition_id = d.id)
   and not exists (select 1 from public.transactions t where t.definition_id = d.id);

-- ── العطب الثاني: النسخ يفشل عبر PostgREST ─────────────────────────────
/**
 * نسخة مسودّة من إصدار قائم — **بلا جداول مؤقّتة**.
 *
 * كانت النسخة الأولى تبني جدولَي ترجمة مؤقّتين (`_stage_map` / `_action_map`)
 * لربط المعرّف القديم بالجديد. تعمل من SQL وتفشل عبر PostgREST بـ 400.
 *
 * ولا حاجة إليها أصلًا: `stage_key` فريد داخل التعريف، و`action_key` فريد
 * داخل المرحلة — فالترجمة **ضمٌّ على المفتاح الطبيعي** لا جدول جانبيّ. وهذا
 * أبسط، ولا يعتمد على سلوك حالةٍ مؤقّتة فوق اتصال مُجمَّع.
 */
create or replace function public.create_workflow_draft(p_definition_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_src public.workflow_definitions%rowtype;
  v_new uuid;
  v_version smallint;
begin
  if not public.has_permission('workflow.manage') then
    raise exception 'يتطلّب صلاحية workflow.manage'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_src from public.workflow_definitions where id = p_definition_id;
  if not found then
    raise exception 'المسار غير موجود' using errcode = 'no_data_found';
  end if;

  if exists (
    select 1 from public.workflow_definitions
     where lineage_id = v_src.lineage_id and status = 'draft'
  ) then
    raise exception 'لهذا المسار مسودّة مفتوحة — أكملها أو احذفها'
      using errcode = 'unique_violation';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
    from public.workflow_definitions
   where transaction_type = v_src.transaction_type;

  insert into public.workflow_definitions
    (transaction_type, name, is_active, version, status, lineage_id)
  values
    (v_src.transaction_type, v_src.name, false, v_version, 'draft', v_src.lineage_id)
  returning id into v_new;

  -- ١) المراحل بمعرّفات جديدة، ومفاتيحها هي جسر الترجمة
  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, completion_policy, quorum_count,
     is_start, is_final, is_archive, is_program_manager, requires_receive,
     sla_minutes, join_policy, conflict_policy, claim_policy, pos_x, pos_y)
  select v_new, s.stage_key, s.name, s.sort_order, s.completion_policy,
         s.quorum_count, s.is_start, s.is_final, s.is_archive,
         s.is_program_manager, s.requires_receive, s.sla_minutes,
         s.join_policy, s.conflict_policy, s.claim_policy, s.pos_x, s.pos_y
  from public.workflow_stages s
  where s.definition_id = p_definition_id;

  -- ٢) «المرحلة التالية» تُترجَم إلى نظيرتها في المسودّة
  update public.workflow_stages ns
     set default_next_stage_id = nt.id
    from public.workflow_stages os
    join public.workflow_stages ot on ot.id = os.default_next_stage_id
    join public.workflow_stages nt
      on nt.definition_id = v_new and nt.stage_key = ot.stage_key
   where ns.definition_id = v_new
     and os.definition_id = p_definition_id
     and os.stage_key = ns.stage_key;

  -- ٣) المشاركون
  insert into public.workflow_stage_participants
    (stage_id, kind, user_id, role_id, department_id, is_optional, sort_order)
  select ns.id, p.kind, p.user_id, p.role_id, p.department_id,
         p.is_optional, p.sort_order
  from public.workflow_stage_participants p
  join public.workflow_stages os
    on os.id = p.stage_id and os.definition_id = p_definition_id
  join public.workflow_stages ns
    on ns.definition_id = v_new and ns.stage_key = os.stage_key;

  -- ٤) شروط الجاهزية
  insert into public.workflow_stage_requirements
    (stage_id, kind, condition, min_attachments, message, applies_to, sort_order)
  select ns.id, r.kind, r.condition, r.min_attachments, r.message,
         r.applies_to, r.sort_order
  from public.workflow_stage_requirements r
  join public.workflow_stages os
    on os.id = r.stage_id and os.definition_id = p_definition_id
  join public.workflow_stages ns
    on ns.definition_id = v_new and ns.stage_key = os.stage_key;

  -- ٥) الأزرار
  insert into public.workflow_actions
    (stage_id, action_key, label, kind, sort_order, requires_note,
     requires_attachment, requires_evaluation, return_minutes)
  select ns.id, a.action_key, a.label, a.kind, a.sort_order, a.requires_note,
         a.requires_attachment, a.requires_evaluation, a.return_minutes
  from public.workflow_actions a
  join public.workflow_stages os
    on os.id = a.stage_id and os.definition_id = p_definition_id
  join public.workflow_stages ns
    on ns.definition_id = v_new and ns.stage_key = os.stage_key;

  -- ٦) الوجهات: الزرّ الجديد بمفتاحه، والمرحلة الوجهة بمفتاحها
  insert into public.workflow_action_routes
    (action_id, priority, condition, target_stage_id)
  select na.id, r.priority, r.condition, nt.id
  from public.workflow_action_routes r
  join public.workflow_actions oa on oa.id = r.action_id
  join public.workflow_stages os
    on os.id = oa.stage_id and os.definition_id = p_definition_id
  join public.workflow_stages ns
    on ns.definition_id = v_new and ns.stage_key = os.stage_key
  join public.workflow_actions na
    on na.stage_id = ns.id and na.action_key = oa.action_key
  join public.workflow_stages ot on ot.id = r.target_stage_id
  join public.workflow_stages nt
    on nt.definition_id = v_new and nt.stage_key = ot.stage_key;

  return v_new;
end;
$fn$;
