-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٢ — التوجيه: من الخطّ الواحد إلى الشبكة
--
-- `complete_assignment` صار يأخذ **مفتاح إجراء**. المرحلة تُغلق بسياستها كما
-- في المرحلة ٠١، ثم يقرّر الإجراءُ الوجهةَ عبر مساراته الشرطية.
-- ═══════════════════════════════════════════════════════════════════════

-- التواقيع تغيّرت، فتُسقَط القديمة صراحةً لئلّا يبقى حِملٌ زائد يُنادى سهوًا
drop function if exists public.open_stage_instance(uuid, uuid);
drop function if exists public.complete_assignment(uuid, text);
drop function if exists public.start_transaction(text, text, uuid, text, uuid);

/**
 * يفتح تكليفًا لكل مشارك مؤهَّل على مرحلة قائمة.
 * أولوية المدة: مدّة الإرجاع من الإجراء، ثم مدّة الموظف [المراسلات 1، 6]،
 * ثم مهلة المرحلة. وغيابها كلّها يوقف العدّاد عند مدير البرنامج [المراسلات 3].
 */
create or replace function public.populate_stage_assignments(
  p_instance_id uuid,
  p_minutes_override integer default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_si public.transaction_stage_instances%rowtype;
  v_stage public.workflow_stages%rowtype;
  v_type text;
  v_p record;
  v_duration public.step_duration_settings%rowtype;
  v_minutes integer;
  v_count integer := 0;
begin
  select * into v_si from public.transaction_stage_instances where id = p_instance_id;
  if not found then
    raise exception 'المرحلة غير موجودة' using errcode = 'no_data_found';
  end if;

  select * into v_stage from public.workflow_stages where id = v_si.stage_id;
  select t.type into v_type from public.transactions t where t.id = v_si.transaction_id;

  for v_p in
    select * from public.resolve_stage_participants(v_si.stage_id, v_si.transaction_id)
  loop
    v_duration := null;
    select * into v_duration
      from public.resolve_step_duration(v_type, v_p.assignee_id);

    v_minutes := coalesce(p_minutes_override, v_duration.minutes, v_stage.sla_minutes);

    insert into public.transaction_assignments
      (stage_instance_id, transaction_id, assignee_id, participant_id,
       is_optional, allocated_minutes, arrived_at, status)
    values
      (p_instance_id, v_si.transaction_id, v_p.assignee_id, v_p.participant_id,
       v_p.is_optional, v_minutes, now(), 'in_progress')
    on conflict (stage_instance_id, assignee_id) do nothing;

    -- مدة لمرة واحدة تُستهلك بعد استخدامها فتُسأل من جديد لاحقًا [المراسلات 2]
    if v_duration.id is not null and v_duration.duration_scope = 'single' then
      delete from public.step_duration_settings where id = v_duration.id;
    end if;

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    -- لا مؤهّل: تقف معلَّقة بانتظار تدخّل بشري ولا تُغلق صامتة
    update public.transaction_stage_instances
       set status = 'pending'
     where id = p_instance_id;
  else
    update public.transaction_stage_instances
       set status = 'in_progress', entered_at = now(), is_deferred_join = false
     where id = p_instance_id;
  end if;

  return v_count;
end;
$fn$;

/**
 * يفتح مرحلة على معاملة.
 * مرحلة الالتقاء (`wait_all`) لا تبدأ ما دام فرعٌ آخر جاريًا: تُنشأ معلَّقة
 * وتُفعَّل حين تهدأ الفروع.
 */
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

  -- مرحلة التقاء تنتظر أصلًا: الفرع الثاني ينضمّ إليها ولا يفتح نسخة ثانية.
  -- بغير هذا تُنشأ نسخة لكل فرع، وتبقى الأولى معلَّقة إلى الأبد.
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

  -- حارس الحلقات المغلقة: التفريع يسمح بأن ترجع مرحلة إلى سابقة، فلا بدّ من سقف
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
     completion_policy, quorum_count, join_policy, conflict_policy,
     status, is_deferred_join, is_final, is_archive, requires_receive)
  values
    (p_transaction_id, p_stage_id, v_stage.stage_key, v_stage.name, v_seq + 1,
     v_stage.completion_policy, v_stage.quorum_count,
     v_stage.join_policy, v_stage.conflict_policy,
     case when v_defer then 'pending' else 'in_progress' end, v_defer,
     v_stage.is_final, v_stage.is_archive, v_stage.requires_receive)
  returning id into v_instance_id;

  if not v_defer then
    perform public.populate_stage_assignments(v_instance_id, p_minutes_override);
  end if;

  return v_instance_id;
end;
$fn$;

/** يُفعّل مراحل الالتقاء المؤجَّلة حين لا يبقى فرعٌ جارٍ. */
create or replace function public.activate_ready_joins(p_transaction_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
  v_n integer := 0;
begin
  if exists (
    select 1 from public.transaction_stage_instances
    where transaction_id = p_transaction_id and status = 'in_progress'
  ) then
    return 0;
  end if;

  for v_id in
    select id from public.transaction_stage_instances
    where transaction_id = p_transaction_id
      and status = 'pending' and is_deferred_join
    order by seq
  loop
    perform public.populate_stage_assignments(v_id, null);
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$fn$;

/**
 * وجهات الإجراء بعد تقييم شروطها.
 * أول أولوية يتحقّق شرطها تفوز، وكل مسارات تلك الأولوية المتحقّقة تُفتح معًا
 * — وهو التفريع المتوازي.
 */
create or replace function public.resolve_action_routes(
  p_action_id uuid,
  p_transaction_id uuid
)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_context jsonb;
  v_priority smallint;
begin
  v_context := public.build_transaction_context(p_transaction_id);

  select r.priority into v_priority
    from public.workflow_action_routes r
   where r.action_id = p_action_id
     and public.eval_workflow_condition(r.condition, v_context)
   order by r.priority
   limit 1;

  if v_priority is null then
    return;
  end if;

  return query
    select r.target_stage_id
      from public.workflow_action_routes r
     where r.action_id = p_action_id
       and r.priority = v_priority
       and public.eval_workflow_condition(r.condition, v_context);
end;
$fn$;

/** بدء معاملة مع لقطة سياقها — ما تُقاس عليه شروط التفريع لاحقًا. */
create or replace function public.start_transaction(
  p_type text,
  p_subject text,
  p_project_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_definition public.workflow_definitions%rowtype;
  v_start public.workflow_stages%rowtype;
  v_transaction_id uuid;
begin
  if not public.has_permission('transaction.create') then
    raise exception 'يتطلّب صلاحية transaction.create'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_definition
    from public.workflow_definitions
   where transaction_type = p_type and is_active;
  if not found then
    raise exception 'لا يوجد تعريف سير عمل مفعّل للنوع %', p_type
      using errcode = 'no_data_found';
  end if;

  select * into v_start
    from public.workflow_stages
   where definition_id = v_definition.id and is_start;

  if not found then
    select * into v_start
      from public.workflow_stages
     where definition_id = v_definition.id
     order by sort_order, created_at
     limit 1;
  end if;

  if not found then
    raise exception 'تعريف سير العمل بلا مراحل' using errcode = 'check_violation';
  end if;

  insert into public.transactions
    (type, subject, project_id, entity_type, entity_id, definition_id,
     status, requested_by, created_by, context)
  values
    (p_type, coalesce(p_subject, ''), p_project_id, p_entity_type, p_entity_id,
     v_definition.id, 'in_progress', auth.uid(), auth.uid(),
     coalesce(p_context, '{}'::jsonb))
  returning id into v_transaction_id;

  perform public.open_stage_instance(v_transaction_id, v_start.id);

  return v_transaction_id;
end;
$fn$;

/** تحديث لقطة السياق — يغيّر ما تُقاس عليه الشروط في التفريعات القادمة. */
create or replace function public.set_transaction_context(
  p_transaction_id uuid,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'السياق يجب أن يكون كائنًا' using errcode = 'check_violation';
  end if;

  if not public.is_transaction_participant(p_transaction_id)
     and not public.has_permission('transaction.override') then
    raise exception 'تعديل سياق المعاملة للموقّعين عليها أو لصاحب صلاحية التجاوز'
      using errcode = 'insufficient_privilege';
  end if;

  update public.transactions
     set context = coalesce(context, '{}'::jsonb) || p_patch
   where id = p_transaction_id;

  if not found then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;
end;
$fn$;

/**
 * إنجاز تكليف باتخاذ إجراء.
 *
 * `note` يسجّل ملاحظة ولا يُنجز التكليف ولا يحرّك المرحلة.
 * وغيره يُنجز التكليف، فإن تحقّقت سياسة المرحلة أُغلقت وقرّر الإجراءُ الوجهةَ.
 * وحين يختلف المشاركون في اختيارهم يحسم `conflict_policy`.
 */
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
  v_actual integer;
  v_done_any integer;
  v_done_required integer;
  v_required integer;
  v_close boolean;
  v_target uuid;
  v_last_opened uuid;
  v_opened integer := 0;
begin
  select * into v_a from public.transaction_assignments where id = p_assignment_id;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  -- قفل المعاملة: يسلسل تسابق مشاركَين على إغلاق المرحلة نفسها،
  -- ويحمي ترقيم seq عند فتح المراحل التالية.
  select * into v_tx from public.transactions
   where id = v_a.transaction_id for update;

  select * into v_a from public.transaction_assignments where id = p_assignment_id;

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

  -- ── الإجراء ──────────────────────────────────────────────────────────
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
  end if;

  -- الملاحظة لا تحتاج مدّة ولا استلامًا: هي تعليق لا إنجاز
  if v_action.id is not null and v_action.kind = 'note' then
    insert into public.transaction_action_log
      (transaction_id, stage_instance_id, assignment_id, action_id,
       action_key, action_label, kind, notes, acted_by)
    values
      (v_tx.id, v_si.id, v_a.id, v_action.id,
       v_action.action_key, v_action.label, 'note', coalesce(p_notes, ''), auth.uid());
    return null;
  end if;

  if v_a.allocated_minutes is null then
    raise exception 'لم تُحدَّد مدة هذا التكليف بعد — يمرّ على مدير البرنامج أولًا'
      using errcode = 'check_violation';
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
     coalesce(p_notes, ''), auth.uid());

  -- ── سياسة الإنجاز ────────────────────────────────────────────────────
  select
    count(*) filter (where status = 'done'),
    count(*) filter (where status = 'done' and not is_optional),
    count(*) filter (where status <> 'cancelled' and not is_optional)
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

  -- ── من يقرّر الوجهة حين اختلف المشاركون ──────────────────────────────
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

  -- من لم يتصرّف لا يبقى مفتوحًا في صندوقه
  update public.transaction_assignments
     set status = 'cancelled'
   where stage_instance_id = v_si.id and status in ('pending', 'in_progress');

  -- ── التوجيه ──────────────────────────────────────────────────────────
  if v_decider.id is not null then
    if v_decider.kind <> 'final' then
      for v_target in
        select * from public.resolve_action_routes(v_decider.id, v_tx.id)
      loop
        v_last_opened := public.open_stage_instance(
          v_tx.id, v_target, v_decider.return_minutes);
        v_opened := v_opened + 1;
      end loop;
    end if;
  elsif not v_si.is_final and v_si.stage_id is not null then
    -- مسار بلا إجراءات معرَّفة: التسلسل الخطّي من المرحلة ٠١
    select ws.default_next_stage_id into v_target
      from public.workflow_stages ws where ws.id = v_si.stage_id;
    if v_target is not null then
      v_last_opened := public.open_stage_instance(v_tx.id, v_target, null);
      v_opened := 1;
    end if;
  end if;

  -- مرحلة التقاء كانت مؤجَّلة قد يحين وقتها الآن
  perform public.activate_ready_joins(v_tx.id);

  if exists (
    select 1 from public.transaction_stage_instances
    where transaction_id = v_tx.id and status in ('pending', 'in_progress')
  ) then
    return v_last_opened;
  end if;

  -- لم يبقَ ما يُنتظر
  if v_decider.kind = 'final' or v_si.is_final then
    update public.transactions
       set status = 'completed', is_closed = true, closed_at = now()
     where id = v_tx.id;
  else
    -- ترجع لطالبها ليؤكّد تمام الإنجاز [المراسلات 9]
    update public.transactions
       set status = 'awaiting_confirmation'
     where id = v_tx.id;
  end if;

  return v_last_opened;
end;
$fn$;

-- ── الصلاحيات ──────────────────────────────────────────────────────────
revoke execute on function
  public.populate_stage_assignments(uuid, integer),
  public.open_stage_instance(uuid, uuid, integer),
  public.activate_ready_joins(uuid)
  from public, anon, authenticated;

revoke execute on function
  public.resolve_action_routes(uuid, uuid),
  public.start_transaction(text, text, uuid, text, uuid, jsonb),
  public.set_transaction_context(uuid, jsonb),
  public.complete_assignment(uuid, text, text)
  from public, anon;

grant execute on function
  public.resolve_action_routes(uuid, uuid),
  public.start_transaction(text, text, uuid, text, uuid, jsonb),
  public.set_transaction_context(uuid, jsonb),
  public.complete_assignment(uuid, text, text)
  to authenticated;
