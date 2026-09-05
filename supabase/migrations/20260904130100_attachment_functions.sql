-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٣ — دوال المرفقات، وفرض `requires_attachment`
--
-- الفرض هنا لا في الواجهة: زرّ يشترط مرفقًا لا يُنفَّذ بلا مرفق مرفوع على
-- التكليف نفسه — مهما قالت الواجهة.
-- ═══════════════════════════════════════════════════════════════════════

/** هل يرى هذا المستخدم هذا المرفق؟ */
create or replace function public.can_view_attachment(p_attachment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from public.transaction_attachments a
    where a.id = p_attachment_id
      -- أولًا: لا بدّ أن يرى المعاملة أصلًا [المراسلات 19]
      and (
        public.has_permission('transaction.read_all')
        or public.is_transaction_participant(a.transaction_id)
      )
      and (
        a.visibility = 'participants'
        or (a.visibility = 'department' and (
              public.has_permission('attachment.read_restricted')
              or exists (
                select 1 from public.profiles p
                where p.id = (select auth.uid())
                  and p.department_id = a.department_id)))
        or (a.visibility = 'permission'
            and public.has_permission(a.required_permission))
      )
  );
$fn$;

/**
 * إضافة مرفق. المرفق يُربَط بتكليف مفتوح للمستخدم نفسه — فلا يُرفَع على
 * معاملة لا يد له فيها، ولا على مرحلة انتهى دوره فيها.
 */
create or replace function public.add_transaction_attachment(
  p_transaction_id uuid,
  p_name text,
  p_file jsonb,
  p_assignment_id uuid default null,
  p_content_type text default '',
  p_size_bytes bigint default 0,
  p_visibility text default 'participants',
  p_department_id uuid default null,
  p_required_permission text default null,
  p_is_authenticated boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_a public.transaction_assignments%rowtype;
  v_id uuid;
  v_stage uuid;
begin
  if p_file is null or jsonb_typeof(p_file) <> 'object'
     or not (p_file ? 'public_id') or not (p_file ? 'url') then
    raise exception 'مرجع الملف غير صالح' using errcode = 'check_violation';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'اسم المرفق مطلوب' using errcode = 'check_violation';
  end if;

  if p_assignment_id is not null then
    select * into v_a from public.transaction_assignments
     where id = p_assignment_id;
    if not found then
      raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
    end if;
    if v_a.transaction_id is distinct from p_transaction_id then
      raise exception 'التكليف لا يخصّ هذه المعاملة' using errcode = 'check_violation';
    end if;
    if v_a.assignee_id is distinct from auth.uid()
       and not public.has_permission('transaction.override') then
      raise exception 'الإرفاق من المكلَّف وحده'
        using errcode = 'insufficient_privilege';
    end if;
    if v_a.status <> 'in_progress'
       and not public.has_permission('transaction.override') then
      raise exception 'انتهى دورك في هذه المرحلة' using errcode = 'check_violation';
    end if;
    v_stage := v_a.stage_instance_id;
  else
    -- مرفق عام على المعاملة: للموقّعين عليها
    if not public.is_transaction_participant(p_transaction_id)
       and not public.has_permission('transaction.override') then
      raise exception 'الإرفاق للموقّعين على المعاملة'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  insert into public.transaction_attachments
    (transaction_id, assignment_id, stage_instance_id, name, file,
     content_type, size_bytes, visibility, department_id, required_permission,
     is_authenticated, uploaded_by)
  values
    (p_transaction_id, p_assignment_id, v_stage, btrim(p_name), p_file,
     coalesce(p_content_type, ''), greatest(coalesce(p_size_bytes, 0), 0),
     coalesce(p_visibility, 'participants'), p_department_id,
     nullif(btrim(coalesce(p_required_permission, '')), ''),
     coalesce(p_is_authenticated, false), auth.uid())
  returning id into v_id;

  return v_id;
end;
$fn$;

/**
 * حذف مرفق.
 *
 * المرفق المختوم بإجراء **لا يُحذف مطلقًا** — ولا بصلاحية التجاوز: هو دليل
 * صار جزءًا من الخطّ الزمني، وحذفه يجعل السجلّ يكذب. وهو الاصطلاح نفسه في
 * القيود المحاسبية بعد ترحيلها وفي سجلّ تعديل المدد.
 *
 * وقبل الإجراء: يحذفه من رفعه ما دام تكليفه مفتوحًا، أو صاحب صلاحية التجاوز.
 *
 * وملفّ Cloudinary نفسه يُحذف من الواجهة عبر Edge Function — القاعدة لا تملك
 * `api_secret` ولا يجوز أن تملكه.
 */
create or replace function public.remove_transaction_attachment(p_attachment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_att public.transaction_attachments%rowtype;
  v_status text;
begin
  select * into v_att from public.transaction_attachments where id = p_attachment_id;
  if not found then
    raise exception 'المرفق غير موجود' using errcode = 'no_data_found';
  end if;

  -- الختم يسبق كل صلاحية
  if v_att.action_log_id is not null then
    raise exception 'المرفق صار جزءًا من الخطّ الزمني ولا يُحذف'
      using errcode = 'check_violation';
  end if;

  if not public.has_permission('transaction.override') then
    if v_att.uploaded_by is distinct from auth.uid() then
      raise exception 'الحذف لمن رفع المرفق' using errcode = 'insufficient_privilege';
    end if;
    if v_att.assignment_id is not null then
      select status into v_status
        from public.transaction_assignments where id = v_att.assignment_id;
      if v_status is distinct from 'in_progress' then
        raise exception 'لا حذف بعد اتخاذ الإجراء'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  delete from public.transaction_attachments where id = p_attachment_id;

  -- تُعاد لتحذف الواجهةُ الأصلَ من المزوّد
  return v_att.file;
end;
$fn$;

-- ── فرض «يتطلّب مرفقًا» ────────────────────────────────────────────────
-- إعادة تعريف `complete_assignment` بإضافة الفحص وختم المرفقات بالإجراء.
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
  v_log_id uuid;
begin
  select * into v_a from public.transaction_assignments where id = p_assignment_id;
  if not found then
    raise exception 'التكليف غير موجود' using errcode = 'no_data_found';
  end if;

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
    -- المرفق يُرفَع قبل الضغط، فوجوده شرط لا نتيجة
    if v_action.requires_attachment and not exists (
      select 1 from public.transaction_attachments att
      where att.assignment_id = p_assignment_id
    ) then
      raise exception 'هذا الإجراء يتطلّب إرفاق مستند'
        using errcode = 'check_violation';
    end if;
  end if;

  if v_action.id is not null and v_action.kind = 'note' then
    insert into public.transaction_action_log
      (transaction_id, stage_instance_id, assignment_id, action_id,
       action_key, action_label, kind, notes, acted_by)
    values
      (v_tx.id, v_si.id, v_a.id, v_action.id,
       v_action.action_key, v_action.label, 'note', coalesce(p_notes, ''), auth.uid())
    returning id into v_log_id;

    -- المرفقات غير المختومة تُنسب لهذه الملاحظة
    update public.transaction_attachments
       set action_log_id = v_log_id
     where assignment_id = p_assignment_id and action_log_id is null;

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
     coalesce(p_notes, ''), auth.uid())
  returning id into v_log_id;

  update public.transaction_attachments
     set action_log_id = v_log_id
   where assignment_id = p_assignment_id and action_log_id is null;

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
   where stage_instance_id = v_si.id and status in ('pending', 'in_progress');

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

-- ── الصلاحيات ──────────────────────────────────────────────────────────
revoke execute on function
  public.can_view_attachment(uuid),
  public.add_transaction_attachment(
    uuid, text, jsonb, uuid, text, bigint, text, uuid, text, boolean),
  public.remove_transaction_attachment(uuid),
  public.complete_assignment(uuid, text, text)
  from public, anon;

grant execute on function
  public.can_view_attachment(uuid),
  public.add_transaction_attachment(
    uuid, text, jsonb, uuid, text, bigint, text, uuid, text, boolean),
  public.remove_transaction_attachment(uuid),
  public.complete_assignment(uuid, text, text)
  to authenticated;
