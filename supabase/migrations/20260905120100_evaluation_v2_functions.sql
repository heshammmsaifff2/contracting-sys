-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٨ — دوالّ التقييم الموسَّع
--
-- المقاييس · المُختبِر التجريبي · التطبيق · اللقطة · سجلّ التدقيق.
-- ═══════════════════════════════════════════════════════════════════════

-- ── المقاييس: ما تُقاس عليه القواعد ────────────────────────────────────
/**
 * مقاييس موظف في فترة، لقطةً واحدة.
 *
 * هذه هي **حقول لغة القواعد**: ما ليس هنا لا يُشترَط عليه. وهي مقصودة
 * الضيق — كل حقل يُضاف يصير عقدًا لا يُنقَض، فلا يُضاف إلا بحاجة مثبتة.
 */
create or replace function public.employee_period_metrics(
  p_user_id uuid,
  p_period text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  with done as (
    select a.*
    from public.transaction_assignments a
    where a.assignee_id = p_user_id
      and a.status = 'done'
      and a.completed_at is not null
      and to_char(a.completed_at at time zone public.app_timezone(), 'YYYY-MM')
          = p_period
  ),
  agg as (
    select
      count(*)::int                                        as completed_count,
      coalesce(round(avg(d.score), 2), 0)::numeric         as avg_score,
      count(*) filter (
        where d.allocated_minutes is not null
          and public.business_minutes_between(
                d.arrived_at, d.completed_at, d.assignee_id) > d.allocated_minutes
      )::int                                               as late_count
    from done d
  ),
  open_now as (
    select count(*)::int as open_count
    from public.transaction_assignments a
    where a.assignee_id = p_user_id and a.status = 'in_progress'
  ),
  warnings as (
    select count(*)::int as warnings_count
    from public.transaction_action_log l
    where l.action_key = 'warning'
      and l.acted_at >= (p_period || '-01')::date
      and l.acted_at <  ((p_period || '-01')::date + interval '1 month')
      and exists (
        select 1 from public.transaction_assignments a
        where a.id = l.assignment_id and a.assignee_id = p_user_id
      )
  )
  select jsonb_build_object(
    'user_id',         p_user_id,
    'period',          p_period,
    'employee_type',   coalesce(p.employee_type, ''),
    'department_id',   p.department_id,
    'completed_count', agg.completed_count,
    'late_count',      agg.late_count,
    -- الملتزم به: ما أُنجز في موعده. صفرٌ عند غياب الإنجاز لا واحد،
    -- فلا يتصدّر الترتيبَ من لم يعمل شيئًا.
    'on_time_count',   agg.completed_count - agg.late_count,
    'on_time_ratio',   case when agg.completed_count = 0 then 0
                            else round(
                              (agg.completed_count - agg.late_count)::numeric
                              / agg.completed_count, 4) end,
    'avg_score',       agg.avg_score,
    'open_count',      open_now.open_count,
    'warnings_count',  warnings.warnings_count
  )
  from public.profiles p, agg, open_now, warnings
  where p.id = p_user_id;
$fn$;

comment on function public.employee_period_metrics(uuid, text) is
  'حقول لغة القواعد الإدارية — ما ليس هنا لا يُشترَط عليه.';

-- ── المُختبِر التجريبي ─────────────────────────────────────────────────
/**
 * ماذا **ستفعل** القواعد لو طُبِّقت الآن — بلا أن تكتب حرفًا.
 *
 * هذا هو الفرق بين قاعدة تُجرَّب وقاعدة تُفاجئ ثلاثين موظفًا. تُشغَّل على
 * قاعدة بعينها أو عليها كلّها، والنتيجة صفٌّ لكل موظف تمسّه.
 */
create or replace function public.preview_evaluation_rules(
  p_period text,
  p_rule_id uuid default null
)
returns table (
  user_id uuid,
  full_name text,
  employee_type text,
  rule_id uuid,
  rule_key text,
  rule_name text,
  effect text,
  points numeric,
  reason text,
  metrics jsonb,
  already_applied boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_p record;
  v_r record;
  v_metrics jsonb;
  v_units numeric;
  v_points numeric;
begin
  if p_period !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'الفترة بصيغة YYYY-MM' using errcode = 'invalid_parameter_value';
  end if;

  for v_p in
    select pr.id, pr.full_name, pr.employee_type
    from public.profiles pr
    where pr.is_active
      -- المستثنى من التقييم لا تمسّه القواعد [المراسلات 16]
      and not exists (
        select 1 from public.evaluation_exclusions x where x.user_id = pr.id
      )
    order by pr.full_name
  loop
    v_metrics := public.employee_period_metrics(v_p.id, p_period);

    for v_r in
      select * from public.evaluation_rules r
      where r.is_active
        and (p_rule_id is null or r.id = p_rule_id)
        and (r.employee_type is null or r.employee_type = v_p.employee_type)
      order by r.sort_order, r.key
    loop
      if not public.eval_workflow_condition(v_r.condition, v_metrics) then
        continue;
      end if;

      if v_r.per_unit_field is null then
        v_points := v_r.points;
      else
        v_units := coalesce((v_metrics ->> v_r.per_unit_field)::numeric, 0);
        v_points := v_r.points * greatest(v_units, 0);
      end if;

      if v_r.max_points is not null then
        v_points := least(v_points, v_r.max_points);
      end if;

      -- صفرٌ ليس أثرًا: قاعدةٌ لكل تحذير على من لا تحذير عليه لا تُذكر
      if v_points <= 0 then
        continue;
      end if;

      user_id         := v_p.id;
      full_name       := v_p.full_name;
      employee_type   := coalesce(v_p.employee_type, '');
      rule_id         := v_r.id;
      rule_key        := v_r.key;
      rule_name       := v_r.name;
      effect          := v_r.effect;
      points          := round(v_points, 2);
      reason          := coalesce(nullif(btrim(v_r.reason_template), ''), v_r.name);
      metrics         := v_metrics;
      already_applied := exists (
        select 1 from public.evaluation_adjustments adj
        where adj.user_id = v_p.id and adj.period = p_period
          and adj.rule_id = v_r.id
      );
      return next;
    end loop;
  end loop;
end;
$fn$;

comment on function public.preview_evaluation_rules(text, uuid) is
  'مُختبِر تجريبي: ماذا ستفعل القواعد لو طُبِّقت — بلا كتابة.';

-- ── التطبيق ────────────────────────────────────────────────────────────
/**
 * تثبيت ما عرضه المُختبِر.
 *
 * يُكتب من `preview_evaluation_rules` نفسها لا من حساب ثانٍ: لو حُسبت
 * النقاط مرّتين بطريقتين لَاختلف ما رآه المدير عمّا وقع في الملفّ.
 */
create or replace function public.apply_evaluation_rules(
  p_period text,
  p_rule_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  if not public.has_permission('evaluation.rules') then
    raise exception 'تطبيق القواعد يتطلّب صلاحية evaluation.rules'
      using errcode = 'insufficient_privilege';
  end if;

  -- الفترة المجمَّدة لا تُعدَّل: اللقطة أُعلنت وبُني عليها
  if exists (select 1 from public.evaluation_snapshots where period = p_period) then
    raise exception 'الفترة % مجمَّدة بلقطة — أزِل اللقطة قبل التعديل', p_period
      using errcode = 'check_violation';
  end if;

  insert into public.evaluation_adjustments
    (user_id, period, rule_id, rule_key, effect, points, reason, metrics, applied_by)
  select
    pv.user_id, p_period, pv.rule_id, pv.rule_key, pv.effect, pv.points,
    pv.reason, pv.metrics, auth.uid()
  from public.preview_evaluation_rules(p_period, p_rule_id) pv
  where not pv.already_applied
  on conflict (user_id, period, rule_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

/** التراجع عن تطبيق قاعدة على فترة — قبل التجميد. */
create or replace function public.revoke_evaluation_rule(
  p_period text,
  p_rule_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  if not public.has_permission('evaluation.rules') then
    raise exception 'التراجع يتطلّب صلاحية evaluation.rules'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.evaluation_snapshots where period = p_period) then
    raise exception 'الفترة % مجمَّدة بلقطة', p_period
      using errcode = 'check_violation';
  end if;

  delete from public.evaluation_adjustments
   where period = p_period and rule_id = p_rule_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

-- ── اللقطة الشهرية ─────────────────────────────────────────────────────
/**
 * تجميد فترة كما هي الآن.
 *
 * تُخزَّن الدرجة الأساسية والتعديلات والنهائية والترتيب، ومعها تفصيل الفئات
 * والبنود. فيبقى التقرير مقروءًا بلا إعادة حساب، ولا يعيد تعديلُ مدّةٍ بعد
 * شهرين كتابةَ ترتيبٍ أُعلن.
 */
create or replace function public.take_evaluation_snapshot(p_period text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  if not public.has_permission('evaluation.snapshot') then
    raise exception 'اللقطة تتطلّب صلاحية evaluation.snapshot'
      using errcode = 'insufficient_privilege';
  end if;

  if p_period !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'الفترة بصيغة YYYY-MM' using errcode = 'invalid_parameter_value';
  end if;

  -- الفترة الجارية لا تُجمَّد: يومها لم ينتهِ بعد
  if p_period >= to_char(now() at time zone public.app_timezone(), 'YYYY-MM') then
    raise exception 'لا تُجمَّد فترة لم تنتهِ بعد' using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.evaluation_snapshots where period = p_period) then
    raise exception 'الفترة % مجمَّدة أصلًا' using errcode = 'unique_violation';
  end if;

  with adjustments as (
    select
      adj.user_id,
      sum(case when adj.effect = 'bonus' then adj.points else -adj.points end)
        as points
    from public.evaluation_adjustments adj
    where adj.period = p_period
    group by adj.user_id
  ),
  merged as (
    select
      s.user_id,
      s.employee_type,
      s.weighted_score as base_score,
      coalesce(a.points, 0) as adjustment_points,
      -- الدرجة تبقى بين صفر ومئة مهما بلغت القواعد
      least(100, greatest(0, s.weighted_score + coalesce(a.points, 0)))
        as final_score,
      s.completed_steps
    from public.employee_evaluation_summary s
    left join adjustments a on a.user_id = s.user_id
    where s.period = p_period
  ),
  ranked as (
    select
      m.*,
      rank() over (order by m.final_score desc)::int as rank_in_period
    from merged m
  )
  insert into public.evaluation_snapshots
    (period, user_id, employee_type, base_score, adjustment_points, final_score,
     completed_steps, rank_in_period, breakdown, taken_by)
  select
    p_period, r.user_id, coalesce(r.employee_type, ''),
    round(r.base_score, 2), round(r.adjustment_points, 2), round(r.final_score, 2),
    r.completed_steps, r.rank_in_period,
    jsonb_build_object(
      'metrics', public.employee_period_metrics(r.user_id, p_period),
      'adjustments', coalesce(
        (select jsonb_agg(jsonb_build_object(
           'rule', adj.rule_key, 'effect', adj.effect,
           'points', adj.points, 'reason', adj.reason) order by adj.applied_at)
         from public.evaluation_adjustments adj
         where adj.user_id = r.user_id and adj.period = p_period),
        '[]'::jsonb)
    ),
    auth.uid()
  from ranked r;

  get diagnostics v_count = row_count;

  insert into public.evaluation_audit_log
    (entity, action, period, after_data, actor_id)
  values
    ('evaluation_snapshots', 'insert', p_period,
     jsonb_build_object('rows', v_count), auth.uid());

  return v_count;
end;
$fn$;

/**
 * فكّ التجميد.
 *
 * فعلٌ نادر ويجب أن يبقى نادرًا: يُبطل ترتيبًا أُعلن. فسببه إلزاميّ ويُكتب
 * في سجلّ التدقيق قبل أن تُحذف اللقطة.
 */
create or replace function public.clear_evaluation_snapshot(
  p_period text,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  if not public.has_permission('evaluation.snapshot') then
    raise exception 'فكّ التجميد يتطلّب صلاحية evaluation.snapshot'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'سبب فكّ التجميد مطلوب' using errcode = 'check_violation';
  end if;

  insert into public.evaluation_audit_log
    (entity, action, period, before_data, actor_id)
  select
    'evaluation_snapshots', 'delete', p_period,
    jsonb_build_object(
      'reason', btrim(p_reason),
      'rows', (select count(*) from public.evaluation_snapshots
                where period = p_period)),
    auth.uid();

  delete from public.evaluation_snapshots where period = p_period;
  get diagnostics v_count = row_count;
  return v_count;
end;
$fn$;

-- ── سجلّ التدقيق ───────────────────────────────────────────────────────
/**
 * مُشغّل عامّ يخدم جداول التقييم كلّها.
 *
 * `to_jsonb` على الصفّ كاملًا لا على أعمدة مختارة: العمود الذي يُضاف غدًا
 * يُسجَّل بلا أن يتذكّره أحد.
 */
create or replace function public.log_evaluation_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_row record;
  v_user uuid;
  v_period text;
begin
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;

  begin
    v_user := (to_jsonb(v_row) ->> 'user_id')::uuid;
  exception when others then
    v_user := null;
  end;
  v_period := to_jsonb(v_row) ->> 'period';

  insert into public.evaluation_audit_log
    (entity, entity_id, action, user_id, period, before_data, after_data, actor_id)
  values (
    tg_table_name,
    (to_jsonb(v_row) ->> 'id')::uuid,
    lower(tg_op),
    v_user,
    v_period,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid()
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$fn$;

drop trigger if exists evaluation_scores_audit on public.evaluation_scores;
create trigger evaluation_scores_audit
  after insert or update or delete on public.evaluation_scores
  for each row execute function public.log_evaluation_change();

drop trigger if exists evaluation_adjustments_audit on public.evaluation_adjustments;
create trigger evaluation_adjustments_audit
  after insert or update or delete on public.evaluation_adjustments
  for each row execute function public.log_evaluation_change();

drop trigger if exists evaluation_exclusions_audit on public.evaluation_exclusions;
create trigger evaluation_exclusions_audit
  after insert or update or delete on public.evaluation_exclusions
  for each row execute function public.log_evaluation_change();

drop trigger if exists evaluation_rules_audit on public.evaluation_rules;
create trigger evaluation_rules_audit
  after insert or update or delete on public.evaluation_rules
  for each row execute function public.log_evaluation_change();

-- ── الصلاحيات ──────────────────────────────────────────────────────────
revoke execute on function
  public.employee_period_metrics(uuid, text),
  public.preview_evaluation_rules(text, uuid),
  public.apply_evaluation_rules(text, uuid),
  public.revoke_evaluation_rule(text, uuid),
  public.take_evaluation_snapshot(text),
  public.clear_evaluation_snapshot(text, text)
  from public, anon;

grant execute on function
  public.employee_period_metrics(uuid, text),
  public.preview_evaluation_rules(text, uuid),
  public.apply_evaluation_rules(text, uuid),
  public.revoke_evaluation_rule(text, uuid),
  public.take_evaluation_snapshot(text),
  public.clear_evaluation_snapshot(text, text)
  to authenticated;
