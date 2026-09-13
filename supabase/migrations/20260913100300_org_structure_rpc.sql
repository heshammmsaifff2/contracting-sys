-- ═══════════════════════════════════════════════════════════════════════
-- الهيكل التنظيمي — حفظ القسم ذرّيًّا، وحراسة أدوار الوظيفة
-- ═══════════════════════════════════════════════════════════════════════

-- ── ١) حفظ القسم وقائمة استثنائه في معاملة واحدة ─────────────────────
-- حذفٌ ثم إدراج من المتصفّح يترك القسم مخفيَّ المرفقات بلا استثناءات لو
-- انقطع الاتصال بين الخطوتين — فيُحجب عمّن كان مستثنًى بلا سبب ظاهر.
-- `security invoker`: سياسات `org.manage` نفسها تحرس كل سطر.
create or replace function public.save_department(
  p_id uuid,
  p_name text,
  p_classification text,
  p_description text,
  p_restrict_attachments boolean,
  p_sort_order integer,
  p_access jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.has_permission('org.manage') then
    raise exception 'لا تملك صلاحية إدارة الأقسام والوظائف'
      using errcode = 'insufficient_privilege';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'اسم القسم مطلوب' using errcode = 'check_violation';
  end if;
  if p_classification not in ('administrative', 'operational') then
    raise exception 'التصنيف إمّا إداري أو تشغيلي' using errcode = 'check_violation';
  end if;

  if p_id is null then
    insert into public.departments
      (name, classification, description, restrict_attachments, sort_order)
    values
      (btrim(p_name), p_classification, coalesce(p_description, ''),
       coalesce(p_restrict_attachments, false), coalesce(p_sort_order, 0))
    returning id into v_id;
  else
    update public.departments
       set name = btrim(p_name),
           classification = p_classification,
           description = coalesce(p_description, ''),
           restrict_attachments = coalesce(p_restrict_attachments, false),
           sort_order = coalesce(p_sort_order, 0)
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'القسم غير موجود' using errcode = 'no_data_found';
    end if;
  end if;

  -- الاستثناء بلا إخفاء لا معنى له، فيُمحى مع رفع الإخفاء
  delete from public.department_attachment_access where department_id = v_id;
  if coalesce(p_restrict_attachments, false) then
    insert into public.department_attachment_access
      (department_id, kind, user_id, allowed_department_id)
    select distinct v_id,
           e ->> 'kind',
           nullif(e ->> 'user_id', '')::uuid,
           nullif(e ->> 'department_id', '')::uuid
    from jsonb_array_elements(coalesce(p_access, '[]'::jsonb)) as e;
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_department(uuid, text, text, text, boolean, integer, jsonb)
  from public, anon;
grant execute on function public.save_department(uuid, text, text, text, boolean, integer, jsonb)
  to authenticated;

-- ── ٢) دور الوظيفة يغلب الإسناد اليدويّ المطابق ──────────────────────
-- كان `do nothing`: من يحمل الدور يدويًّا ثم يُسند لوظيفةٍ تحمله يبقى دوره
-- «يدويًّا»، فيُسحب منه بزرّ وهو ما زال على الوظيفة ويفقد صلاحياتها.
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
      on conflict (user_id, role_id) do update set source = 'job';
    end if;
  end if;
  return null;
end;
$$;

-- ── ٣) دور الوظيفة لا يُسحب بيدٍ ─────────────────────────────────────
-- يتبع الوظيفة: يُسحب بتغييرها. والحذف من داخل مُشغّل (مزامنة الوظيفة أو
-- تتابع حذف الموظف) عمقه أكبر من ١ فيمرّ.
create or replace function public.guard_job_role_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job text;
begin
  if old.source <> 'job' or pg_trigger_depth() > 1 then
    return old;
  end if;
  select j.name into v_job
  from public.profiles p
  join public.jobs j on j.id = p.job_id
  where p.id = old.user_id and j.role_id = old.role_id;
  if v_job is not null then
    raise exception 'هذا الدور تمنحه وظيفة الموظف «%» — غيّر وظيفته بدل سحب الدور', v_job
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

drop trigger if exists user_roles_guard_job_role on public.user_roles;
create trigger user_roles_guard_job_role
  before delete on public.user_roles
  for each row execute function public.guard_job_role_delete();

revoke all on function public.guard_job_role_delete() from public, anon, authenticated;
