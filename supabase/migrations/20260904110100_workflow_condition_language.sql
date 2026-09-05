-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٢ — لغة الشروط: مفسِّر ومدقِّق
--
-- لغة **مغلقة** عمدًا. لا يُضاف معامل إلا بتعديل
-- docs/decisions/0001-workflow-engine-v2.md أولًا.
--
--   المنطقية: and · or · not
--   المقارنة: eq · ne · gt · gte · lt · lte
--   الانتماء: in · not_in
--   الفراغ:   is_null · is_not_null
--
-- ممنوع: استدعاء دوال، استعلامات فرعية، حساب حسابي، مقارنة حقل بحقل،
-- تعبيرات نصّية منتظمة، وعمق تعشيش يتجاوز ٥.
-- ═══════════════════════════════════════════════════════════════════════

insert into public.settings (key, value, description, category) values
  ('workflow_condition_max_depth', '5'::jsonb,
   'أقصى عمق تعشيش لشرط تفريع واحد', 'workflow'),
  ('workflow_max_routes_per_action', '20'::jsonb,
   'أقصى عدد مسارات شرطية لإجراء واحد', 'workflow'),
  ('workflow_max_transitions', '50'::jsonb,
   'أقصى عدد مراحل تفتحها معاملة واحدة — حارس ضد الحلقات المغلقة', 'workflow')
on conflict (key) do update set description = excluded.description;

/**
 * يتحقّق من شكل الشرط قبل الحفظ. يرفع استثناءً بسبب مفهوم بدل أن يُخزَّن
 * شرط لا يعمل ثم يُكتشف وقت التنفيذ.
 */
create or replace function public.validate_workflow_condition(
  p_condition jsonb,
  p_depth integer default 0
)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $fn$
declare
  v_op text;
  v_arg jsonb;
  v_args jsonb;
begin
  -- الشرط الفارغ مسارٌ افتراضي صالح
  if p_condition is null or jsonb_typeof(p_condition) = 'null' then
    return true;
  end if;

  if p_depth > 5 then
    raise exception 'عمق تعشيش الشرط يتجاوز الحد المسموح (٥)'
      using errcode = 'program_limit_exceeded';
  end if;

  if jsonb_typeof(p_condition) <> 'object' then
    raise exception 'الشرط يجب أن يكون كائنًا' using errcode = 'check_violation';
  end if;

  v_op := p_condition ->> 'op';
  if v_op is null then
    raise exception 'الشرط بلا معامل op' using errcode = 'check_violation';
  end if;

  if v_op in ('and', 'or', 'not') then
    v_args := p_condition -> 'args';
    if v_args is null or jsonb_typeof(v_args) <> 'array'
       or jsonb_array_length(v_args) = 0 then
      raise exception 'المعامل % يحتاج args غير فارغة', v_op
        using errcode = 'check_violation';
    end if;
    if v_op = 'not' and jsonb_array_length(v_args) <> 1 then
      raise exception 'المعامل not يأخذ عنصرًا واحدًا'
        using errcode = 'check_violation';
    end if;
    for v_arg in select * from jsonb_array_elements(v_args) loop
      perform public.validate_workflow_condition(v_arg, p_depth + 1);
    end loop;
    return true;
  end if;

  if v_op not in ('eq', 'ne', 'gt', 'gte', 'lt', 'lte',
                  'in', 'not_in', 'is_null', 'is_not_null') then
    raise exception 'معامل غير مسموح: %', v_op using errcode = 'check_violation';
  end if;

  if coalesce(btrim(p_condition ->> 'field'), '') = '' then
    raise exception 'المعامل % يحتاج اسم حقل', v_op using errcode = 'check_violation';
  end if;

  if v_op in ('is_null', 'is_not_null') then
    return true;
  end if;

  if p_condition -> 'value' is null then
    raise exception 'المعامل % يحتاج قيمة', v_op using errcode = 'check_violation';
  end if;

  if v_op in ('in', 'not_in')
     and jsonb_typeof(p_condition -> 'value') <> 'array' then
    raise exception 'المعامل % يحتاج قائمة قيم', v_op
      using errcode = 'check_violation';
  end if;

  return true;
end;
$fn$;

/**
 * يُقيّم الشرط على سياق المعاملة.
 * الحقل الغائب يجعل الشرط **لا يتحقّق** (عدا is_null) — فالتفريع لا ينزلق
 * إلى مسار لمجرّد أن بيانًا لم يُملأ.
 */
create or replace function public.eval_workflow_condition(
  p_condition jsonb,
  p_context jsonb,
  p_depth integer default 0
)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $fn$
declare
  v_op text;
  v_field text;
  v_value jsonb;
  v_actual jsonb;
  v_arg jsonb;
  v_missing boolean;
begin
  -- المسار الافتراضي يمرّ دائمًا
  if p_condition is null or jsonb_typeof(p_condition) = 'null' then
    return true;
  end if;

  if p_depth > 5 then
    raise exception 'عمق تعشيش الشرط يتجاوز الحد المسموح (٥)'
      using errcode = 'program_limit_exceeded';
  end if;

  v_op := p_condition ->> 'op';

  if v_op = 'and' then
    for v_arg in select * from jsonb_array_elements(p_condition -> 'args') loop
      if not public.eval_workflow_condition(v_arg, p_context, p_depth + 1) then
        return false;
      end if;
    end loop;
    return true;
  elsif v_op = 'or' then
    for v_arg in select * from jsonb_array_elements(p_condition -> 'args') loop
      if public.eval_workflow_condition(v_arg, p_context, p_depth + 1) then
        return true;
      end if;
    end loop;
    return false;
  elsif v_op = 'not' then
    return not public.eval_workflow_condition(
      p_condition -> 'args' -> 0, p_context, p_depth + 1);
  end if;

  v_field := p_condition ->> 'field';
  v_actual := p_context -> v_field;
  v_missing := v_actual is null or jsonb_typeof(v_actual) = 'null';

  if v_op = 'is_null' then return v_missing; end if;
  if v_op = 'is_not_null' then return not v_missing; end if;
  if v_missing then return false; end if;

  v_value := p_condition -> 'value';

  if v_op = 'eq' then return v_actual = v_value; end if;
  if v_op = 'ne' then return v_actual <> v_value; end if;

  if v_op = 'in' then
    return exists (
      select 1 from jsonb_array_elements(v_value) e where e.value = v_actual
    );
  end if;
  if v_op = 'not_in' then
    return not exists (
      select 1 from jsonb_array_elements(v_value) e where e.value = v_actual
    );
  end if;

  -- المقارنات: رقميًّا إن كان الطرفان رقمين، وإلا نصّيًّا. لا استثناء هنا:
  -- انهيار التوجيه بسبب نوع بيان أسوأ من قرار محافظ.
  if jsonb_typeof(v_actual) = 'number' and jsonb_typeof(v_value) = 'number' then
    return case v_op
      when 'gt'  then (v_actual #>> '{}')::numeric >  (v_value #>> '{}')::numeric
      when 'gte' then (v_actual #>> '{}')::numeric >= (v_value #>> '{}')::numeric
      when 'lt'  then (v_actual #>> '{}')::numeric <  (v_value #>> '{}')::numeric
      when 'lte' then (v_actual #>> '{}')::numeric <= (v_value #>> '{}')::numeric
      else false
    end;
  end if;

  return case v_op
    when 'gt'  then (v_actual #>> '{}') >  (v_value #>> '{}')
    when 'gte' then (v_actual #>> '{}') >= (v_value #>> '{}')
    when 'lt'  then (v_actual #>> '{}') <  (v_value #>> '{}')
    when 'lte' then (v_actual #>> '{}') <= (v_value #>> '{}')
    else false
  end;
end;
$fn$;

/**
 * سياق المعاملة: لقطة المستند المصدر والحقول المخصّصة، ثم أعمدة المعاملة
 * **فوقها** — فلا يستطيع محتوى اللقطة انتحال `type` أو `project_id`.
 */
create or replace function public.build_transaction_context(p_transaction_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(t.context, '{}'::jsonb) || jsonb_build_object(
    'no',          t.no,
    'type',        t.type,
    'subject',     t.subject,
    'project_id',  t.project_id,
    'requested_by', t.requested_by,
    'entity_type', t.entity_type,
    'entity_id',   t.entity_id,
    'status',      t.status
  )
  from public.transactions t
  where t.id = p_transaction_id;
$fn$;

-- ── حارس المسارات: يمنع الشرط المعطوب والوجهة المستحيلة ────────────────
create or replace function public.guard_action_route()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
declare
  v_kind text;
  v_action_stage uuid;
  v_target_definition uuid;
  v_action_definition uuid;
  v_count integer;
  v_max integer;
begin
  select a.kind, a.stage_id into v_kind, v_action_stage
    from public.workflow_actions a where a.id = new.action_id;

  if v_kind is null then
    raise exception 'الإجراء غير موجود' using errcode = 'no_data_found';
  end if;

  -- الملاحظة لا تحرّك المرحلة، والنهائي يغلق المسار: كلاهما بلا وجهة
  if v_kind in ('note', 'final') then
    raise exception 'إجراء من نوع % لا يحمل وجهة', v_kind
      using errcode = 'check_violation';
  end if;

  -- الوجهة يجب أن تكون في المسار نفسه
  select definition_id into v_action_definition
    from public.workflow_stages where id = v_action_stage;
  select definition_id into v_target_definition
    from public.workflow_stages where id = new.target_stage_id;

  if v_action_definition is distinct from v_target_definition then
    raise exception 'الوجهة يجب أن تكون مرحلة في المسار نفسه'
      using errcode = 'check_violation';
  end if;

  perform public.validate_workflow_condition(new.condition);

  select (value #>> '{}')::integer into v_max
    from public.settings where key = 'workflow_max_routes_per_action';

  select count(*) into v_count
    from public.workflow_action_routes r
   where r.action_id = new.action_id
     and (tg_op = 'INSERT' or r.id <> new.id);

  if v_count >= coalesce(v_max, 20) then
    raise exception 'أقصى عدد مسارات لإجراء واحد %', coalesce(v_max, 20)
      using errcode = 'program_limit_exceeded';
  end if;

  return new;
end;
$fn$;

drop trigger if exists war_guard on public.workflow_action_routes;
create trigger war_guard
  before insert or update on public.workflow_action_routes
  for each row execute function public.guard_action_route();

revoke execute on function
  public.validate_workflow_condition(jsonb, integer),
  public.eval_workflow_condition(jsonb, jsonb, integer),
  public.build_transaction_context(uuid)
  from public, anon;

grant execute on function
  public.validate_workflow_condition(jsonb, integer),
  public.eval_workflow_condition(jsonb, jsonb, integer),
  public.build_transaction_context(uuid)
  to authenticated;
