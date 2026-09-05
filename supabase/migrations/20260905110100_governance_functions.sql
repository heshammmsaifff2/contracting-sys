-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٧ — دوالّ الحوكمة
--
-- أربع مجموعات: الجاهزية · الحجز · الإصدارات · الأرشفة على مرحلتين.
-- وكلّها تمرّ بـ SECURITY DEFINER كبقيّة المحرّك — لا كتابة مباشرة.
-- ═══════════════════════════════════════════════════════════════════════

-- ── ١) الجاهزية ────────────────────────────────────────────────────────
/**
 * ما لم يتحقّق من شروط جاهزية المرحلة.
 *
 * تُرجع الصفوف **غير المتحقّقة** وحدها: من يسأل «هل أتقدّم؟» لا يريد قائمة
 * بما نجح، يريد ما ينقصه. وترتيبها ترتيب التعريف فتُقرأ الرسالة الأولى
 * على أنها الخطوة التالية.
 */
create or replace function public.unmet_stage_requirements(
  p_assignment_id uuid,
  p_action_kind text default 'forward'
)
returns table (requirement_id uuid, kind text, message text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_a public.transaction_assignments%rowtype;
  v_si public.transaction_stage_instances%rowtype;
  v_context jsonb;
begin
  select * into v_a from public.transaction_assignments where id = p_assignment_id;
  if not found then
    return;
  end if;

  select * into v_si from public.transaction_stage_instances
   where id = v_a.stage_instance_id;
  if v_si.stage_id is null then
    return;
  end if;

  v_context := public.build_transaction_context(v_a.transaction_id);

  return query
  select r.id, r.kind, r.message
  from public.workflow_stage_requirements r
  where r.stage_id = v_si.stage_id
    -- الإرجاع لا يُقاس بالجاهزية: النقص سببُ الردّ لا مانعُه
    and (r.applies_to = 'any_action' or p_action_kind <> 'backward')
    and not case r.kind
      when 'condition' then
        public.eval_workflow_condition(r.condition, v_context)
      when 'attachment' then
        (select count(*) from public.transaction_attachments att
          where att.transaction_id = v_a.transaction_id) >= r.min_attachments
      else true
    end
  order by r.sort_order, r.created_at;
end;
$fn$;

comment on function public.unmet_stage_requirements(uuid, text) is
  'شروط الجاهزية التي لم تتحقّق — تقرؤها الواجهة لتعطّل الزرّ قبل الضغط.';

-- ── ٢) حسم التكليف ─────────────────────────────────────────────────────
/**
 * حجز المرحلة على النفس.
 *
 * تحت `exclusive` يخرج التكليف من صناديق بقيّة المؤهَّلين إلى `on_hold` —
 * لا `cancelled`: الملغى لا يعود، والمعلَّق ينتظر إطلاق الحجز.
 */
create or replace function public.claim_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_a public.transaction_assignments%rowtype;
  v_si public.transaction_stage_instances%rowtype;
  v_holder text;
begin
  select * into v_a from public.transaction_assignments where id = p_assignment_id;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  if v_a.assignee_id is distinct from auth.uid() then
    raise exception 'الحجز من المكلَّف وحده' using errcode = 'insufficient_privilege';
  end if;

  if v_a.status not in ('in_progress', 'on_hold') then
    raise exception 'هذا التكليف ليس قابلًا للحجز' using errcode = 'check_violation';
  end if;

  select * into v_si from public.transaction_stage_instances
   where id = v_a.stage_instance_id for update;

  if v_si.claim_policy <> 'exclusive' then
    -- بلا سياسة حجز يبقى الفعل إقرار استلام لا أكثر
    update public.transaction_assignments
       set received_at = coalesce(received_at, now())
     where id = p_assignment_id;
    return;
  end if;

  select p.full_name into v_holder
    from public.transaction_assignments ta
    join public.profiles p on p.id = ta.assignee_id
   where ta.stage_instance_id = v_si.id
     and ta.id <> p_assignment_id
     and ta.claimed_at is not null
     and ta.status in ('in_progress', 'done')
   limit 1;

  if v_holder is not null then
    raise exception 'المعاملة محجوزة لدى % — اطلب إطلاقها', v_holder
      using errcode = 'check_violation';
  end if;

  update public.transaction_assignments
     set claimed_at = now(),
         received_at = coalesce(received_at, now()),
         status = 'in_progress'
   where id = p_assignment_id;

  update public.transaction_assignments
     set status = 'on_hold'
   where stage_instance_id = v_si.id
     and id <> p_assignment_id
     and status in ('pending', 'in_progress');

  insert into public.transaction_action_log
    (transaction_id, stage_instance_id, assignment_id, action_key, action_label,
     kind, notes, acted_by)
  values
    (v_a.transaction_id, v_si.id, p_assignment_id, 'claim', 'حجز المعاملة',
     'note', '', auth.uid());
end;
$fn$;

/**
 * إطلاق الحجز فتعود إلى صناديق المؤهَّلين.
 *
 * يملكه صاحبه، ويملكه صاحب `transaction.transfer` — فمن حجز ثم غاب لا
 * يُجمّد المرحلة إلى أن يعود.
 */
create or replace function public.release_assignment_claim(
  p_assignment_id uuid,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_a public.transaction_assignments%rowtype;
  v_si public.transaction_stage_instances%rowtype;
begin
  select * into v_a from public.transaction_assignments where id = p_assignment_id;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  if v_a.claimed_at is null then
    raise exception 'لا حجز على هذا التكليف' using errcode = 'check_violation';
  end if;

  if v_a.assignee_id is distinct from auth.uid()
     and not public.has_workflow_permission('transaction.transfer') then
    raise exception 'إطلاق حجز غيرك يتطلّب صلاحية transaction.transfer'
      using errcode = 'insufficient_privilege';
  end if;

  if v_a.status = 'done' then
    raise exception 'التكليف أُنجز، ولا حجز يُطلَق بعد الإنجاز'
      using errcode = 'check_violation';
  end if;

  select * into v_si from public.transaction_stage_instances
   where id = v_a.stage_instance_id for update;

  update public.transaction_assignments
     set claimed_at = null
   where id = p_assignment_id;

  update public.transaction_assignments
     set status = 'in_progress'
   where stage_instance_id = v_si.id and status = 'on_hold';

  insert into public.transaction_action_log
    (transaction_id, stage_instance_id, assignment_id, action_key, action_label,
     kind, notes, acted_by)
  values
    (v_a.transaction_id, v_si.id, p_assignment_id, 'release', 'إطلاق الحجز',
     'note', coalesce(p_reason, ''), auth.uid());
end;
$fn$;

-- ── لقطة سياسة الحجز على نسخة المرحلة ──────────────────────────────────
-- `open_stage_instance` تُعاد كما هي عدا عمودًا واحدًا: النسخة تحمل لقطة
-- التعريف، وسياسة الحجز جزء منها.
create or replace function public.open_stage_instance(
  p_transaction_id uuid,
  p_stage_id uuid,
  p_minutes_override integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_stage public.workflow_stages%rowtype;
  v_seq integer;
  v_used integer;
  v_max integer;
  v_defer boolean;
  v_existing uuid;
  v_instance_id uuid;
begin
  select * into v_stage from public.workflow_stages where id = p_stage_id;
  if not found then
    raise exception 'المرحلة غير معرَّفة في المسار' using errcode = 'no_data_found';
  end if;

  if not exists (select 1 from public.transactions where id = p_transaction_id) then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;

  if v_stage.join_policy = 'wait_all' then
    select id into v_existing
      from public.transaction_stage_instances
     where transaction_id = p_transaction_id
       and stage_id = p_stage_id
       and status = 'pending'
       and is_deferred_join
     order by seq
     limit 1;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  select coalesce(max(seq), 0), count(*) into v_seq, v_used
    from public.transaction_stage_instances
   where transaction_id = p_transaction_id;

  select (value #>> '{}')::integer into v_max
    from public.settings where key = 'workflow_max_transitions';

  if v_used >= coalesce(v_max, 50) then
    raise exception
      'المعاملة تجاوزت الحد الأقصى للانتقالات (%) — راجع تفريع المسار',
      coalesce(v_max, 50)
      using errcode = 'program_limit_exceeded';
  end if;

  v_defer := v_stage.join_policy = 'wait_all'
    and exists (
      select 1 from public.transaction_stage_instances
      where transaction_id = p_transaction_id and status = 'in_progress'
    );

  insert into public.transaction_stage_instances
    (transaction_id, stage_id, stage_key, name, seq,
     completion_policy, quorum_count, join_policy, conflict_policy, claim_policy,
     status, is_deferred_join, is_final, is_archive, requires_receive)
  values
    (p_transaction_id, p_stage_id, v_stage.stage_key, v_stage.name, v_seq + 1,
     v_stage.completion_policy, v_stage.quorum_count,
     v_stage.join_policy, v_stage.conflict_policy, v_stage.claim_policy,
     case when v_defer then 'pending' else 'in_progress' end, v_defer,
     v_stage.is_final, v_stage.is_archive, v_stage.requires_receive)
  returning id into v_instance_id;

  if not v_defer then
    perform public.populate_stage_assignments(v_instance_id, p_minutes_override);
  end if;

  return v_instance_id;
end;
$fn$;

-- ── إنجاز التكليف: يضاف إليه حارسا الجاهزية والحجز ──────────────────────
create or replace function public.complete_assignment(
  p_assignment_id uuid,
  p_action_key text default null,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_a  public.transaction_assignments%rowtype;
  v_si public.transaction_stage_instances%rowtype;
  v_tx public.transactions%rowtype;
  v_action public.workflow_actions%rowtype;
  v_decider public.workflow_actions%rowtype;
  v_has_actions boolean;
  v_unmet text;
  v_actual integer;
  v_done_any integer;
  v_done_required integer;
  v_required integer;
  v_close boolean;
  v_target uuid;
  v_last_opened uuid;
  v_log_id uuid;
begin
  select * into v_a from public.transaction_assignments where id = p_assignment_id;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  select * into v_tx from public.transactions
   where id = v_a.transaction_id for update;

  select * into v_a from public.transaction_assignments where id = p_assignment_id;

  if v_a.status = 'on_hold' then
    raise exception 'المعاملة محجوزة لدى زميل — لا تُنجَز من هنا'
      using errcode = 'check_violation';
  end if;

  if v_a.status <> 'in_progress' then
    raise exception 'هذا التكليف ليس قيد التنفيذ' using errcode = 'check_violation';
  end if;

  if v_a.assignee_id is distinct from auth.uid()
     and not public.has_permission('transaction.override') then
    raise exception 'لست المكلَّف بهذه المرحلة'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_si from public.transaction_stage_instances
   where id = v_a.stage_instance_id;

  v_has_actions := exists (
    select 1 from public.workflow_actions where stage_id = v_si.stage_id
  );

  if v_has_actions then
    if coalesce(btrim(p_action_key), '') = '' then
      raise exception 'اختر إجراءً من إجراءات هذه المرحلة'
        using errcode = 'check_violation';
    end if;
    select * into v_action from public.workflow_actions
     where stage_id = v_si.stage_id and action_key = p_action_key;
    if not found then
      raise exception 'إجراء غير معروف لهذه المرحلة: %', p_action_key
        using errcode = 'no_data_found';
    end if;
    if v_action.requires_note and coalesce(btrim(p_notes), '') = '' then
      raise exception 'هذا الإجراء يتطلّب كتابة ملاحظة'
        using errcode = 'check_violation';
    end if;
    if v_action.requires_attachment and not exists (
      select 1 from public.transaction_attachments att
      where att.assignment_id = p_assignment_id
    ) then
      raise exception 'هذا الإجراء يتطلّب إرفاق مستند'
        using errcode = 'check_violation';
    end if;
  end if;

  -- الملاحظة لا تحرّك المرحلة، فلا تُقاس بالجاهزية ولا تلزمها مدّة
  if v_action.id is not null and v_action.kind = 'note' then
    insert into public.transaction_action_log
      (transaction_id, stage_instance_id, assignment_id, action_id,
       action_key, action_label, kind, notes, acted_by)
    values
      (v_tx.id, v_si.id, v_a.id, v_action.id,
       v_action.action_key, v_action.label, 'note', coalesce(p_notes, ''), auth.uid())
    returning id into v_log_id;

    update public.transaction_attachments
       set action_log_id = v_log_id
     where assignment_id = p_assignment_id and action_log_id is null;

    return null;
  end if;

  -- ── حارس الجاهزية [المرحلة ٠٧] ────────────────────────────────────────
  -- أول شرط غير متحقّق يوقف التقدّم برسالته هو — لا برسالة عامّة تُرجع
  -- الموظف إلى المدير ليسأل عمّا ينقص.
  select message into v_unmet
    from public.unmet_stage_requirements(
      p_assignment_id, coalesce(v_action.kind, 'forward'))
   limit 1;
  if v_unmet is not null then
    raise exception '%', v_unmet using errcode = 'check_violation';
  end if;

  if v_a.allocated_minutes is null then
    raise exception 'لم تُحدَّد مدة هذا التكليف بعد — يمرّ على مدير البرنامج أولًا'
      using errcode = 'check_violation';
  end if;

  -- الحجز الحصريّ إعلانٌ لازم: بغيره يعمل عشرة العمل نفسه
  if v_si.claim_policy = 'exclusive' and v_a.claimed_at is null then
    raise exception 'احجز المعاملة قبل إنجازها' using errcode = 'check_violation';
  end if;

  if v_si.requires_receive and v_a.received_at is null then
    raise exception 'يجب استلام المعاملة قبل إنجازها'
      using errcode = 'check_violation';
  end if;

  v_actual := public.business_minutes_between(v_a.arrived_at, now(), v_a.assignee_id);

  update public.transaction_assignments
     set status = 'done',
         completed_at = now(),
         notes = coalesce(p_notes, ''),
         acted_action_id = v_action.id,
         score = public.score_for_completion(v_a.allocated_minutes, v_actual)
   where id = p_assignment_id;

  insert into public.transaction_action_log
    (transaction_id, stage_instance_id, assignment_id, action_id,
     action_key, action_label, kind, notes, acted_by)
  values
    (v_tx.id, v_si.id, v_a.id, v_action.id,
     coalesce(v_action.action_key, 'complete'),
     coalesce(v_action.label, ''), coalesce(v_action.kind, 'forward'),
     coalesce(p_notes, ''), auth.uid())
  returning id into v_log_id;

  update public.transaction_attachments
     set action_log_id = v_log_id
   where assignment_id = p_assignment_id and action_log_id is null;

  -- المعلَّق بالحجز ليس مطلوبًا منه شيء، فلا يُحسب في نصاب الإغلاق
  select
    count(*) filter (where status = 'done'),
    count(*) filter (where status = 'done' and not is_optional),
    count(*) filter (where status not in ('cancelled', 'on_hold') and not is_optional)
  into v_done_any, v_done_required, v_required
  from public.transaction_assignments
  where stage_instance_id = v_si.id;

  v_close := case v_si.completion_policy
    when 'any'    then v_done_any >= 1
    when 'quorum' then v_done_any >= coalesce(v_si.quorum_count, 1)
    else               v_done_required >= v_required
  end;

  if not v_close then
    return null;
  end if;

  if v_si.conflict_policy = 'backward_wins' then
    select a.* into v_decider
      from public.transaction_assignments ta
      join public.workflow_actions a on a.id = ta.acted_action_id
     where ta.stage_instance_id = v_si.id and ta.status = 'done'
       and a.kind = 'backward'
     order by ta.completed_at
     limit 1;
  end if;

  if v_decider.id is null then
    select a.* into v_decider
      from public.transaction_assignments ta
      join public.workflow_actions a on a.id = ta.acted_action_id
     where ta.stage_instance_id = v_si.id and ta.status = 'done'
     order by
       case when v_si.conflict_policy = 'first_wins' then ta.completed_at end asc,
       ta.completed_at desc
     limit 1;
  end if;

  update public.transaction_stage_instances
     set status = 'done', completed_at = now(), resolved_by_action_id = v_decider.id
   where id = v_si.id;

  update public.transaction_assignments
     set status = 'cancelled'
   where stage_instance_id = v_si.id
     and status in ('pending', 'in_progress', 'on_hold');

  if v_decider.id is not null then
    if v_decider.kind <> 'final' then
      for v_target in
        select * from public.resolve_action_routes(v_decider.id, v_tx.id)
      loop
        v_last_opened := public.open_stage_instance(
          v_tx.id, v_target, v_decider.return_minutes);
      end loop;
    end if;
  elsif not v_si.is_final and v_si.stage_id is not null then
    select ws.default_next_stage_id into v_target
      from public.workflow_stages ws where ws.id = v_si.stage_id;
    if v_target is not null then
      v_last_opened := public.open_stage_instance(v_tx.id, v_target, null);
    end if;
  end if;

  perform public.activate_ready_joins(v_tx.id);

  if exists (
    select 1 from public.transaction_stage_instances
    where transaction_id = v_tx.id and status in ('pending', 'in_progress')
  ) then
    return v_last_opened;
  end if;

  if v_decider.kind = 'final' or v_si.is_final then
    update public.transactions
       set status = 'completed', is_closed = true, closed_at = now()
     where id = v_tx.id;
  else
    update public.transactions
       set status = 'awaiting_confirmation'
     where id = v_tx.id;
  end if;

  return v_last_opened;
end;
$fn$;

-- ── ٣) الإصدارات ───────────────────────────────────────────────────────
/**
 * نسخة مسودّة من إصدار قائم.
 *
 * تُنسَخ المراحل ومشاركوها وأزرارها ووجهاتها وشروط جاهزيتها، وتُعاد كتابة
 * كل إشارة داخلية إلى المعرّفات الجديدة — وإلا لأشارت وجهات المسودّة إلى
 * مراحل الإصدار المنشور، فصار تعديل المسودّة تعديلًا للمنشور من الخلف.
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

  -- المسودّة لا تكون نشطة: القيد `active_only_published` يمنعه، وهو ما
  -- يُبقي كل استعلام قديم يرشّح بـ `is_active` وحده صحيحًا بلا تعديل.
  insert into public.workflow_definitions
    (transaction_type, name, is_active, version, status, lineage_id)
  values
    (v_src.transaction_type, v_src.name, false, v_version, 'draft',
     v_src.lineage_id)
  returning id into v_new;

  -- ١) المراحل بمعرّفات جديدة، مع جدول ترجمة قديم ← جديد
  create temporary table if not exists _stage_map
    (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _stage_map;

  with copied as (
    insert into public.workflow_stages
      (definition_id, stage_key, name, sort_order, completion_policy, quorum_count,
       is_start, is_final, is_archive, is_program_manager, requires_receive,
       sla_minutes, join_policy, conflict_policy, claim_policy, pos_x, pos_y)
    select v_new, s.stage_key, s.name, s.sort_order, s.completion_policy,
           s.quorum_count, s.is_start, s.is_final, s.is_archive,
           s.is_program_manager, s.requires_receive, s.sla_minutes,
           s.join_policy, s.conflict_policy, s.claim_policy, s.pos_x, s.pos_y
    from public.workflow_stages s
    where s.definition_id = p_definition_id
    returning id, stage_key
  )
  insert into _stage_map (old_id, new_id)
  select old.id, copied.id
  from copied
  join public.workflow_stages old
    on old.definition_id = p_definition_id and old.stage_key = copied.stage_key;

  -- ٢) «المرحلة التالية» تُترجَم إلى نظيرتها في المسودّة
  update public.workflow_stages ns
     set default_next_stage_id = m2.new_id
    from _stage_map m1
    join public.workflow_stages os on os.id = m1.old_id
    join _stage_map m2 on m2.old_id = os.default_next_stage_id
   where ns.id = m1.new_id;

  -- ٣) المشاركون
  insert into public.workflow_stage_participants
    (stage_id, kind, user_id, role_id, department_id, is_optional, sort_order)
  select m.new_id, p.kind, p.user_id, p.role_id, p.department_id,
         p.is_optional, p.sort_order
  from public.workflow_stage_participants p
  join _stage_map m on m.old_id = p.stage_id;

  -- ٤) شروط الجاهزية
  insert into public.workflow_stage_requirements
    (stage_id, kind, condition, min_attachments, message, applies_to, sort_order)
  select m.new_id, r.kind, r.condition, r.min_attachments, r.message,
         r.applies_to, r.sort_order
  from public.workflow_stage_requirements r
  join _stage_map m on m.old_id = r.stage_id;

  -- ٥) الأزرار، ثم وجهاتها بترجمة المرحلة الوجهة
  create temporary table if not exists _action_map
    (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _action_map;

  with copied as (
    insert into public.workflow_actions
      (stage_id, action_key, label, kind, sort_order, requires_note,
       requires_attachment, requires_evaluation, return_minutes)
    select m.new_id, a.action_key, a.label, a.kind, a.sort_order, a.requires_note,
           a.requires_attachment, a.requires_evaluation, a.return_minutes
    from public.workflow_actions a
    join _stage_map m on m.old_id = a.stage_id
    returning id, stage_id, action_key
  )
  insert into _action_map (old_id, new_id)
  select old.id, copied.id
  from copied
  join _stage_map m on m.new_id = copied.stage_id
  join public.workflow_actions old
    on old.stage_id = m.old_id and old.action_key = copied.action_key;

  insert into public.workflow_action_routes
    (action_id, priority, condition, target_stage_id)
  select am.new_id, r.priority, r.condition, sm.new_id
  from public.workflow_action_routes r
  join _action_map am on am.old_id = r.action_id
  join _stage_map sm on sm.old_id = r.target_stage_id;

  return v_new;
end;
$fn$;

/**
 * نشر مسودّة: تُصبح هي المسار الحيّ، ويتقاعد سابقها.
 *
 * وهنا **وحدها** يفحص الخادم الرسم: ثوابت لا تُتجاوَز، لا التحليل الكامل
 * (الوصول والحلقات) — ذاك مساعدة تأليف في الواجهة. النشر يغيّر ما تفعله
 * المعاملات القادمة، فلا يُترك لثقةٍ في متصفّح.
 */
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

  select s.name into v_bad
    from public.workflow_stages s
   where s.definition_id = p_definition_id
     and not s.is_final
     and not exists (
       select 1 from public.workflow_stage_participants p where p.stage_id = s.id
     )
   limit 1;
  if v_bad is not null then
    raise exception 'المرحلة «%» بلا مشاركين — المعاملة تقف بلا صاحب', v_bad
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

  -- التقاعد قبل النشر: الفهرس الفريد يمنع منشورَين لنوع واحد
  update public.workflow_definitions
     set status = 'retired', is_active = false, retired_at = now()
   where transaction_type = v_def.transaction_type
     and status = 'published';

  update public.workflow_definitions
     set status = 'published', is_active = true, published_at = now()
   where id = p_definition_id;
end;
$fn$;

/**
 * حارس المنشور: الإصدار المنشور أو المتقاعد لا يُعدَّل.
 *
 * ما عدا الموضع على اللوحة: الإحداثيّ عرضٌ محض لا أثر له في التوجيه،
 * وحبسُه يعني أن ترتيب رسمٍ منشور يحتاج إصدارًا جديدًا — وذاك عبث.
 */
create or replace function public.guard_definition_frozen()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  v_definition_id uuid;
  v_status text;
  v_row record;
begin
  -- `coalesce` لا يعمل على السجلّات؛ الفرع صريح
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  if tg_table_name = 'workflow_stages' then
    v_definition_id := v_row.definition_id;
    if tg_op = 'UPDATE'
       and (to_jsonb(new) - 'pos_x' - 'pos_y' - 'updated_at')
         = (to_jsonb(old) - 'pos_x' - 'pos_y' - 'updated_at') then
      return new;
    end if;
  elsif tg_table_name in ('workflow_stage_participants',
                          'workflow_stage_requirements',
                          'workflow_actions') then
    select s.definition_id into v_definition_id
      from public.workflow_stages s where s.id = v_row.stage_id;
  elsif tg_table_name = 'workflow_action_routes' then
    select s.definition_id into v_definition_id
      from public.workflow_actions a
      join public.workflow_stages s on s.id = a.stage_id
     where a.id = v_row.action_id;
  end if;

  select status into v_status
    from public.workflow_definitions where id = v_definition_id;

  if v_status is not null and v_status <> 'draft' then
    raise exception
      'الإصدار المنشور لا يُعدَّل — أنشئ مسودّة جديدة من المسار ثم عدّلها'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$fn$;

drop trigger if exists guard_frozen_stages on public.workflow_stages;
create trigger guard_frozen_stages
  before insert or update or delete on public.workflow_stages
  for each row execute function public.guard_definition_frozen();

drop trigger if exists guard_frozen_participants on public.workflow_stage_participants;
create trigger guard_frozen_participants
  before insert or update or delete on public.workflow_stage_participants
  for each row execute function public.guard_definition_frozen();

drop trigger if exists guard_frozen_requirements on public.workflow_stage_requirements;
create trigger guard_frozen_requirements
  before insert or update or delete on public.workflow_stage_requirements
  for each row execute function public.guard_definition_frozen();

drop trigger if exists guard_frozen_actions on public.workflow_actions;
create trigger guard_frozen_actions
  before insert or update or delete on public.workflow_actions
  for each row execute function public.guard_definition_frozen();

drop trigger if exists guard_frozen_routes on public.workflow_action_routes;
create trigger guard_frozen_routes
  before insert or update or delete on public.workflow_action_routes
  for each row execute function public.guard_definition_frozen();

-- الحارس يعمل بصلاحية المستدعي، ونسخ المسودّة تكتب في مسودّة فتمرّ.
-- أمّا `set_stage_positions` فتكتب عمودي الموضع وحدهما، والحارس يعفيهما.

-- ── البدء يختار المنشور بلا تعديل سطر واحد ─────────────────────────────
-- `start_transaction` والمجدوِل كلاهما يرشّح بـ `is_active`، والقيد
-- `active_only_published` جعل ذلك مرادفًا لـ «المنشور». فلا تُعاد كتابة
-- دالّتين كبيرتين لتغيير شرطٍ صار صحيحًا بحكم القيد.

-- ── ٤) الأرشفة على مرحلتين ─────────────────────────────────────────────
/**
 * الإيداع: صاحب المعاملة يُقرّ أنه سلّم الأصل الورقيّ.
 *
 * لا يُودَع إلا ما أُغلق: إيداع أصل معاملةٍ ما زالت تسير يعني أن الورقة
 * غادرت وهي ما تزال مطلوبة.
 */
create or replace function public.submit_transaction_original(
  p_transaction_id uuid,
  p_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_tx public.transactions%rowtype;
begin
  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;

  if not v_tx.is_closed then
    raise exception 'الإيداع بعد إغلاق المعاملة' using errcode = 'check_violation';
  end if;

  if v_tx.archive_state <> 'none' then
    raise exception 'الأصل مُودَع أصلًا' using errcode = 'check_violation';
  end if;

  if not public.is_transaction_participant(p_transaction_id)
     and not public.has_workflow_permission('transaction.archive') then
    raise exception 'الإيداع من موقّعي المعاملة أو أمين الأرشيف'
      using errcode = 'insufficient_privilege';
  end if;

  update public.transactions
     set archive_state = 'submitted',
         archive_submitted_at = now(),
         archive_submitted_by = auth.uid()
   where id = p_transaction_id;

  insert into public.transaction_action_log
    (transaction_id, action_key, action_label, kind, notes, acted_by)
  values
    (p_transaction_id, 'archive_submit', 'إيداع الأصل', 'note',
     coalesce(p_notes, ''), auth.uid());
end;
$fn$;

/**
 * القبول والفهرسة: أمين الأرشيف يُقرّ أن الأصل وصله، ويقيّد موضعه.
 * الموضع إلزاميّ — أرشفةٌ بلا موضع إقرارٌ لا أثر له.
 */
create or replace function public.accept_transaction_archive(
  p_transaction_id uuid,
  p_location text,
  p_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_tx public.transactions%rowtype;
begin
  if not public.has_workflow_permission('transaction.archive') then
    raise exception 'القبول والفهرسة تتطلّب صلاحية transaction.archive'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(btrim(p_location), '') = '' then
    raise exception 'موضع الحفظ مطلوب (رقم الملفّ أو الرفّ)'
      using errcode = 'check_violation';
  end if;

  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;

  if v_tx.archive_state <> 'submitted' then
    raise exception 'لا يُقبَل إلا ما أُودع' using errcode = 'check_violation';
  end if;

  update public.transactions
     set archive_state = 'archived',
         archived_at = now(),
         archived_by = auth.uid(),
         archive_location = btrim(p_location)
   where id = p_transaction_id;

  insert into public.transaction_action_log
    (transaction_id, action_key, action_label, kind, notes, acted_by)
  values
    (p_transaction_id, 'archive_accept', 'قبول الأرشفة', 'note',
     btrim(p_location) || case when coalesce(btrim(p_notes), '') = '' then ''
                               else ' — ' || btrim(p_notes) end,
     auth.uid());
end;
$fn$;

/**
 * الردّ: «لم يصلني». يُعيد الحالة إلى ما قبل الإيداع بسبب مسجَّل.
 * وهذا هو ما تشتريه المرحلتان: خلافٌ مكتوب بدل خلافٍ شفويّ.
 */
create or replace function public.reject_transaction_archive(
  p_transaction_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_tx public.transactions%rowtype;
begin
  if not public.has_workflow_permission('transaction.archive') then
    raise exception 'الردّ يتطلّب صلاحية transaction.archive'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'سبب الردّ مطلوب' using errcode = 'check_violation';
  end if;

  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;

  if v_tx.archive_state <> 'submitted' then
    raise exception 'لا يُردّ إلا ما أُودع وينتظر القبول'
      using errcode = 'check_violation';
  end if;

  update public.transactions
     set archive_state = 'none',
         archive_submitted_at = null,
         archive_submitted_by = null
   where id = p_transaction_id;

  insert into public.transaction_action_log
    (transaction_id, action_key, action_label, kind, notes, acted_by)
  values
    (p_transaction_id, 'archive_reject', 'ردّ الإيداع', 'note',
     btrim(p_reason), auth.uid());
end;
$fn$;

-- ── الصلاحيات ──────────────────────────────────────────────────────────
revoke execute on function
  public.unmet_stage_requirements(uuid, text),
  public.claim_assignment(uuid),
  public.release_assignment_claim(uuid, text),
  public.create_workflow_draft(uuid),
  public.publish_workflow_version(uuid),
  public.submit_transaction_original(uuid, text),
  public.accept_transaction_archive(uuid, text, text),
  public.reject_transaction_archive(uuid, text)
  from public, anon;

grant execute on function
  public.unmet_stage_requirements(uuid, text),
  public.claim_assignment(uuid),
  public.release_assignment_claim(uuid, text),
  public.create_workflow_draft(uuid),
  public.publish_workflow_version(uuid),
  public.submit_transaction_original(uuid, text),
  public.accept_transaction_archive(uuid, text, text),
  public.reject_transaction_archive(uuid, text)
  to authenticated;
