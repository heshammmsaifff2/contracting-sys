-- ═══════════════════════════════════════════════════════════════════════
-- تفعيل المرحلة يُثبّت موعدها · والمشغِّل الدوريّ ينبّه على المتجاوِز
-- ═══════════════════════════════════════════════════════════════════════

/**
 * `populate_stage_assignments` هي الموضع الوحيد الذي تنتقل فيه المرحلة إلى
 * `in_progress` — عند الفتح المباشر وعند تفعيل الالتقاء المؤجَّل معًا —
 * فهي موضع حساب الموعد. ومرحلة الالتقاء تُنشأ معلَّقة وقد تبدأ بعد يوم،
 * فحسابُ موعدها من إنشاء صفّها يظلمها.
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

    if v_duration.id is not null and v_duration.duration_scope = 'single' then
      delete from public.step_duration_settings where id = v_duration.id;
    end if;

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    update public.transaction_stage_instances
       set status = 'pending'
     where id = p_instance_id;
  else
    update public.transaction_stage_instances
       set status = 'in_progress',
           entered_at = now(),
           is_deferred_join = false,
           deadline_at = public.stage_deadline_for(v_si.stage_id, now()),
           deadline_action = case
             when v_stage.deadline_spec is null then null
             else v_stage.deadline_action end,
           deadline_notified_at = null
     where id = p_instance_id;
  end if;

  return v_count;
end;
$fn$;

/**
 * ينبّه مرّةً واحدة على كل مرحلة تجاوزت موعدها.
 * `deadline_notified_at` يمنع التكرار كل خمس دقائق، و`limit` يمنع دورةً
 * واحدة من أن تبتلع القاعدة لو تراكم متأخّر كثير.
 */
create or replace function public.run_stage_deadlines()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_si record;
  v_count integer := 0;
  v_who uuid[];
begin
  for v_si in
    select si.id, si.transaction_id, si.name, si.deadline_at, si.deadline_action,
           t.subject, t.project_id
      from public.transaction_stage_instances si
      join public.transactions t on t.id = si.transaction_id
     where si.deadline_at is not null
       and si.deadline_notified_at is null
       and si.status = 'in_progress'
       and si.deadline_at <= now()
     order by si.deadline_at
     limit 500
  loop
    select coalesce(array_agg(a.assignee_id), '{}'::uuid[]) into v_who
      from public.transaction_assignments a
     where a.stage_instance_id = v_si.id
       and a.status in ('in_progress', 'on_hold');

    if array_length(v_who, 1) is not null then
      insert into public.notifications
        (user_id, kind, title, body, entity_type, entity_id, project_id)
      select u, 'transaction_deadline',
             'تجاوزت المعاملة موعدها: ' || v_si.name,
             coalesce(v_si.subject, '') || ' — الموعد كان '
               || to_char(v_si.deadline_at at time zone public.app_timezone(),
                          'YYYY-MM-DD HH24:MI'),
             'transaction', v_si.transaction_id, v_si.project_id
        from unnest(v_who) u;
    end if;

    if v_si.deadline_action = 'escalate' then
      insert into public.notifications
        (user_id, kind, title, body, entity_type, entity_id, project_id)
      select u, 'transaction_deadline',
             'تصعيد — تأخّر عن الموعد: ' || v_si.name,
             coalesce(v_si.subject, ''),
             'transaction', v_si.transaction_id, v_si.project_id
        from public.users_to_notify('transaction.read_all') u
       where not (u = any (v_who));
    end if;

    update public.transaction_stage_instances
       set deadline_notified_at = now()
     where id = v_si.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

comment on function public.run_stage_deadlines() is
  'ينبّه على المراحل التي تجاوزت موعدها التقويميّ. يُشغَّل دوريًّا، ولا يُنبّه مرتين.';

-- مُشغِّل لا إجراء: لا يُستدعى من الواجهة
revoke all on function public.run_stage_deadlines() from public, anon, authenticated;

-- كل خمس دقائق: الموعد بالساعة لا بالدقيقة، فلا معنى لدورةٍ كل دقيقة
select cron.schedule('stage-deadlines', '*/5 * * * *',
                     'select public.run_stage_deadlines()');
