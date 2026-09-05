-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠١ — دوال المحرّك v2
--
-- كل انتقال حالة يقع داخل دالة SECURITY DEFINER تتحقّق من الصلاحية وتقفل
-- المعاملة، فلا كتابة مباشرة من الواجهة على جداول المحرّك.
-- كل الأرقام من جدول الإعدادات لا من الكود.
-- ═══════════════════════════════════════════════════════════════════════

-- ── إعادة كتابة دالتَي وقت العمل: الاستعلامات تُرفع خارج الحلقة ─────────
-- الأصل كان ينفّذ استعلامين لكل يوم داخل المدى. صندوق الوارد ينادي الدالة
-- لكل صفّ، والتوازي يضاعف الصفوف بعدد المشاركين على المرحلة.
--
-- هنا تُقرأ الإجازات وجدول الدوام **مرة واحدة** في مصفوفات، ثم تدور الحلقة
-- في الذاكرة بلا استعلام. قياسًا على ٢٠٠١ صفّ: مدى ٥ أيام ٦٨٢ ← ٤٥٣ مللي،
-- ومدى ٦٠ يومًا ٧١٧١ ← ١٠٢٨ مللي.
--
-- جُرِّبت نسخة مجموعية بـ generate_series فكانت أبطأ على المدى القصير
-- (١٣٣١ مللي) لأن كلفة تهيئة الاستعلام تفوق حلقة يومية قصيرة.

create or replace function public.business_minutes_between(
  p_from timestamptz,
  p_to timestamptz,
  p_user_id uuid default null
)
returns integer
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
declare
  v_tz text;
  v_from timestamp;
  v_to timestamp;
  v_date date;
  v_last date;
  v_total int := 0;
  v_holidays date[];
  v_dow smallint[];
  v_start time[];
  v_end time[];
  v_seg_start timestamp;
  v_seg_end timestamp;
  i int;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    return 0;
  end if;

  v_tz := public.app_timezone();
  v_from := p_from at time zone v_tz;
  v_to   := p_to   at time zone v_tz;
  v_date := v_from::date;
  v_last := v_to::date;

  select coalesce(array_agg(h.holiday_date), '{}')
    into v_holidays
    from public.holidays h
   where h.holiday_date between v_date and v_last
     and (h.scope = 'global' or h.user_id = p_user_id);

  -- الاستثناء الفردي يُلغي الجدول العام لذلك اليوم [المراسلات 8]
  select coalesce(array_agg(ws.day_of_week), '{}'),
         coalesce(array_agg(ws.start_time), '{}'),
         coalesce(array_agg(ws.end_time), '{}')
    into v_dow, v_start, v_end
    from public.work_schedules ws
   where (ws.scope = 'user' and ws.user_id = p_user_id)
      or (ws.scope = 'global'
          and not exists (
            select 1 from public.work_schedules u
            where u.scope = 'user'
              and u.user_id = p_user_id
              and u.day_of_week = ws.day_of_week));

  while v_date <= v_last loop
    -- يوم إجازة (عامة أو خاصة بالموظف) لا يُحتسب إطلاقًا
    if not (v_date = any (v_holidays)) then
      for i in 1 .. coalesce(array_length(v_dow, 1), 0) loop
        if v_dow[i] = extract(dow from v_date)::smallint then
          v_seg_start := greatest(v_date + v_start[i], v_from);
          v_seg_end   := least(v_date + v_end[i], v_to);
          if v_seg_end > v_seg_start then
            v_total := v_total
              + floor(extract(epoch from (v_seg_end - v_seg_start)) / 60)::int;
          end if;
        end if;
      end loop;
    end if;
    v_date := v_date + 1;
  end loop;

  return v_total;
end;
$fn$;

comment on function public.business_minutes_between(timestamptz, timestamptz, uuid) is
  'دقائق العمل بين لحظتين — تتوقّف خارج الدوام وأيام الإجازات [المراسلات 3، 7].';

create or replace function public.add_business_minutes(
  p_from timestamptz,
  p_minutes integer,
  p_user_id uuid default null
)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
declare
  v_tz text;
  v_from timestamp;
  v_date date;
  v_guard date;
  v_left int;
  v_holidays date[];
  v_dow smallint[];
  v_start time[];
  v_end time[];
  v_seg_start timestamp;
  v_seg_end timestamp;
  v_available int;
  i int;
begin
  if p_from is null then return null; end if;
  v_left := greatest(coalesce(p_minutes, 0), 0);
  if v_left = 0 then return p_from; end if;

  v_tz := public.app_timezone();
  v_from := p_from at time zone v_tz;
  v_date := v_from::date;
  -- محدودة بسنة للأمام حتى لا تدور بلا نهاية إن لم يُعرَّف أي دوام
  v_guard := v_date + 365;

  select coalesce(array_agg(h.holiday_date), '{}')
    into v_holidays
    from public.holidays h
   where h.holiday_date between v_date and v_guard
     and (h.scope = 'global' or h.user_id = p_user_id);

  -- مرتّبة بوقت البدء: الورديات داخل اليوم تُستهلك بالترتيب
  select coalesce(array_agg(ws.day_of_week order by ws.day_of_week, ws.start_time), '{}'),
         coalesce(array_agg(ws.start_time  order by ws.day_of_week, ws.start_time), '{}'),
         coalesce(array_agg(ws.end_time    order by ws.day_of_week, ws.start_time), '{}')
    into v_dow, v_start, v_end
    from public.work_schedules ws
   where (ws.scope = 'user' and ws.user_id = p_user_id)
      or (ws.scope = 'global'
          and not exists (
            select 1 from public.work_schedules u
            where u.scope = 'user'
              and u.user_id = p_user_id
              and u.day_of_week = ws.day_of_week));

  while v_date <= v_guard loop
    if not (v_date = any (v_holidays)) then
      for i in 1 .. coalesce(array_length(v_dow, 1), 0) loop
        if v_dow[i] = extract(dow from v_date)::smallint then
          v_seg_start := greatest(v_date + v_start[i], v_from);
          v_seg_end   := v_date + v_end[i];
          if v_seg_end > v_seg_start then
            v_available := floor(extract(epoch from (v_seg_end - v_seg_start)) / 60)::int;
            if v_available >= v_left then
              return (v_seg_start + make_interval(mins => v_left)) at time zone v_tz;
            end if;
            v_left := v_left - v_available;
          end if;
        end if;
      end loop;
    end if;
    v_date := v_date + 1;
  end loop;

  return null;
end;
$fn$;

comment on function public.add_business_minutes(timestamptz, integer, uuid) is
  'موعد الاستحقاق بعد إضافة دقائق عمل — يتخطّى المساء والإجازات.';


-- ── من يقف على المرحلة ─────────────────────────────────────────────────
/**
 * يحلّ مشاركي المرحلة إلى موظفين فعليين.
 * `role` يتمدّد إلى **كل** حاملي الدور النشطين — وهذا هو التوازي؛ الدالة
 * القديمة كانت تُرجع واحدًا بـ limit 1 مرتَّبًا بالاسم.
 */
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
  with requester as (
    select t.requested_by as id
    from public.transactions t
    where t.id = p_transaction_id
  ),
  matched as (
    select sp.id as participant_id, sp.is_optional, sp.sort_order, p.id as assignee_id
    from public.workflow_stage_participants sp
    join public.profiles p
      on p.is_active
     and (
       (sp.kind = 'user' and p.id = sp.user_id)
       or (sp.kind = 'requester' and p.id = (select id from requester))
       or (sp.kind = 'role' and exists (
             select 1 from public.user_roles ur
             where ur.user_id = p.id and ur.role_id = sp.role_id))
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

-- ── فتح مرحلة ──────────────────────────────────────────────────────────
/**
 * ينشئ مرحلة فعلية ويفتح تكليفًا لكل مشارك مؤهَّل.
 * مدة الموظف [المراسلات 1، 6] أدقّ من مهلة المرحلة؛ وغيابهما معًا يترك
 * `allocated_minutes` فارغًا فتقف المعاملة عند مدير البرنامج [المراسلات 3]
 * ولا يبدأ العدّاد.
 */
create or replace function public.open_stage_instance(
  p_transaction_id uuid,
  p_stage_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stage public.workflow_stages%rowtype;
  v_type text;
  v_seq integer;
  v_instance_id uuid;
  v_p record;
  v_duration public.step_duration_settings%rowtype;
  v_minutes integer;
  v_count integer := 0;
begin
  select * into v_stage from public.workflow_stages where id = p_stage_id;
  if not found then
    raise exception 'المرحلة غير معرَّفة في المسار' using errcode = 'no_data_found';
  end if;

  select t.type into v_type from public.transactions t where t.id = p_transaction_id;
  if not found then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq
  from public.transaction_stage_instances
  where transaction_id = p_transaction_id;

  insert into public.transaction_stage_instances
    (transaction_id, stage_id, stage_key, name, seq,
     completion_policy, quorum_count, status,
     is_final, is_archive, requires_receive)
  values
    (p_transaction_id, p_stage_id, v_stage.stage_key, v_stage.name, v_seq,
     v_stage.completion_policy, v_stage.quorum_count, 'in_progress',
     v_stage.is_final, v_stage.is_archive, v_stage.requires_receive)
  returning id into v_instance_id;

  for v_p in
    select * from public.resolve_stage_participants(p_stage_id, p_transaction_id)
  loop
    v_duration := null;
    select * into v_duration
      from public.resolve_step_duration(v_type, v_p.assignee_id);

    v_minutes := coalesce(v_duration.minutes, v_stage.sla_minutes);

    insert into public.transaction_assignments
      (stage_instance_id, transaction_id, assignee_id, participant_id,
       is_optional, allocated_minutes, arrived_at, status)
    values
      (v_instance_id, p_transaction_id, v_p.assignee_id, v_p.participant_id,
       v_p.is_optional, v_minutes, now(), 'in_progress');

    -- مدة لمرة واحدة تُستهلك بعد استخدامها فتُسأل من جديد لاحقًا [المراسلات 2]
    if v_duration.id is not null and v_duration.duration_scope = 'single' then
      delete from public.step_duration_settings where id = v_duration.id;
    end if;

    v_count := v_count + 1;
  end loop;

  -- لا مؤهّل لهذه المرحلة: تقف معلَّقة بانتظار تدخّل بشري، ولا تُغلق صامتة
  -- فتضيع المعاملة بلا صاحب.
  if v_count = 0 then
    update public.transaction_stage_instances
       set status = 'pending'
     where id = v_instance_id;
  end if;

  return v_instance_id;
end;
$$;

-- ── بدء معاملة ─────────────────────────────────────────────────────────
create or replace function public.start_transaction(
  p_type text,
  p_subject text,
  p_project_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    -- مسار لم تُعلَّم بدايته: أول مرحلة بالترتيب المعروض
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
     status, requested_by, created_by)
  values
    (p_type, coalesce(p_subject, ''), p_project_id, p_entity_type, p_entity_id,
     v_definition.id, 'in_progress', auth.uid(), auth.uid())
  returning id into v_transaction_id;

  perform public.open_stage_instance(v_transaction_id, v_start.id);

  return v_transaction_id;
end;
$$;

-- ── تحديد المدة [المراسلات 3، 4، 5] ────────────────────────────────────
/**
 * مدير البرنامج يحدّد مدة تكليف، أو يعدّلها حتى بعد انتهائه.
 * كل تعديل يُسجَّل في duration_change_log ليظهر في تقرير المدد المعدّلة.
 */
create or replace function public.set_assignment_duration(
  p_assignment_id uuid,
  p_minutes integer,
  p_scope text default 'all_occurrences',
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_a public.transaction_assignments%rowtype;
  v_type text;
  v_actual integer;
begin
  if not public.has_permission('duration.manage') then
    raise exception 'تحديد المدد يتطلّب صلاحية duration.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if p_minutes is null or p_minutes <= 0 then
    raise exception 'المدة يجب أن تكون أكبر من صفر' using errcode = 'check_violation';
  end if;

  if coalesce(p_scope, '') not in ('all_occurrences', 'single') then
    raise exception 'نطاق المدة غير صالح' using errcode = 'check_violation';
  end if;

  select * into v_a from public.transaction_assignments where id = p_assignment_id;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  select t.type into v_type
    from public.transactions t where t.id = v_a.transaction_id;

  insert into public.duration_change_log
    (assignment_id, old_minutes, new_minutes, reason, changed_by)
  values
    (p_assignment_id, v_a.allocated_minutes, p_minutes, coalesce(p_reason, ''),
     auth.uid());

  update public.transaction_assignments
     set allocated_minutes = p_minutes
   where id = p_assignment_id;

  -- تُحفظ للمرات القادمة فلا تُسأل مرتين [المراسلات 1، 6]
  if v_a.assignee_id is not null then
    insert into public.step_duration_settings
      (transaction_type, user_id, minutes, duration_scope, created_by)
    values (v_type, v_a.assignee_id, p_minutes, p_scope, auth.uid())
    on conflict (transaction_type, user_id) where user_id is not null
    do update set minutes = excluded.minutes,
                  duration_scope = excluded.duration_scope;
  end if;

  -- إعادة احتساب الدرجة إن كان التكليف منجَزًا سلفًا [المراسلات 4]
  if v_a.status = 'done' and v_a.completed_at is not null then
    v_actual := public.business_minutes_between(
      v_a.arrived_at, v_a.completed_at, v_a.assignee_id);
    update public.transaction_assignments
       set score = public.score_for_completion(p_minutes, v_actual)
     where id = p_assignment_id;
  end if;
end;
$$;

-- ── استلام التكليف ─────────────────────────────────────────────────────
create or replace function public.receive_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_a public.transaction_assignments%rowtype;
begin
  select * into v_a from public.transaction_assignments where id = p_assignment_id;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  if v_a.assignee_id is distinct from auth.uid() then
    raise exception 'الاستلام من المكلَّف وحده'
      using errcode = 'insufficient_privilege';
  end if;

  if v_a.status <> 'in_progress' then
    raise exception 'هذا التكليف ليس قيد التنفيذ' using errcode = 'check_violation';
  end if;

  update public.transaction_assignments
     set received_at = coalesce(received_at, now())
   where id = p_assignment_id;
end;
$$;

-- ── إنجاز التكليف ──────────────────────────────────────────────────────
/**
 * يحسب الزمن داخل الدوام، يضع الدرجة، ثم يطبّق سياسة إنجاز المرحلة.
 * تُغلق المرحلة حين تتحقّق السياسة لا حين ينجز أول مشارك — إلا تحت `any`.
 * وحين لا تبقى مراحل تعود المعاملة لطالبها ليعطي «تمام الإنجاز» [المراسلات 9].
 */
create or replace function public.complete_assignment(
  p_assignment_id uuid,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_a  public.transaction_assignments%rowtype;
  v_si public.transaction_stage_instances%rowtype;
  v_tx public.transactions%rowtype;
  v_actual integer;
  v_done_any integer;
  v_done_required integer;
  v_required integer;
  v_close boolean;
  v_next_stage_id uuid;
begin
  select * into v_a from public.transaction_assignments where id = p_assignment_id;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  -- قفل المعاملة: يسلسل تسابق مشاركَين على إغلاق المرحلة نفسها،
  -- ويحمي ترقيم seq عند فتح المرحلة التالية.
  select * into v_tx from public.transactions
   where id = v_a.transaction_id for update;

  -- إعادة القراءة بعد القفل: قد يكون غيرُه أغلق المرحلة في هذه الأثناء
  select * into v_a from public.transaction_assignments where id = p_assignment_id;

  if v_a.status <> 'in_progress' then
    raise exception 'هذا التكليف ليس قيد التنفيذ' using errcode = 'check_violation';
  end if;

  if v_a.assignee_id is distinct from auth.uid()
     and not public.has_permission('transaction.override') then
    raise exception 'لست المكلَّف بهذه المرحلة'
      using errcode = 'insufficient_privilege';
  end if;

  if v_a.allocated_minutes is null then
    raise exception 'لم تُحدَّد مدة هذا التكليف بعد — يمرّ على مدير البرنامج أولًا'
      using errcode = 'check_violation';
  end if;

  select * into v_si from public.transaction_stage_instances
   where id = v_a.stage_instance_id;

  if v_si.requires_receive and v_a.received_at is null then
    raise exception 'يجب استلام المعاملة قبل إنجازها'
      using errcode = 'check_violation';
  end if;

  v_actual := public.business_minutes_between(v_a.arrived_at, now(), v_a.assignee_id);

  update public.transaction_assignments
     set status = 'done',
         completed_at = now(),
         notes = coalesce(p_notes, ''),
         score = public.score_for_completion(v_a.allocated_minutes, v_actual)
   where id = p_assignment_id;

  -- الاختياري لا يمنع الإغلاق تحت all، ويُحتسب تحت any و quorum
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

  update public.transaction_stage_instances
     set status = 'done', completed_at = now()
   where id = v_si.id;

  -- من لم يتصرّف تحت `any` أو `quorum` لا يبقى مفتوحًا في صندوقه
  update public.transaction_assignments
     set status = 'cancelled'
   where stage_instance_id = v_si.id and status in ('pending', 'in_progress');

  -- التوجيه خطّي في المرحلة ٠١، ويستبدله workflow_action_routes في المرحلة ٠٢
  if not v_si.is_final and v_si.stage_id is not null then
    select ws.default_next_stage_id into v_next_stage_id
      from public.workflow_stages ws where ws.id = v_si.stage_id;
  end if;

  if v_next_stage_id is not null then
    return public.open_stage_instance(v_tx.id, v_next_stage_id);
  end if;

  -- فرع آخر ما زال جاريًا ⇒ المعاملة لم تنتهِ
  if exists (
    select 1 from public.transaction_stage_instances
    where transaction_id = v_tx.id and status in ('pending', 'in_progress')
  ) then
    return null;
  end if;

  if v_si.is_final then
    -- المسار نمذج إغلاقه صراحةً
    update public.transactions
       set status = 'completed', is_closed = true, closed_at = now()
     where id = v_tx.id;
  else
    -- وإلا ترجع لطالبها ليؤكّد تمام الإنجاز [المراسلات 9]
    update public.transactions
       set status = 'awaiting_confirmation'
     where id = v_tx.id;
  end if;

  return null;
end;
$$;

-- ── تمام الإنجاز [المراسلات 9] ─────────────────────────────────────────
create or replace function public.close_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tx public.transactions%rowtype;
begin
  select * into v_tx from public.transactions
   where id = p_transaction_id for update;
  if not found then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;

  if v_tx.status <> 'awaiting_confirmation' then
    raise exception 'المعاملة لم تصل بعد لمرحلة تأكيد الإنجاز'
      using errcode = 'check_violation';
  end if;

  if v_tx.requested_by is distinct from auth.uid()
     and not public.has_permission('transaction.override') then
    raise exception 'تأكيد الإنجاز من حقّ طالب المعاملة'
      using errcode = 'insufficient_privilege';
  end if;

  update public.transactions
     set status = 'completed', is_closed = true, closed_at = now()
   where id = p_transaction_id;
end;
$$;

-- ── إلغاء المعاملة ─────────────────────────────────────────────────────
create or replace function public.cancel_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission('transaction.override') then
    raise exception 'إلغاء المعاملة يتطلّب صلاحية transaction.override'
      using errcode = 'insufficient_privilege';
  end if;

  perform 1 from public.transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;

  update public.transaction_assignments
     set status = 'cancelled'
   where transaction_id = p_transaction_id and status in ('pending', 'in_progress');

  update public.transaction_stage_instances
     set status = 'cancelled'
   where transaction_id = p_transaction_id and status in ('pending', 'in_progress');

  update public.transactions
     set status = 'cancelled', is_closed = true, closed_at = now()
   where id = p_transaction_id;
end;
$$;

-- ── الخصوصية [المراسلات 19] ────────────────────────────────────────────
create or replace function public.is_transaction_participant(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.transactions t
    where t.id = p_transaction_id and t.requested_by = (select auth.uid())
  ) or exists (
    select 1 from public.transaction_assignments a
    where a.transaction_id = p_transaction_id
      and a.assignee_id = (select auth.uid())
  );
$$;

-- ── الخطابات الآلية: تُستبدل كليًّا بالمجدوِل في المرحلة ٠٤ ─────────────
create or replace function public.run_auto_letters()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule public.auto_letter_rules%rowtype;
  v_definition public.workflow_definitions%rowtype;
  v_start public.workflow_stages%rowtype;
  v_transaction_id uuid;
  v_created int := 0;
begin
  for v_rule in
    select * from public.auto_letter_rules
    where is_active and next_run_at <= now()
  loop
    select * into v_definition
      from public.workflow_definitions
     where transaction_type = v_rule.transaction_type and is_active;

    if found then
      select * into v_start
        from public.workflow_stages
       where definition_id = v_definition.id and is_start;
      if not found then
        select * into v_start
          from public.workflow_stages
         where definition_id = v_definition.id
         order by sort_order, created_at limit 1;
      end if;

      if found then
        insert into public.transactions
          (type, subject, project_id, entity_type, entity_id, definition_id,
           status, requested_by)
        values
          (v_rule.transaction_type, v_rule.subject, v_rule.project_id,
           'auto_letter_rule', v_rule.id, v_definition.id, 'in_progress', null)
        returning id into v_transaction_id;

        perform public.open_stage_instance(v_transaction_id, v_start.id);
        v_created := v_created + 1;
      end if;
    end if;

    update public.auto_letter_rules
       set last_run_at = now(),
           next_run_at = case
             when repeat and interval_days is not null
               then now() + make_interval(days => interval_days)
             else next_run_at
           end,
           is_active = case
             when repeat and interval_days is not null then is_active
             else false
           end
     where id = v_rule.id;
  end loop;

  return v_created;
end;
$$;

-- ── الصلاحيات على الدوال ───────────────────────────────────────────────
revoke execute on function
  public.business_minutes_between(timestamptz, timestamptz, uuid),
  public.add_business_minutes(timestamptz, integer, uuid),
  public.resolve_stage_participants(uuid, uuid),
  public.start_transaction(text, text, uuid, text, uuid),
  public.set_assignment_duration(uuid, integer, text, text),
  public.receive_assignment(uuid),
  public.complete_assignment(uuid, text),
  public.close_transaction(uuid),
  public.cancel_transaction(uuid),
  public.is_transaction_participant(uuid)
  from public, anon;

-- داخلية بحتة: تُستدعى من داخل الدوال أعلاه فقط، فلا تُمنح لأحد
revoke execute on function public.open_stage_instance(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.run_auto_letters()
  from public, anon, authenticated;

grant execute on function
  public.business_minutes_between(timestamptz, timestamptz, uuid),
  public.add_business_minutes(timestamptz, integer, uuid),
  public.resolve_stage_participants(uuid, uuid),
  public.start_transaction(text, text, uuid, text, uuid),
  public.set_assignment_duration(uuid, integer, text, text),
  public.receive_assignment(uuid),
  public.complete_assignment(uuid, text),
  public.close_transaction(uuid),
  public.cancel_transaction(uuid),
  public.is_transaction_participant(uuid)
  to authenticated;

grant execute on function public.run_auto_letters() to service_role;
