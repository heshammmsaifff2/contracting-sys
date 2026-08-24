-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4 — دوال المحرّك. كل الأرقام من جدول الإعدادات لا من الكود.
-- ═══════════════════════════════════════════════════════════════════════

-- درجات الإنجاز حسب نسبة الزمن المستهلك [المراسلات 11] — قابلة للتعديل بالكامل.
insert into public.settings (key, value, description, category) values
  ('completion_score_bands',
   '[{"max_ratio":0.25,"score":100},{"max_ratio":0.5,"score":75},{"max_ratio":1,"score":50},{"max_ratio":2,"score":25},{"max_ratio":null,"score":10}]'::jsonb,
   'درجة الإنجاز حسب نسبة الزمن المستهلك إلى المدة المخصّصة', 'workflow'),
  ('inbox_color_thresholds',
   '{"info":0.5,"warning":0.75,"danger":1}'::jsonb,
   'عتبات ألوان صندوق الوارد: أزرق ثم أصفر ثم أحمر', 'workflow')
on conflict (key) do update set description = excluded.description;

/**
 * درجة الإنجاز من نسبة الزمن الفعلي إلى المدة المخصّصة.
 * ربع المدة ⇒ 100، نصفها ⇒ 75، في الموعد ⇒ 50، ضعفها ⇒ 25، أكثر ⇒ 10.
 */
create or replace function public.score_for_completion(
  p_allocated_minutes integer,
  p_actual_minutes integer
)
returns numeric
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_bands jsonb;
  v_band jsonb;
  v_ratio numeric;
begin
  if p_allocated_minutes is null or p_allocated_minutes <= 0 then
    return null;
  end if;

  v_ratio := coalesce(p_actual_minutes, 0)::numeric / p_allocated_minutes;

  select value into v_bands from public.settings where key = 'completion_score_bands';
  if v_bands is null then
    return null;
  end if;

  for v_band in select * from jsonb_array_elements(v_bands)
  loop
    if v_band ->> 'max_ratio' is null
       or v_ratio <= (v_band ->> 'max_ratio')::numeric then
      return (v_band ->> 'score')::numeric;
    end if;
  end loop;

  return null;
end;
$$;

/** المدة المعتمدة لهذا الموظف في هذا النوع: الموظف أدقّ من الدور أدقّ من النوع. */
create or replace function public.resolve_step_duration(
  p_transaction_type text,
  p_user_id uuid
)
returns public.step_duration_settings
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.*
  from public.step_duration_settings s
  where s.transaction_type = p_transaction_type
    and (
      s.user_id = p_user_id
      or (s.user_id is null and s.role_id in (
            select ur.role_id from public.user_roles ur where ur.user_id = p_user_id))
      or (s.user_id is null and s.role_id is null)
    )
  order by
    case when s.user_id is not null then 0
         when s.role_id is not null then 1
         else 2 end
  limit 1;
$$;

/** الموظف المسؤول عن مرحلة: التوزيع الآلي أولًا، ثم أول من يحمل الدور. */
create or replace function public.resolve_step_assignee(p_step_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_step public.workflow_steps%rowtype;
  v_assignee uuid;
begin
  select * into v_step from public.workflow_steps where id = p_step_id;
  if not found then
    return null;
  end if;

  -- التوزيع الآلي حسب خطة المدير [المراسلات 23]
  if v_step.default_assignee_id is not null then
    return v_step.default_assignee_id;
  end if;

  if v_step.role_id is not null then
    select p.id into v_assignee
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    where ur.role_id = v_step.role_id
      and p.is_active
      and (v_step.department_id is null or p.department_id = v_step.department_id)
    order by p.full_name
    limit 1;
  end if;

  return v_assignee;
end;
$$;

/**
 * ينشئ مرحلة فعلية جديدة ويضبط بدايتها.
 * إن لم توجد مدة معتمدة يُترك allocated_minutes فارغًا، فتقف المعاملة
 * عند مدير البرنامج ليحدّدها [المراسلات 3] ولا يبدأ العدّاد قبل ذلك.
 */
create or replace function public.open_step_instance(
  p_transaction_id uuid,
  p_step_id uuid,
  p_order_no smallint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_type text;
  v_step public.workflow_steps%rowtype;
  v_assignee uuid;
  v_duration public.step_duration_settings;
  v_minutes integer;
  v_instance_id uuid;
begin
  select type into v_type from public.transactions where id = p_transaction_id;
  select * into v_step from public.workflow_steps where id = p_step_id;

  v_assignee := public.resolve_step_assignee(p_step_id);

  if v_assignee is not null then
    v_duration := public.resolve_step_duration(v_type, v_assignee);
    v_minutes := v_duration.minutes;
  end if;

  insert into public.transaction_step_instances
    (transaction_id, step_id, order_no, name, assignee_id,
     allocated_minutes, arrived_at, status)
  values
    (p_transaction_id, p_step_id, p_order_no, coalesce(v_step.name, ''), v_assignee,
     v_minutes, now(), 'in_progress')
  returning id into v_instance_id;

  -- مدة لمرة واحدة تُستهلك بعد استخدامها فتُسأل من جديد لاحقًا [المراسلات 2]
  if v_duration.id is not null and v_duration.duration_scope = 'single' then
    delete from public.step_duration_settings where id = v_duration.id;
  end if;

  update public.transactions
     set current_step_instance_id = v_instance_id
   where id = p_transaction_id;

  return v_instance_id;
end;
$$;

/** يبدأ معاملة جديدة على تعريف سير العمل الخاص بنوعها. */
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
  v_first_step public.workflow_steps%rowtype;
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

  select * into v_first_step
    from public.workflow_steps
   where definition_id = v_definition.id
   order by order_no
   limit 1;

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

  perform public.open_step_instance(v_transaction_id, v_first_step.id, v_first_step.order_no);

  return v_transaction_id;
end;
$$;

/**
 * مدير البرنامج يحدّد مدة المرحلة (أو يعدّلها حتى بعد انتهائها [المراسلات 4]).
 * كل تعديل يُسجَّل في duration_change_log ليظهر في تقرير المدد المعدّلة.
 */
create or replace function public.set_step_duration(
  p_step_instance_id uuid,
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
  v_instance public.transaction_step_instances%rowtype;
  v_type text;
begin
  if not public.has_permission('duration.manage') then
    raise exception 'تحديد المدد يتطلّب صلاحية duration.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if p_minutes is null or p_minutes <= 0 then
    raise exception 'المدة يجب أن تكون أكبر من صفر' using errcode = 'check_violation';
  end if;

  select * into v_instance
    from public.transaction_step_instances where id = p_step_instance_id;
  if not found then
    raise exception 'المرحلة غير موجودة' using errcode = 'no_data_found';
  end if;

  select type into v_type from public.transactions where id = v_instance.transaction_id;

  insert into public.duration_change_log
    (step_instance_id, old_minutes, new_minutes, reason, changed_by)
  values
    (p_step_instance_id, v_instance.allocated_minutes, p_minutes, coalesce(p_reason, ''),
     auth.uid());

  update public.transaction_step_instances
     set allocated_minutes = p_minutes,
         -- العدّاد يبدأ من لحظة تحديد المدة إن لم يكن قد بدأ
         arrived_at = coalesce(arrived_at, now())
   where id = p_step_instance_id;

  -- تُحفظ للمرات القادمة فلا تُسأل مرتين [المراسلات 1، 6]
  if v_instance.assignee_id is not null then
    insert into public.step_duration_settings
      (transaction_type, user_id, minutes, duration_scope, created_by)
    values (v_type, v_instance.assignee_id, p_minutes, p_scope, auth.uid())
    on conflict (transaction_type, user_id) where user_id is not null
    do update set minutes = excluded.minutes, duration_scope = excluded.duration_scope;
  end if;

  -- إعادة احتساب الدرجة إن كانت المرحلة منجزة سلفًا [المراسلات 4]
  if v_instance.status = 'done' and v_instance.completed_at is not null then
    update public.transaction_step_instances
       set score = public.score_for_completion(
             p_minutes,
             public.business_minutes_between(
               coalesce(arrived_at, v_instance.arrived_at),
               completed_at,
               assignee_id))
     where id = p_step_instance_id;
  end if;
end;
$$;

/**
 * إنجاز المرحلة: يحسب الزمن داخل الدوام، يضع الدرجة، وينتقل للمرحلة التالية.
 * إن لم تبقَ مراحل تعود المعاملة لطالبها ليعطي «تمام الإنجاز» [المراسلات 9].
 */
create or replace function public.complete_step(
  p_step_instance_id uuid,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_instance public.transaction_step_instances%rowtype;
  v_transaction public.transactions%rowtype;
  v_next public.workflow_steps%rowtype;
  v_actual integer;
  v_next_id uuid;
begin
  select * into v_instance
    from public.transaction_step_instances where id = p_step_instance_id;
  if not found then
    raise exception 'المرحلة غير موجودة' using errcode = 'no_data_found';
  end if;
  if v_instance.status <> 'in_progress' then
    raise exception 'المرحلة ليست قيد التنفيذ' using errcode = 'check_violation';
  end if;

  -- صاحب المرحلة وحده يُنجزها، ما لم يملك صلاحية التجاوز
  if v_instance.assignee_id is distinct from auth.uid()
     and not public.has_permission('transaction.override') then
    raise exception 'لست المسؤول عن هذه المرحلة'
      using errcode = 'insufficient_privilege';
  end if;

  if v_instance.allocated_minutes is null then
    raise exception 'لم تُحدَّد مدة هذه المرحلة بعد — تمرّ على مدير البرنامج أولًا'
      using errcode = 'check_violation';
  end if;

  select * into v_transaction
    from public.transactions where id = v_instance.transaction_id;

  v_actual := public.business_minutes_between(
    v_instance.arrived_at, now(), v_instance.assignee_id);

  update public.transaction_step_instances
     set status = 'done',
         completed_at = now(),
         notes = coalesce(p_notes, ''),
         score = public.score_for_completion(v_instance.allocated_minutes, v_actual)
   where id = p_step_instance_id;

  select * into v_next
    from public.workflow_steps
   where definition_id = v_transaction.definition_id
     and order_no > v_instance.order_no
   order by order_no
   limit 1;

  if found then
    v_next_id := public.open_step_instance(
      v_transaction.id, v_next.id, v_next.order_no);
    return v_next_id;
  end if;

  -- انتهت المراحل: تعود لطالبها ليؤكّد تمام الإنجاز
  update public.transactions
     set status = 'awaiting_confirmation', current_step_instance_id = null
   where id = v_transaction.id;

  return null;
end;
$$;

/** طالب المعاملة يعطي «تمام الإنجاز» فيتوقّف العدّاد وتظهر منجَزة [المراسلات 9]. */
create or replace function public.close_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.transactions%rowtype;
begin
  select * into v_transaction from public.transactions where id = p_transaction_id;
  if not found then
    raise exception 'المعاملة غير موجودة' using errcode = 'no_data_found';
  end if;
  if v_transaction.status <> 'awaiting_confirmation' then
    raise exception 'المعاملة لم تصل بعد لمرحلة تأكيد الإنجاز'
      using errcode = 'check_violation';
  end if;
  if v_transaction.requested_by is distinct from auth.uid()
     and not public.has_permission('transaction.override') then
    raise exception 'تأكيد الإنجاز من حقّ طالب المعاملة'
      using errcode = 'insufficient_privilege';
  end if;

  update public.transactions
     set status = 'completed', is_closed = true, closed_at = now()
   where id = p_transaction_id;
end;
$$;

/** إلغاء المهمة — خيار مدير البرنامج [المراسلات 4]. */
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

  update public.transaction_step_instances
     set status = 'cancelled'
   where transaction_id = p_transaction_id and status in ('pending', 'in_progress');

  update public.transactions
     set status = 'cancelled', current_step_instance_id = null, is_closed = true,
         closed_at = now()
   where id = p_transaction_id;
end;
$$;

revoke execute on function public.score_for_completion(integer, integer) from public, anon;
revoke execute on function public.resolve_step_duration(text, uuid) from public, anon;
revoke execute on function public.resolve_step_assignee(uuid) from public, anon;
revoke execute on function public.open_step_instance(uuid, uuid, smallint)
  from public, anon, authenticated;
revoke execute on function public.start_transaction(text, text, uuid, text, uuid)
  from public, anon;
revoke execute on function public.set_step_duration(uuid, integer, text, text)
  from public, anon;
revoke execute on function public.complete_step(uuid, text) from public, anon;
revoke execute on function public.close_transaction(uuid) from public, anon;
revoke execute on function public.cancel_transaction(uuid) from public, anon;

grant execute on function public.score_for_completion(integer, integer) to authenticated;
grant execute on function public.resolve_step_duration(text, uuid) to authenticated;
grant execute on function public.resolve_step_assignee(uuid) to authenticated;
grant execute on function public.start_transaction(text, text, uuid, text, uuid)
  to authenticated;
grant execute on function public.set_step_duration(uuid, integer, text, text)
  to authenticated;
grant execute on function public.complete_step(uuid, text) to authenticated;
grant execute on function public.close_transaction(uuid) to authenticated;
grant execute on function public.cancel_transaction(uuid) to authenticated;
