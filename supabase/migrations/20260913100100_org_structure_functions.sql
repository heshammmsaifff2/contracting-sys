-- ═══════════════════════════════════════════════════════════════════════
-- الهيكل التنظيمي — الدوالّ والمُشغّلات والحرّاس والرؤية
--
-- ١) إصلاح `guard_profile_update`. كان يمرّر كل شيء: يفحص
--    `current_user in ('postgres', …)`، وهو داخل دالّة `security definer`
--    **مالكُها دائمًا** — فالشرط صادق أبدًا. قِيس حيًّا: موظفةٌ بلا صلاحية
--    `user.update` غيّرت تصنيفها بنفسها فقبلته القاعدة. ومع الوظائف كان ذلك
--    ثغرةً: يختار الموظف وظيفة مديرٍ لنفسه فيرث صلاحياتها. والسياق الخادميّ
--    يُعرَف الآن بغياب المستخدم أو بدور `service_role` في رمز الطلب.
--
-- ٢) الموظف يرث قسمه وتصنيفه وصلاحياته من وظيفته، ويسري تعديل الوظيفة
--    أو تصنيف قسمها على شاغليها.
--
-- ٣) حرّاس حذف تقول لماذا: القسم ذو الوظائف أو الموظفين أو المسارات أو
--    المرفقات، والوظيفة ذات الموظفين أو المسارات، والدور الذي تحمله وظيفة.
--
-- ٤) أعضاء المشروع يقرؤون معاملاته كاملةً. ودالّة رؤيةٍ منفصلة عن
--    `is_transaction_participant` عمدًا: تلك تحرس **الإجراء** أيضًا (رفع
--    المرفقات، إيداع الأصل، تعديل السياق)، وتوسيعها يمنح القارئ يدًا.
--
-- ٥) مرفقات القسم المخفية: لا يراها إلّا رافعها وقسمه ومن استُثني بالاسم
--    أو بالقسم. ولا تجاوز لمدير النظام — «على الكل» تعني الكل؛ ومن يلزمه
--    الاطّلاع يُضاف إلى الاستثناء.
--
-- ٦) مشاركو المسار بالوظيفة وبالقسم.
-- ═══════════════════════════════════════════════════════════════════════

-- ── ١) إصلاح الحارس ──────────────────────────────────────────────────
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jwt_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  -- سياقٌ خادميّ: بلا مستخدم (محرّر SQL والهجرات) أو بمفتاح الخادم
  if (select auth.uid()) is null or v_jwt_role = 'service_role' then
    return new;
  end if;

  -- الوظيفة تمنح صلاحياتها، فتغييرها إسنادُ أدوار
  if new.job_id is distinct from old.job_id
     and not public.has_permission('user.assign_role') then
    raise exception
      'تغيير وظيفة الموظف يمنحه صلاحياتها — يتطلّب صلاحية إسناد الأدوار'
      using errcode = 'insufficient_privilege';
  end if;

  if public.has_permission('user.update') then
    return new;
  end if;

  if new.code             is distinct from old.code
     or new.email         is distinct from old.email
     or new.employee_type is distinct from old.employee_type
     or new.department_id is distinct from old.department_id
     or new.job_id        is distinct from old.job_id
     or new.is_active     is distinct from old.is_active then
    raise exception
      'لا تملك صلاحية تعديل الكود أو الوظيفة أو التصنيف أو حالة التفعيل — المسموح لك اسمك فقط'
      using errcode = 'insufficient_privilege';
  end if;

  new.created_by := old.created_by;
  return new;
end;
$$;

-- ── ٢) الموظف يرث قسمه وتصنيفه من وظيفته ─────────────────────────────
-- يُطلَق على القسم والتصنيف كذلك: لا يُكتبان يدويًّا على موظفٍ له وظيفة
create or replace function public.profile_derive_from_job()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dept uuid;
  v_class text;
begin
  if new.job_id is null then
    return new;
  end if;
  select j.department_id, d.classification into v_dept, v_class
    from public.jobs j join public.departments d on d.id = j.department_id
   where j.id = new.job_id;
  new.department_id := v_dept;
  new.employee_type := v_class;
  return new;
end;
$$;

drop trigger if exists profiles_sync_from_job on public.profiles;
create trigger profiles_sync_from_job
  before insert or update of job_id, department_id, employee_type on public.profiles
  for each row execute function public.profile_derive_from_job();

-- ── ٣) صلاحيات الوظيفة تُمنح وتُسحب ──────────────────────────────────
create or replace function public.profile_sync_job_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role uuid;
begin
  -- ما منحته الوظيفة السابقة يُسحب؛ وما أُسند يدويًّا يبقى
  delete from public.user_roles where user_id = new.id and source = 'job';
  if new.job_id is not null then
    select role_id into v_role from public.jobs where id = new.job_id;
    if v_role is not null then
      insert into public.user_roles (user_id, role_id, source)
      values (new.id, v_role, 'job')
      on conflict (user_id, role_id) do nothing;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists profiles_sync_job_role on public.profiles;
create trigger profiles_sync_job_role
  after insert or update of job_id on public.profiles
  for each row execute function public.profile_sync_job_role();

-- ── ٤) تعديل الوظيفة أو تصنيف القسم يسري على الشاغلين ─────────────────
-- إعادة وضع `job_id` على نفسه تُطلق مُشغّلَي الاشتقاق والصلاحية
create or replace function public.job_propagate_to_holders()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role_id is distinct from old.role_id
     or new.department_id is distinct from old.department_id then
    update public.profiles set job_id = job_id where job_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists jobs_propagate on public.jobs;
create trigger jobs_propagate
  after update of role_id, department_id on public.jobs
  for each row execute function public.job_propagate_to_holders();

create or replace function public.department_propagate_to_holders()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.classification is distinct from old.classification then
    update public.profiles set job_id = job_id
     where job_id in (select id from public.jobs where department_id = new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists departments_propagate on public.departments;
create trigger departments_propagate
  after update of classification on public.departments
  for each row execute function public.department_propagate_to_holders();

-- ── ٥) حرّاس الحذف ───────────────────────────────────────────────────
create or replace function public.guard_department_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.jobs where department_id = old.id;
  if v_n > 0 then
    raise exception 'لا يُحذف القسم «%»: فيه % وظيفة — احذف وظائفه أوّلًا', old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_n from public.profiles where department_id = old.id;
  if v_n > 0 then
    raise exception 'لا يُحذف القسم «%»: مسجَّل عليه % موظف', old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_n from public.workflow_stage_participants where department_id = old.id;
  if v_n > 0 then
    raise exception 'لا يُحذف القسم «%»: مستعمل في % موضع من مسارات سير العمل', old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_n from public.transaction_attachments where owner_department_id = old.id;
  if v_n > 0 then
    raise exception 'لا يُحذف القسم «%»: له % مرفق على المعاملات — حذفه يكشف ما أُخفي منها',
      old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists departments_guard_delete on public.departments;
create trigger departments_guard_delete before delete on public.departments
  for each row execute function public.guard_department_delete();

create or replace function public.guard_job_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.profiles where job_id = old.id;
  if v_n > 0 then
    raise exception 'لا تُحذف الوظيفة «%»: يشغلها % موظف — انقلهم إلى وظيفة أخرى أوّلًا',
      old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_n from public.workflow_stage_participants where job_id = old.id;
  if v_n > 0 then
    raise exception 'لا تُحذف الوظيفة «%»: مستعملة في % موضع من مسارات سير العمل',
      old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists jobs_guard_delete on public.jobs;
create trigger jobs_guard_delete before delete on public.jobs
  for each row execute function public.guard_job_delete();

-- كان حذف الدور يمحو مشاركي المسارات معه صامتًا (`cascade`)
create or replace function public.guard_role_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.jobs where role_id = old.id;
  if v_n > 0 then
    raise exception 'لا يُحذف الدور «%»: تحمله % وظيفة', old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_n from public.workflow_stage_participants where role_id = old.id;
  if v_n > 0 then
    raise exception 'لا يُحذف الدور «%»: مستعمل في % موضع من مسارات سير العمل', old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists roles_guard_delete on public.roles;
create trigger roles_guard_delete before delete on public.roles
  for each row execute function public.guard_role_delete();

-- ── ٦) الموظف الجديد يحمل وظيفته ─────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_first boolean;
  v_admin_role_id uuid;
  v_job_text text := nullif(new.raw_user_meta_data ->> 'job_id', '');
  v_job uuid;
begin
  select not exists (select 1 from public.profiles) into v_is_first;

  -- معرّفٌ مشوَّه لا يُسقط إنشاء المستخدم؛ يُهمَل ويبقى الموظف بلا وظيفة
  if v_job_text ~ '^[0-9a-fA-F-]{36}$' then
    select id into v_job from public.jobs where id = v_job_text::uuid;
  end if;

  insert into public.profiles (id, email, full_name, employee_type, job_id)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    'administrative',
    v_job
  )
  on conflict (id) do nothing;

  if v_is_first then
    select id into v_admin_role_id from public.roles where key = 'admin';
    if v_admin_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (new.id, v_admin_role_id)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- ── ٧) الرؤية: أعضاء المشروع يقرؤون ─────────────────────────────────
create or replace function public.is_transaction_viewer(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_transaction_participant(p_transaction_id)
      or exists (
        select 1 from public.transactions t
        where t.id = p_transaction_id
          and t.project_id is not null
          and public.is_assigned_to_project(t.project_id));
$$;

revoke all on function public.is_transaction_viewer(uuid) from public, anon;
grant execute on function public.is_transaction_viewer(uuid) to authenticated;

drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated
  using (public.has_permission('transaction.read')
         and (public.has_permission('transaction.read_all')
              or public.is_transaction_viewer(id)));

drop policy if exists tsi_select on public.transaction_stage_instances;
create policy tsi_select on public.transaction_stage_instances
  for select to authenticated
  using (public.has_permission('transaction.read')
         and (public.has_permission('transaction.read_all')
              or public.is_transaction_viewer(transaction_id)));

drop policy if exists tal_select on public.transaction_action_log;
create policy tal_select on public.transaction_action_log
  for select to authenticated
  using (public.has_permission('transaction.read')
         and (public.has_permission('transaction.read_all')
              or public.is_transaction_viewer(transaction_id)));

drop policy if exists ta_select on public.transaction_assignments;
create policy ta_select on public.transaction_assignments
  for select to authenticated
  using (assignee_id = (select auth.uid())
         or (public.has_permission('transaction.read')
             and (public.has_permission('transaction.read_all')
                  or public.is_transaction_viewer(transaction_id))));

-- ── ٨) مرفقات القسم المخفية ──────────────────────────────────────────
create or replace function public.attachment_hidden_from_me(
  p_owner_department_id uuid,
  p_uploaded_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_owner_department_id is null then false
    when not exists (
      select 1 from public.departments d
      where d.id = p_owner_department_id and d.restrict_attachments) then false
    -- رافعه يرى ما رفع، وقسمه يرى مرفقات قسمه
    when p_uploaded_by = (select auth.uid()) then false
    when exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.department_id = p_owner_department_id) then false
    -- المستثنون بالاسم ثم بالقسم
    when exists (
      select 1 from public.department_attachment_access x
      where x.department_id = p_owner_department_id
        and x.kind = 'user' and x.user_id = (select auth.uid())) then false
    when exists (
      select 1 from public.department_attachment_access x
      join public.profiles p on p.id = (select auth.uid())
      where x.department_id = p_owner_department_id
        and x.kind = 'department'
        and x.allowed_department_id = p.department_id) then false
    else true
  end;
$$;

revoke all on function public.attachment_hidden_from_me(uuid, uuid) from public, anon;
grant execute on function public.attachment_hidden_from_me(uuid, uuid) to authenticated;

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
      and (
        public.has_permission('transaction.read_all')
        or public.is_transaction_viewer(a.transaction_id)
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
      and not public.attachment_hidden_from_me(a.owner_department_id, a.uploaded_by)
  );
$fn$;

-- مصدرٌ واحد للرؤية: السياسة تنادي الدالّة ولا تكرّر شرطها
drop policy if exists transaction_attachments_select on public.transaction_attachments;
create policy transaction_attachments_select on public.transaction_attachments
  for select to authenticated
  using (public.can_view_attachment(id));

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
    -- الإرفاق إجراءٌ لا قراءة: للموقّعين وحدهم، لا لكل أعضاء المشروع
    if not public.is_transaction_participant(p_transaction_id)
       and not public.has_permission('transaction.override') then
      raise exception 'الإرفاق للموقّعين على المعاملة'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  insert into public.transaction_attachments
    (transaction_id, assignment_id, stage_instance_id, name, file,
     content_type, size_bytes, visibility, department_id, required_permission,
     is_authenticated, uploaded_by, owner_department_id)
  values
    (p_transaction_id, p_assignment_id, v_stage, btrim(p_name), p_file,
     coalesce(p_content_type, ''), greatest(coalesce(p_size_bytes, 0), 0),
     coalesce(p_visibility, 'participants'), p_department_id,
     nullif(btrim(coalesce(p_required_permission, '')), ''),
     coalesce(p_is_authenticated, false), auth.uid(),
     (select department_id from public.profiles where id = auth.uid()))
  returning id into v_id;

  return v_id;
end;
$fn$;

-- ── ٩) البحث المختصر يعرف القارئ الجديد ──────────────────────────────
create or replace function public.search_transactions_brief(p_query text)
returns table (
  transaction_no bigint,
  transaction_type text,
  status text,
  created_at timestamptz,
  is_participant boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.no, t.type, t.status, t.created_at,
         public.is_transaction_viewer(t.id)
  from public.transactions t
  where public.has_permission('transaction.read')
    and (
      coalesce(btrim(p_query), '') = ''
      or t.no::text = btrim(p_query)
      or public.normalize_ar(t.subject) like '%' || public.normalize_ar(p_query) || '%'
    )
  order by t.no desc
  limit 50;
$$;

-- ── ١٠) حلّ المشاركين: الوظيفة والقسم ────────────────────────────────
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
  with tx as (
    select t.requested_by, t.project_id,
           coalesce(t.audience_ids, '{}'::uuid[]) as audience_ids
    from public.transactions t
    where t.id = p_transaction_id
  ),
  matched as (
    select sp.id as participant_id, sp.is_optional, sp.sort_order, p.id as assignee_id
    from public.workflow_stage_participants sp
    left join tx on true
    join public.profiles p
      on p.is_active
     and (
       (sp.kind = 'user' and p.id = sp.user_id)
       or (sp.kind = 'requester' and p.id = tx.requested_by)
       or (sp.kind = 'audience' and p.id = any (tx.audience_ids))
       or (sp.kind = 'job' and p.job_id = sp.job_id)
       or (sp.kind = 'project_job'
           and tx.project_id is not null
           and p.job_id = sp.job_id
           and exists (
             select 1 from public.project_assignments pa
             where pa.project_id = tx.project_id and pa.user_id = p.id
               and (sp.requires_sign = false or pa.can_sign)))
       or (sp.kind = 'department' and p.department_id = sp.department_id)
       or (sp.kind = 'role' and exists (
             select 1 from public.user_roles ur
             where ur.user_id = p.id and ur.role_id = sp.role_id))
       or (sp.kind = 'project_role'
           and tx.project_id is not null
           and exists (
             select 1 from public.user_roles ur
             where ur.user_id = p.id and ur.role_id = sp.role_id)
           and exists (
             select 1 from public.project_assignments pa
             where pa.project_id = tx.project_id and pa.user_id = p.id
               and (sp.requires_sign = false or pa.can_sign)))
       or (sp.kind = 'department_role'
           and p.department_id = sp.department_id
           and exists (
             select 1 from public.user_roles ur
             where ur.user_id = p.id and ur.role_id = sp.role_id))
     )
    where sp.stage_id = p_stage_id
      and sp.is_observer = false
  )
  select distinct on (m.assignee_id) m.assignee_id, m.participant_id, m.is_optional
  from matched m
  order by m.assignee_id, m.is_optional, m.sort_order, m.participant_id;
$$;

create or replace function public.is_transaction_observer(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.transactions t
    join public.workflow_stages s on s.definition_id = t.definition_id
    join public.workflow_stage_participants sp
      on sp.stage_id = s.id and sp.is_observer
    join public.profiles p on p.id = (select auth.uid()) and p.is_active
    where t.id = p_transaction_id
      and (
        (sp.kind = 'user' and sp.user_id = p.id)
        or (sp.kind = 'requester' and t.requested_by = p.id)
        or (sp.kind = 'audience' and p.id = any (coalesce(t.audience_ids, '{}'::uuid[])))
        or (sp.kind = 'job' and p.job_id = sp.job_id)
        or (sp.kind = 'project_job'
            and t.project_id is not null
            and p.job_id = sp.job_id
            and exists (
              select 1 from public.project_assignments pa
              where pa.project_id = t.project_id and pa.user_id = p.id
                and (sp.requires_sign = false or pa.can_sign)))
        or (sp.kind = 'department' and p.department_id = sp.department_id)
        or (sp.kind = 'role' and exists (
              select 1 from public.user_roles ur
              where ur.user_id = p.id and ur.role_id = sp.role_id))
        or (sp.kind = 'project_role'
            and t.project_id is not null
            and exists (
              select 1 from public.user_roles ur
              where ur.user_id = p.id and ur.role_id = sp.role_id)
            and exists (
              select 1 from public.project_assignments pa
              where pa.project_id = t.project_id and pa.user_id = p.id
                and (sp.requires_sign = false or pa.can_sign)))
        or (sp.kind = 'department_role'
            and p.department_id = sp.department_id
            and exists (
              select 1 from public.user_roles ur
              where ur.user_id = p.id and ur.role_id = sp.role_id))
      )
  );
$$;

-- ── ١١) الدوالّ الداخلية لا تُستدعى من الواجهة ───────────────────────
revoke execute on function public.profile_derive_from_job() from public, anon, authenticated;
revoke execute on function public.profile_sync_job_role() from public, anon, authenticated;
revoke execute on function public.job_propagate_to_holders() from public, anon, authenticated;
revoke execute on function public.department_propagate_to_holders() from public, anon, authenticated;
revoke execute on function public.guard_department_delete() from public, anon, authenticated;
revoke execute on function public.guard_job_delete() from public, anon, authenticated;
revoke execute on function public.guard_role_delete() from public, anon, authenticated;
