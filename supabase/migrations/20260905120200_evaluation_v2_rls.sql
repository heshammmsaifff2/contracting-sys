-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٨ — RLS وعروض التقييم الموسَّع
--
-- التعديلات واللقطات **للقراءة فقط** من `authenticated`: كلاهما يُكتب
-- بدالّة تتحقّق من الصلاحية وتُسجّل أثرها. والكتابة المباشرة عليهما تعني
-- درجةً تتغيّر بلا سبب ولا صاحب — وهو ما جاءت هذه المرحلة لتمنعه.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.evaluation_categories  enable row level security;
alter table public.evaluation_rules       enable row level security;
alter table public.evaluation_adjustments enable row level security;
alter table public.evaluation_snapshots   enable row level security;
alter table public.evaluation_audit_log   enable row level security;

revoke all on
  public.evaluation_categories,
  public.evaluation_rules,
  public.evaluation_adjustments,
  public.evaluation_snapshots,
  public.evaluation_audit_log
  from anon;

-- ── الفئات: يقرؤها من يرى التقييم، ويحرّرها من يديره ────────────────────
grant select, insert, update, delete on public.evaluation_categories to authenticated;

drop policy if exists evaluation_categories_select on public.evaluation_categories;
create policy evaluation_categories_select on public.evaluation_categories
  for select to authenticated
  using (public.has_permission('evaluation.read'));

drop policy if exists evaluation_categories_write on public.evaluation_categories;
create policy evaluation_categories_write on public.evaluation_categories
  for all to authenticated
  using (public.has_permission('evaluation.manage'))
  with check (public.has_permission('evaluation.manage'));

-- ── القواعد: تُقرأ ليُفهَم سبب الخصم، وتُحرَّر بصلاحيتها ─────────────────
grant select, insert, update, delete on public.evaluation_rules to authenticated;

drop policy if exists evaluation_rules_select on public.evaluation_rules;
create policy evaluation_rules_select on public.evaluation_rules
  for select to authenticated
  using (public.has_permission('evaluation.read'));

drop policy if exists evaluation_rules_write on public.evaluation_rules;
create policy evaluation_rules_write on public.evaluation_rules
  for all to authenticated
  using (public.has_permission('evaluation.rules'))
  with check (public.has_permission('evaluation.rules'));

-- ── التعديلات واللقطات: قراءة فقط، والكتابة بالدوالّ ────────────────────
grant select on public.evaluation_adjustments to authenticated;
grant select on public.evaluation_snapshots to authenticated;

/**
 * كلٌّ يرى تعديلات نفسه، ومن يرى التقييم يرى الجميع.
 * الخصم الذي لا يراه صاحبه لا يُصحَّح.
 */
drop policy if exists evaluation_adjustments_select on public.evaluation_adjustments;
create policy evaluation_adjustments_select on public.evaluation_adjustments
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission('evaluation.read')
  );

drop policy if exists evaluation_snapshots_select on public.evaluation_snapshots;
create policy evaluation_snapshots_select on public.evaluation_snapshots
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_permission('evaluation.read')
  );

-- ── سجلّ التدقيق: يُقرأ بصلاحيته، ولا يُكتب ولا يُعدَّل ولا يُحذف ────────
-- لا `grant insert`: المُشغّلات وحدها تكتبه وهي `security definer`.
grant select on public.evaluation_audit_log to authenticated;

drop policy if exists evaluation_audit_select on public.evaluation_audit_log;
create policy evaluation_audit_select on public.evaluation_audit_log
  for select to authenticated
  using (public.has_permission('evaluation.audit'));

-- ── العرض: الدرجة النهائية بتعديلاتها ──────────────────────────────────
/**
 * الدرجة كما تُعرض: المجمَّدة من اللقطة، والجارية محسوبةً حيّةً.
 *
 * اللقطة تغلب دائمًا. وإلا لتغيّر ترتيبٌ أُعلن لأن مدّةً عُدِّلت بعد شهرين،
 * وهو بالضبط ما جاءت اللقطة لتمنعه.
 */
create or replace view public.evaluation_period_report
with (security_invoker = true) as
select
  s.period,
  s.user_id,
  p.full_name,
  s.employee_type,
  s.base_score,
  s.adjustment_points,
  s.final_score,
  s.completed_steps,
  s.rank_in_period,
  true              as is_frozen,
  s.taken_at        as frozen_at,
  s.breakdown
from public.evaluation_snapshots s
join public.profiles p on p.id = s.user_id

union all

select
  live.period,
  live.user_id,
  live.full_name,
  live.employee_type,
  round(live.weighted_score, 2)                       as base_score,
  round(coalesce(adj.points, 0), 2)                   as adjustment_points,
  round(
    least(100, greatest(0, live.weighted_score + coalesce(adj.points, 0))), 2
  )                                                   as final_score,
  live.completed_steps,
  rank() over (
    partition by live.period
    order by least(100, greatest(0, live.weighted_score + coalesce(adj.points, 0)))
      desc
  )::int                                              as rank_in_period,
  false             as is_frozen,
  null::timestamptz as frozen_at,
  '{}'::jsonb       as breakdown
from public.employee_evaluation_summary live
left join (
  select
    a.user_id,
    a.period,
    sum(case when a.effect = 'bonus' then a.points else -a.points end) as points
  from public.evaluation_adjustments a
  group by a.user_id, a.period
) adj on adj.user_id = live.user_id and adj.period = live.period
where not exists (
  select 1 from public.evaluation_snapshots s2 where s2.period = live.period
);

comment on view public.evaluation_period_report is
  'الدرجة النهائية بتعديلاتها: المجمَّدة من اللقطة، والجارية محسوبةً حيّةً.';

revoke all on public.evaluation_period_report from anon;
grant select on public.evaluation_period_report to authenticated;

/** تفصيل الدرجة بالفئات — التقرير يُقرأ بثلاثة أرقام لا بخمسة عشر. */
create or replace view public.evaluation_category_breakdown
with (security_invoker = true) as
with components as (
  select
    a.assignee_id as user_id,
    to_char(a.completed_at at time zone public.app_timezone(), 'YYYY-MM') as period,
    'completion'::text as criteria_key,
    avg(a.score) as score
  from public.transaction_assignments a
  where a.status = 'done'
    and a.score is not null
    and a.assignee_id is not null
    and a.completed_at is not null
  group by 1, 2

  union all

  select es.user_id, es.period, ec.key, avg(es.score)
  from public.evaluation_scores es
  join public.evaluation_criteria ec on ec.id = es.criteria_id
  where ec.is_active
  group by 1, 2, 3
)
select
  c.user_id,
  c.period,
  cat.key                                              as category_key,
  cat.name                                             as category_name,
  cat.sort_order,
  round(sum(c.score * w.weight) / nullif(sum(w.weight), 0), 2) as category_score,
  round(sum(w.weight), 2)                              as category_weight
from components c
join public.profiles p on p.id = c.user_id
join public.evaluation_criteria ec on ec.key = c.criteria_key and ec.is_active
join public.evaluation_categories cat
  on cat.id = ec.category_id and cat.is_active
join public.evaluation_weights w
  on w.criteria_id = ec.id and w.employee_type = p.employee_type
group by c.user_id, c.period, cat.key, cat.name, cat.sort_order;

comment on view public.evaluation_category_breakdown is
  'الدرجة موزَّعةً على فئاتها — الإنجاز والسلوك والكفاءة، كلٌّ بوزنه.';

revoke all on public.evaluation_category_breakdown from anon;
grant select on public.evaluation_category_breakdown to authenticated;
