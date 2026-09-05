-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٥ — دوال أدوات التشغيل
--
-- كلّها تكتب في `transaction_action_log` فيظهر أثرها في الخطّ الزمني نفسه
-- الذي تظهر فيه الإجراءات — لا في سجلّ منفصل لا ينظر إليه أحد.
-- ═══════════════════════════════════════════════════════════════════════

/** صلاحية مسمّاة، أو التجاوز مظلّةً فوقها. */
create or replace function public.has_workflow_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select public.has_permission(p_key) or public.has_permission('transaction.override');
$fn$;

-- ── التحويل داخل القسم ─────────────────────────────────────────────────
/** من يصلح لاستلام هذا التكليف: زملاء القسم النشطون، بلا صاحبه ولا من عليه تكليف. */
create or replace function public.transfer_targets(p_assignment_id uuid)
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  with a as (
    select ta.assignee_id, ta.stage_instance_id
    from public.transaction_assignments ta where ta.id = p_assignment_id
  ),
  me as (
    select p.department_id from public.profiles p, a where p.id = a.assignee_id
  )
  select p.id, p.full_name
  from public.profiles p, a, me
  where p.is_active
    and p.id <> a.assignee_id
    and p.department_id is not distinct from me.department_id
    and me.department_id is not null
    -- لا يُحوَّل إلى من هو مكلَّف بالمرحلة نفسها أصلًا
    and not exists (
      select 1 from public.transaction_assignments x
      where x.stage_instance_id = a.stage_instance_id and x.assignee_id = p.id
    )
  order by p.full_name;
$fn$;

/**
 * تحويل التكليف لزميل في القسم نفسه بسبب إلزامي.
 * التكليف الأصلي يُلغى ويُفتح للمحوَّل إليه **بعدّاد جديد** ومدّته المعتمَدة —
 * فلا يُحاسَب على وقت لم يكن عنده، ولا يرث درجة غيره.
 */
create or replace function public.transfer_assignment(
  p_assignment_id uuid,
  p_to_user_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_a public.transaction_assignments%rowtype;
  v_type text;
  v_duration public.step_duration_settings%rowtype;
  v_minutes integer;
  v_new uuid;
begin
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'سبب التحويل مطلوب' using errcode = 'check_violation';
  end if;

  select * into v_a from public.transaction_assignments
   where id = p_assignment_id for update;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  if v_a.status <> 'in_progress' then
    raise exception 'هذا التكليف ليس قيد التنفيذ' using errcode = 'check_violation';
  end if;

  -- المكلَّف يحوّل تكليفه، وصاحب الصلاحية يحوّل تكليف غيره
  if v_a.assignee_id is distinct from auth.uid()
     and not public.has_workflow_permission('transaction.transfer') then
    raise exception 'التحويل من المكلَّف أو من يملك صلاحية التحويل'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.transfer_targets(p_assignment_id) tt
    where tt.user_id = p_to_user_id
  ) then
    raise exception 'المحوَّل إليه ليس زميلًا مؤهَّلًا في القسم نفسه'
      using errcode = 'check_violation';
  end if;

  select t.type into v_type
    from public.transactions t where t.id = v_a.transaction_id;
  select * into v_duration from public.resolve_step_duration(v_type, p_to_user_id);
  -- مدّة المحوَّل إليه أولًا، وإلا فمدّة سلفه
  v_minutes := coalesce(v_duration.minutes, v_a.allocated_minutes);

  update public.transaction_assignments
     set status = 'cancelled'
   where id = p_assignment_id;

  insert into public.transaction_assignments
    (stage_instance_id, transaction_id, assignee_id, participant_id,
     is_optional, allocated_minutes, arrived_at, status)
  values
    (v_a.stage_instance_id, v_a.transaction_id, p_to_user_id, v_a.participant_id,
     v_a.is_optional, v_minutes, now(), 'in_progress')
  returning id into v_new;

  insert into public.transaction_action_log
    (transaction_id, stage_instance_id, assignment_id, action_key, action_label,
     kind, notes, acted_by)
  values
    (v_a.transaction_id, v_a.stage_instance_id, p_assignment_id,
     'transfer', 'تحويل', 'transfer',
     btrim(p_reason) || ' → ' ||
       coalesce((select full_name from public.profiles where id = p_to_user_id), ''),
     auth.uid());

  insert into public.notifications
    (user_id, kind, title, body, entity_type, entity_id)
  values
    (p_to_user_id, 'transaction_transfer', 'حُوِّلت إليك معاملة',
     btrim(p_reason), 'transaction', v_a.transaction_id);

  return v_new;
end;
$fn$;

-- ── التنبيه والتحذير ───────────────────────────────────────────────────
/**
 * تنبيه أو تحذير على تكليف متأخّر.
 * التنبيه تذكير لا أثر له؛ والتحذير **رسمي يُخصَم من الدرجة** عند الإنجاز.
 */
create or replace function public.send_assignment_alert(
  p_assignment_id uuid,
  p_kind text,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_a public.transaction_assignments%rowtype;
  v_id uuid;
  v_title text;
begin
  if coalesce(p_kind, '') not in ('reminder', 'warning') then
    raise exception 'نوع التنبيه غير معروف' using errcode = 'check_violation';
  end if;

  if not public.has_workflow_permission('transaction.alert') then
    raise exception 'الإرسال يتطلّب صلاحية transaction.alert'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_a from public.transaction_assignments
   where id = p_assignment_id for update;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  if v_a.status <> 'in_progress' then
    raise exception 'لا تنبيه على تكليف منتهٍ' using errcode = 'check_violation';
  end if;

  if p_kind = 'warning' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'التحذير الرسمي يتطلّب سببًا' using errcode = 'check_violation';
  end if;

  insert into public.transaction_alerts
    (transaction_id, assignment_id, kind, reason, sent_by)
  values
    (v_a.transaction_id, p_assignment_id, p_kind, coalesce(btrim(p_reason), ''),
     auth.uid())
  returning id into v_id;

  -- التحذير وحده يُحصى: التذكير لا يُحاسَب عليه أحد
  if p_kind = 'warning' then
    update public.transaction_assignments
       set warnings_count = warnings_count + 1
     where id = p_assignment_id;
  end if;

  v_title := case when p_kind = 'warning'
                  then 'تحذير رسمي: تأخّر في الإجراء'
                  else 'تذكير بمعاملة لديك' end;

  insert into public.transaction_action_log
    (transaction_id, stage_instance_id, assignment_id, action_key, action_label,
     kind, notes, acted_by)
  values
    (v_a.transaction_id, v_a.stage_instance_id, p_assignment_id,
     p_kind, v_title, p_kind, coalesce(btrim(p_reason), ''), auth.uid());

  if v_a.assignee_id is not null then
    insert into public.notifications
      (user_id, kind, title, body, entity_type, entity_id)
    values
      (v_a.assignee_id, 'transaction_' || p_kind, v_title,
       coalesce(btrim(p_reason), ''), 'transaction', v_a.transaction_id);
  end if;

  return v_id;
end;
$fn$;

-- ── مدّ المهلة ─────────────────────────────────────────────────────────
/**
 * مدّ مهلة تكليف جارٍ بسبب.
 *
 * يختلف عن **تعديل المدة**: هذا يزيد مهلة هذا التكليف وحده ولا يُحفَظ
 * للمرات القادمة، فلا يصير الاستثناء قاعدةً بلا قصد. وكلاهما يُسجَّل في
 * تقرير المدد المعدّلة [المراسلات 5].
 */
create or replace function public.extend_assignment_deadline(
  p_assignment_id uuid,
  p_extra_minutes integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_a public.transaction_assignments%rowtype;
begin
  if not public.has_workflow_permission('transaction.extend') then
    raise exception 'مدّ المهلة يتطلّب صلاحية transaction.extend'
      using errcode = 'insufficient_privilege';
  end if;

  if p_extra_minutes is null or p_extra_minutes <= 0 then
    raise exception 'المدّة المضافة يجب أن تكون أكبر من صفر'
      using errcode = 'check_violation';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'سبب المدّ مطلوب' using errcode = 'check_violation';
  end if;

  select * into v_a from public.transaction_assignments
   where id = p_assignment_id for update;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

  if v_a.allocated_minutes is null then
    raise exception 'لا مهلة تُمدّ قبل تحديد المدة' using errcode = 'check_violation';
  end if;

  insert into public.duration_change_log
    (assignment_id, old_minutes, new_minutes, reason, changed_by)
  values
    (p_assignment_id, v_a.allocated_minutes,
     v_a.allocated_minutes + p_extra_minutes,
     'مدّ مهلة: ' || btrim(p_reason), auth.uid());

  update public.transaction_assignments
     set allocated_minutes = allocated_minutes + p_extra_minutes,
         extended_minutes = extended_minutes + p_extra_minutes,
         -- المنجَز سلفًا تُعاد درجته على المهلة الجديدة [المراسلات 4]
         score = case
           when status = 'done' and completed_at is not null
           then public.score_for_completion(
                  allocated_minutes + p_extra_minutes,
                  public.business_minutes_between(arrived_at, completed_at, assignee_id))
           else score
         end
   where id = p_assignment_id;

  insert into public.transaction_action_log
    (transaction_id, stage_instance_id, assignment_id, action_key, action_label,
     kind, notes, acted_by)
  values
    (v_a.transaction_id, v_a.stage_instance_id, p_assignment_id,
     'extend', 'مدّ المهلة', 'extend',
     btrim(p_reason) || ' (+' || p_extra_minutes::text || ')', auth.uid());

  if v_a.assignee_id is not null then
    insert into public.notifications
      (user_id, kind, title, body, entity_type, entity_id)
    values
      (v_a.assignee_id, 'transaction_extend', 'مُدَّت مهلة معاملة لديك',
       btrim(p_reason), 'transaction', v_a.transaction_id);
  end if;
end;
$fn$;

-- ── الإغلاق الإجباري ───────────────────────────────────────────────────
/**
 * إغلاق إداري بسبب. يُلغي كل ما بقي جاريًا، ويُعلَّم `force_closed` فلا
 * يُحتسَب إنجازًا في التقارير ولا يُظنّ أن المسار سار إلى نهايته.
 */
create or replace function public.force_close_transaction(
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
  if not public.has_workflow_permission('transaction.force_close') then
    raise exception 'الإغلاق الإجباري يتطلّب صلاحية transaction.force_close'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'سبب الإغلاق الإجباري مطلوب' using errcode = 'check_violation';
  end if;

  select * into v_tx from public.transactions
   where id = p_transaction_id for update;
  if not found then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;

  if v_tx.is_closed then
    raise exception 'المعاملة مغلقة أصلًا' using errcode = 'check_violation';
  end if;

  update public.transaction_assignments
     set status = 'cancelled'
   where transaction_id = p_transaction_id and status in ('pending', 'in_progress');

  update public.transaction_stage_instances
     set status = 'cancelled'
   where transaction_id = p_transaction_id and status in ('pending', 'in_progress');

  update public.transactions
     set status = 'cancelled', is_closed = true, closed_at = now(),
         force_closed = true, force_close_reason = btrim(p_reason)
   where id = p_transaction_id;

  insert into public.transaction_action_log
    (transaction_id, action_key, action_label, kind, notes, acted_by)
  values
    (p_transaction_id, 'force_close', 'إغلاق إجباري', 'force_close',
     btrim(p_reason), auth.uid());
end;
$fn$;

-- ── الإشارة إلى موظف ───────────────────────────────────────────────────
/**
 * يشير إلى موظفين في آخر ملاحظة على تكليف، فيصلهم إشعار ولو لم يكونوا
 * مكلَّفين. المُشير لا بدّ أن يكون من الموقّعين على المعاملة.
 */
create or replace function public.mention_in_transaction(
  p_action_log_id uuid,
  p_user_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_log public.transaction_action_log%rowtype;
  v_uid uuid;
  v_n integer := 0;
  v_actor text;
begin
  select * into v_log from public.transaction_action_log where id = p_action_log_id;
  if not found then
    raise exception 'السطر غير موجود في الخطّ الزمني' using errcode = 'no_data_found';
  end if;

  if v_log.acted_by is distinct from auth.uid()
     and not public.has_permission('transaction.override') then
    raise exception 'الإشارة من صاحب الملاحظة'
      using errcode = 'insufficient_privilege';
  end if;

  select full_name into v_actor from public.profiles where id = auth.uid();

  foreach v_uid in array coalesce(p_user_ids, '{}'::uuid[]) loop
    if exists (select 1 from public.profiles where id = v_uid and is_active) then
      insert into public.transaction_mentions
        (transaction_id, action_log_id, mentioned_user_id, mentioned_by)
      values (v_log.transaction_id, p_action_log_id, v_uid, auth.uid())
      on conflict (action_log_id, mentioned_user_id) do nothing;

      insert into public.notifications
        (user_id, kind, title, body, entity_type, entity_id)
      values
        (v_uid, 'transaction_mention',
         coalesce(v_actor, '') || ' أشار إليك في معاملة',
         v_log.notes, 'transaction', v_log.transaction_id);

      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end;
$fn$;

-- ── أثر التحذير على الدرجة ─────────────────────────────────────────────
/**
 * الدرجة بعد خصم التحذيرات الرسمية.
 * لا تنزل تحت الصفر، ولا تُخصَم إن لم توجد درجة أصلًا.
 */
create or replace function public.score_after_warnings(
  p_score numeric,
  p_warnings integer
)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select case
    when p_score is null then null
    when coalesce(p_warnings, 0) = 0 then p_score
    else greatest(
      0,
      p_score - coalesce(p_warnings, 0) * coalesce(
        (select (value #>> '{}')::numeric
           from public.settings where key = 'warning_penalty_points'), 10)
    )
  end;
$fn$;

revoke execute on function
  public.has_workflow_permission(text),
  public.transfer_targets(uuid),
  public.transfer_assignment(uuid, uuid, text),
  public.send_assignment_alert(uuid, text, text),
  public.extend_assignment_deadline(uuid, integer, text),
  public.force_close_transaction(uuid, text),
  public.mention_in_transaction(uuid, uuid[]),
  public.score_after_warnings(numeric, integer)
  from public, anon;

grant execute on function
  public.has_workflow_permission(text),
  public.transfer_targets(uuid),
  public.transfer_assignment(uuid, uuid, text),
  public.send_assignment_alert(uuid, text, text),
  public.extend_assignment_deadline(uuid, integer, text),
  public.force_close_transaction(uuid, text),
  public.mention_in_transaction(uuid, uuid[]),
  public.score_after_warnings(numeric, integer)
  to authenticated;
