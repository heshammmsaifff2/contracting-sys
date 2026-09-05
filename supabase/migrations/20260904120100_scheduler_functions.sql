-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٤ — دوال المجدوِل
--
-- `cron` ليست من أنواع الجدولة المدعومة رغم ذكرها في مسودّة القرار: كتابة
-- مفسّر cron في plpgsql مساحةُ خطأ كبيرة مقابل فائدة صغيرة، والأنواع الستّة
-- تغطّي ما طُلب. أمّا pg_cron فيبقى — لكنه يقرّر متى يعمل **المشغِّل**، لا
-- متى تستحقّ كل مهمة.
-- ═══════════════════════════════════════════════════════════════════════

/** يملأ قوالب {{key}} من سياق المهمة. */
create or replace function public.render_template(
  p_template text,
  p_context jsonb
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $fn$
declare
  v_out text := coalesce(p_template, '');
  v_key text;
  v_val text;
begin
  if p_context is null or jsonb_typeof(p_context) <> 'object' then
    return v_out;
  end if;

  for v_key, v_val in
    select key, coalesce(value #>> '{}', '') from jsonb_each(p_context)
  loop
    v_out := replace(v_out, '{{' || v_key || '}}', v_val);
  end loop;

  return v_out;
end;
$fn$;

/**
 * الجمهور محلولًا إلى موظفين نشطين.
 * يُحلّ **وقت التشغيل**: من انضمّ للقسم أمس يصله تعميم اليوم، ومن ترك العمل
 * لا يصله — بلا تعديل القاعدة.
 */
create or replace function public.resolve_audience(p_audience jsonb)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  with spec as (
    select coalesce(p_audience ->> 'scope', 'company') as scope,
           array(
             select (e.value #>> '{}')::uuid
             from jsonb_array_elements(coalesce(p_audience -> 'ids', '[]'::jsonb)) e
           ) as ids
  )
  select p.id
  from public.profiles p, spec s
  where p.is_active
    and (
      s.scope = 'company'
      or (s.scope = 'users' and p.id = any (s.ids))
      or (s.scope = 'department' and p.department_id = any (s.ids))
      or (s.scope = 'role' and exists (
            select 1 from public.user_roles ur
            where ur.user_id = p.id and ur.role_id = any (s.ids)))
      or (s.scope = 'project' and exists (
            select 1 from public.project_assignments pa
            where pa.user_id = p.id and pa.project_id = any (s.ids)))
    );
$fn$;

/** يزيح لحظة محلّية إلى أول يوم عمل — الدوام العام لا دوام موظف بعينه. */
create or replace function public.shift_to_workday(p_local timestamp)
returns timestamp
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
declare
  v_date date := p_local::date;
  v_time time := p_local::time;
  v_i integer;
begin
  for v_i in 0 .. 370 loop
    if not exists (
         select 1 from public.holidays h
         where h.holiday_date = v_date and h.scope = 'global'
       )
       and exists (
         select 1 from public.work_schedules ws
         where ws.scope = 'global'
           and ws.day_of_week = extract(dow from v_date)::smallint
       )
    then
      return v_date + v_time;
    end if;
    v_date := v_date + 1;
  end loop;

  -- لا دوام معرَّف إطلاقًا: لا تُزَح بلا نهاية
  return p_local;
end;
$fn$;

/**
 * الموعد التالي بعد لحظة، بتوقيت الشركة.
 * يُحسب من **الموعد المستحقّ** لا من لحظة التشغيل، فلا ينزلق التوقيت دقيقةً
 * كل مرة حين يتأخّر المشغِّل.
 */
create or replace function public.compute_next_run(
  p_kind text,
  p_spec jsonb,
  p_after timestamptz default now(),
  p_shift boolean default false
)
returns timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
declare
  v_tz text := public.app_timezone();
  v_after timestamp;
  v_time time;
  v_next timestamp;
  v_date date;
  v_days integer[];
  v_dom integer;
  v_month integer;
  v_i integer;
begin
  v_after := coalesce(p_after, now()) at time zone v_tz;
  v_time := coalesce(nullif(p_spec ->> 'time', '')::time, time '09:00');

  if p_kind = 'once' then
    -- لحظة صريحة لا تتكرّر
    return nullif(p_spec ->> 'at', '')::timestamptz;

  elsif p_kind = 'daily' then
    v_next := v_after::date + v_time;
    if v_next <= v_after then
      v_next := (v_after::date + 1) + v_time;
    end if;

  elsif p_kind = 'weekly' then
    select coalesce(array_agg((e.value #>> '{}')::integer), array[0])
      into v_days
      from jsonb_array_elements(coalesce(p_spec -> 'days', '[0]'::jsonb)) e;

    v_next := null;
    for v_i in 0 .. 7 loop
      v_date := v_after::date + v_i;
      if extract(dow from v_date)::integer = any (v_days) then
        v_next := v_date + v_time;
        exit when v_next > v_after;
        v_next := null;
      end if;
    end loop;

  elsif p_kind = 'monthly' then
    -- ٢٨ سقفًا: لا يوم ٣١ يضيع في فبراير
    v_dom := least(greatest(coalesce((p_spec ->> 'day_of_month')::integer, 1), 1), 28);
    v_next := (date_trunc('month', v_after)::date + (v_dom - 1)) + v_time;
    if v_next <= v_after then
      v_next := ((date_trunc('month', v_after) + interval '1 month')::date
                 + (v_dom - 1)) + v_time;
    end if;

  elsif p_kind = 'quarterly' then
    v_dom := least(greatest(coalesce((p_spec ->> 'day_of_month')::integer, 1), 1), 28);
    v_next := null;
    for v_i in 0 .. 4 loop
      v_date := (date_trunc('quarter', v_after)
                 + make_interval(months => 3 * v_i))::date + (v_dom - 1);
      v_next := v_date + v_time;
      exit when v_next > v_after;
      v_next := null;
    end loop;

  elsif p_kind = 'yearly' then
    v_month := least(greatest(coalesce((p_spec ->> 'month')::integer, 1), 1), 12);
    v_dom := least(greatest(coalesce((p_spec ->> 'day')::integer, 1), 1), 28);
    v_next := make_date(extract(year from v_after)::integer, v_month, v_dom) + v_time;
    if v_next <= v_after then
      v_next := make_date(extract(year from v_after)::integer + 1, v_month, v_dom)
                + v_time;
    end if;

  else
    raise exception 'نوع جدولة غير مدعوم: %', p_kind using errcode = 'check_violation';
  end if;

  if v_next is null then
    return null;
  end if;

  if p_shift then
    v_next := public.shift_to_workday(v_next);
  end if;

  return v_next at time zone v_tz;
end;
$fn$;

/** معاينة «متى تعمل بعد ذلك» — تُعرض في شاشة المهام قبل الحفظ. */
create or replace function public.preview_schedule(
  p_kind text,
  p_spec jsonb,
  p_shift boolean default false,
  p_count integer default 5
)
returns setof timestamptz
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
declare
  v_at timestamptz := now();
  v_i integer;
begin
  for v_i in 1 .. least(greatest(coalesce(p_count, 5), 1), 12) loop
    v_at := public.compute_next_run(p_kind, p_spec, v_at, p_shift);
    exit when v_at is null;
    return next v_at;
    exit when p_kind = 'once';
  end loop;
end;
$fn$;

-- ── الجمهور يصير مشاركين ───────────────────────────────────────────────
/**
 * يحلّ مشاركي المرحلة إلى موظفين فعليين.
 * `audience` يقرأ من `transactions.audience_ids` — وهو ما يجعل تعميمًا على
 * خمسين موظفًا مرحلةً واحدة بخمسين مشاركًا بلا كود خاصّ بالخطابات.
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
as $fn$
  with tx as (
    select t.requested_by, coalesce(t.audience_ids, '{}'::uuid[]) as audience_ids
    from public.transactions t
    where t.id = p_transaction_id
  ),
  matched as (
    select sp.id as participant_id, sp.is_optional, sp.sort_order, p.id as assignee_id
    from public.workflow_stage_participants sp
    -- ضمّ لا استعلام قياسي: `= any(...)` يريد مصفوفةً عمودًا لا استعلامًا
    left join tx on true
    join public.profiles p
      on p.is_active
     and (
       (sp.kind = 'user' and p.id = sp.user_id)
       or (sp.kind = 'requester' and p.id = tx.requested_by)
       or (sp.kind = 'audience' and p.id = any (tx.audience_ids))
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
  select distinct on (m.assignee_id) m.assignee_id, m.participant_id, m.is_optional
  from matched m
  order by m.assignee_id, m.is_optional, m.sort_order, m.participant_id;
$fn$;

-- ── التشغيل ────────────────────────────────────────────────────────────
/**
 * يشغّل مهمة واحدة ويقدّم موعدها التالي.
 * الفشل يُسجَّل ولا يُسقط بقيّة المهام، والموعد يتقدّم على كل حال حتى لا
 * تدور مهمة معطوبة على كل نبضة.
 */
create or replace function public.fire_scheduled_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_task public.scheduled_tasks%rowtype;
  v_definition public.workflow_definitions%rowtype;
  v_start public.workflow_stages%rowtype;
  v_audience uuid[];
  v_subject text;
  v_body text;
  v_tx uuid;
  v_notified integer := 0;
  v_run_id uuid;
  v_next timestamptz;
  v_err text := null;
begin
  select * into v_task from public.scheduled_tasks where id = p_task_id for update;
  if not found then
    raise exception 'المهمة غير موجودة' using errcode = 'no_data_found';
  end if;

  begin
    select coalesce(array_agg(a), '{}'::uuid[]) into v_audience
      from public.resolve_audience(v_task.audience) a;

    v_subject := public.render_template(v_task.subject_template, v_task.context);
    v_body := public.render_template(v_task.body_template, v_task.context);

    if v_task.action = 'start_workflow' then
      select * into v_definition
        from public.workflow_definitions
       where transaction_type = v_task.transaction_type and is_active;
      if not found then
        raise exception 'لا يوجد تعريف سير عمل مفعّل للنوع %', v_task.transaction_type
          using errcode = 'no_data_found';
      end if;

      select * into v_start
        from public.workflow_stages
       where definition_id = v_definition.id and is_start;
      if not found then
        select * into v_start
          from public.workflow_stages
         where definition_id = v_definition.id
         order by sort_order, created_at limit 1;
      end if;
      if not found then
        raise exception 'تعريف سير العمل بلا مراحل' using errcode = 'check_violation';
      end if;

      -- requested_by فارغ: النظام هو المُنشئ، فلا «تمام إنجاز» من موظف
      insert into public.transactions
        (type, subject, project_id, entity_type, entity_id, definition_id,
         status, requested_by, context, audience_ids)
      values
        (v_task.transaction_type, v_subject, v_task.project_id,
         'scheduled_task', v_task.id, v_definition.id, 'in_progress', null,
         v_task.context || jsonb_build_object('body', v_body), v_audience)
      returning id into v_tx;

      perform public.open_stage_instance(v_tx, v_start.id);

    else
      insert into public.notifications
        (user_id, kind, title, body, entity_type, entity_id, project_id)
      select u, 'scheduled_task', v_subject, v_body,
             'scheduled_task', v_task.id, v_task.project_id
      from unnest(v_audience) u;
      get diagnostics v_notified = row_count;
    end if;

    insert into public.scheduled_task_runs
      (task_id, scheduled_for, status, audience_count,
       created_transaction_ids, notified_count)
    values
      (p_task_id, v_task.next_run_at, 'ok',
       coalesce(array_length(v_audience, 1), 0),
       case when v_tx is null then '{}'::uuid[] else array[v_tx] end,
       v_notified)
    returning id into v_run_id;

  exception when others then
    v_err := sqlerrm;
    insert into public.scheduled_task_runs
      (task_id, scheduled_for, status, error)
    values (p_task_id, v_task.next_run_at, 'error', v_err)
    returning id into v_run_id;
  end;

  if v_task.schedule_kind = 'once' then
    update public.scheduled_tasks
       set is_active = false,
           last_run_at = now(),
           run_count = run_count + 1,
           last_status = case when v_err is null then 'ok' else 'error' end,
           last_error = coalesce(v_err, '')
     where id = p_task_id;
  else
    v_next := public.compute_next_run(
      v_task.schedule_kind, v_task.schedule_spec,
      v_task.next_run_at, v_task.shift_to_workday);

    update public.scheduled_tasks
       set next_run_at = coalesce(v_next, now() + interval '1 day'),
           last_run_at = now(),
           run_count = run_count + 1,
           last_status = case when v_err is null then 'ok' else 'error' end,
           last_error = coalesce(v_err, '')
     where id = p_task_id;
  end if;

  return v_run_id;
end;
$fn$;

/** المشغِّل: ينادَى بنبضة من pg_cron. */
create or replace function public.run_scheduled_tasks()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
  v_n integer := 0;
begin
  -- skip locked: نبضتان متزامنتان لا تشغّلان المهمة نفسها مرّتين
  for v_id in
    select id from public.scheduled_tasks
     where is_active and next_run_at <= now()
     order by next_run_at
     limit 200
     for update skip locked
  loop
    perform public.fire_scheduled_task(v_id);
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$fn$;

/** تشغيل يدوي لمهمة بعينها — لاختبارها دون انتظار موعدها. */
create or replace function public.run_scheduled_task_now(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.has_permission('schedule.manage') then
    raise exception 'التشغيل اليدوي يتطلّب صلاحية schedule.manage'
      using errcode = 'insufficient_privilege';
  end if;
  return public.fire_scheduled_task(p_task_id);
end;
$fn$;

-- ── إسقاط الخطابات الآلية القديمة ──────────────────────────────────────
-- استُبدلت بالمجدوِل العام: كانت تبدأ نوعًا واحدًا لقائمة ثابتة من المستلمين،
-- بلا سجلّ تشغيل ولا جدولة أدقّ من «كل كذا يومًا».
drop function if exists public.run_auto_letters();
drop table if exists public.auto_letter_rules;
delete from public.permissions where key = 'auto_letter.manage';

-- ── الصلاحيات على الدوال ───────────────────────────────────────────────
revoke execute on function
  public.render_template(text, jsonb),
  public.resolve_audience(jsonb),
  public.shift_to_workday(timestamp),
  public.compute_next_run(text, jsonb, timestamptz, boolean),
  public.preview_schedule(text, jsonb, boolean, integer),
  public.validate_audience(jsonb),
  public.resolve_stage_participants(uuid, uuid),
  public.run_scheduled_task_now(uuid)
  from public, anon;

-- داخلية: تُستدعى من المشغِّل أو من التشغيل اليدوي المحكوم بصلاحية
revoke execute on function
  public.fire_scheduled_task(uuid),
  public.run_scheduled_tasks()
  from public, anon, authenticated;

grant execute on function
  public.render_template(text, jsonb),
  public.resolve_audience(jsonb),
  public.shift_to_workday(timestamp),
  public.compute_next_run(text, jsonb, timestamptz, boolean),
  public.preview_schedule(text, jsonb, boolean, integer),
  public.validate_audience(jsonb),
  public.resolve_stage_participants(uuid, uuid),
  public.run_scheduled_task_now(uuid)
  to authenticated;

grant execute on function public.run_scheduled_tasks() to service_role;
