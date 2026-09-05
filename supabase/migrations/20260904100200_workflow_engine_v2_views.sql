-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠١ — عروض المحرّك v2
--
-- صندوق الوارد صار صفًّا لكل **تكليف** لا لكل مرحلة، لأن المرحلة الواحدة
-- قد تقف عند أكثر من موظف ولكلٍّ عدّاده ودرجته.
--
-- أداء: النسخة القديمة كانت تنادي business_minutes_between ستّ مرات لكل صفّ
-- (مرة للمستهلك، ومرة للمتبقّي، ومرة للنسبة، وثلاثًا في سلّم الألوان).
-- هنا تُحسب **مرة واحدة** في lateral وتُشتقّ منها البقية. الاستدعاء الثاني
-- الوحيد هو موعد الاستحقاق، وهو حسابٌ مختلف لا يُشتقّ.
--
-- كل العروض security_invoker: تسري سياسات الجداول الأصلية على القارئ.
-- ═══════════════════════════════════════════════════════════════════════

create view public.transaction_inbox
with (security_invoker = true) as
select
  a.id                        as assignment_id,
  a.stage_instance_id,
  t.id                        as transaction_id,
  t.no                        as transaction_no,
  t.type                      as transaction_type,
  t.subject,
  t.status                    as transaction_status,
  t.requested_by,
  rq.full_name                as requester_name,
  t.project_id,
  pr.name                     as project_name,
  si.seq,
  si.stage_key,
  si.name                     as stage_name,
  si.status                   as stage_status,
  si.completion_policy,
  si.quorum_count,
  si.is_archive,
  si.is_final,
  a.assignee_id,
  pf.full_name                as assignee_name,
  a.is_optional,
  a.allocated_minutes,
  a.arrived_at,
  a.received_at,
  a.completed_at,
  a.status                    as assignment_status,
  a.score,
  a.notes,
  -- ملاحظة المدير: للجميع إن لم تُخصَّص، وإلا لصاحبها وحده [المراسلات 19]
  case
    when a.manager_note_visible_to is null
      or a.manager_note_visible_to = (select auth.uid())
    then a.manager_note
    else ''
  end                         as manager_note,
  m.elapsed_minutes,
  case
    when a.allocated_minutes is null then null
    else a.allocated_minutes - m.elapsed_minutes
  end                         as remaining_minutes,
  m.elapsed_ratio,
  case
    when a.allocated_minutes is null then null
    else public.add_business_minutes(
           a.arrived_at, a.allocated_minutes, a.assignee_id)
  end                         as due_at,
  -- سلّم الألوان [المراسلات 25]
  case
    when a.status = 'done'        then 'success'
    when m.elapsed_ratio is null  then 'neutral'
    when m.elapsed_ratio >= 1     then 'danger'
    when m.elapsed_ratio >= 0.75  then 'warning'
    when m.elapsed_ratio >= 0.5   then 'info'
    else 'neutral'
  end                         as color,
  (a.allocated_minutes is null and a.status = 'in_progress') as awaiting_duration,
  (si.requires_receive and a.received_at is null and a.status = 'in_progress')
                              as awaiting_receive,
  -- كم مشاركًا على هذه المرحلة وكم أنجز — ليظهر «أنجز ١ من ٣» في الوارد
  sc.participants_count,
  sc.stage_done_count
from public.transaction_assignments a
join public.transaction_stage_instances si on si.id = a.stage_instance_id
join public.transactions t on t.id = a.transaction_id
left join public.projects pr on pr.id = t.project_id
left join public.profiles pf on pf.id = a.assignee_id
left join public.profiles rq on rq.id = t.requested_by
cross join lateral (
  select
    count(*)::int as participants_count,
    count(*) filter (where x.status = 'done')::int as stage_done_count
  from public.transaction_assignments x
  where x.stage_instance_id = si.id
) sc
cross join lateral (
  select
    e.mins as elapsed_minutes,
    case
      when a.allocated_minutes is null or a.allocated_minutes = 0 then null
      else round(e.mins::numeric / a.allocated_minutes, 4)
    end as elapsed_ratio
  from (
    select public.business_minutes_between(
             a.arrived_at, coalesce(a.completed_at, now()), a.assignee_id
           ) as mins
  ) e
) m;

comment on view public.transaction_inbox is
  'صندوق الوارد: صفّ لكل تكليف. عدّاد داخل الدوام وألوان الحالة [المراسلات 25]. '
  'زمن العمل يُحسب مرة واحدة لكل صفّ وتُشتقّ منه النسبة واللون والمتبقّي.';

-- ── تقدّم المرحلة: كم مشاركًا وكم أنجز ─────────────────────────────────
-- تحتاجه الواجهة لتقول «المرحلة عند ٣، أنجز ١» بدل تكرار العدّ في المتصفّح.
create view public.transaction_stage_progress
with (security_invoker = true) as
select
  si.id                                              as stage_instance_id,
  si.transaction_id,
  si.seq,
  si.stage_key,
  si.name                                            as stage_name,
  si.status                                          as stage_status,
  si.completion_policy,
  si.quorum_count,
  si.is_final,
  si.is_archive,
  si.requires_receive,
  si.entered_at,
  si.completed_at,
  count(a.id)                                        as participants_count,
  count(a.id) filter (where a.status = 'done')       as done_count,
  count(a.id) filter (where not a.is_optional
                        and a.status <> 'cancelled') as required_count,
  count(a.id) filter (where a.status = 'in_progress') as pending_count,
  count(a.id) filter (where a.allocated_minutes is null
                        and a.status = 'in_progress') as awaiting_duration_count,
  round(avg(a.score) filter (where a.score is not null), 2) as avg_score
from public.transaction_stage_instances si
left join public.transaction_assignments a on a.stage_instance_id = si.id
group by si.id;

comment on view public.transaction_stage_progress is
  'تقدّم المرحلة الواحدة عبر مشاركيها — أساس عرض «٣ مشاركين، أنجز ١».';

-- ── التقييم [المراسلات 11-18] ──────────────────────────────────────────
-- المصدر صار التكليفات: التوازي يعني أن المعاملة الواحدة تنتج عدة درجات
-- لعدة موظفين في المرحلة نفسها، وهو المطلوب.
create view public.employee_evaluation_summary
with (security_invoker = true) as
with completion as (
  select
    a.assignee_id as user_id,
    to_char(a.completed_at at time zone public.app_timezone(), 'YYYY-MM') as period,
    'completion'::text as criteria_key,
    avg(a.score) as score,
    count(*)::int as completed_steps
  from public.transaction_assignments a
  where a.status = 'done'
    and a.score is not null
    and a.assignee_id is not null
    and a.completed_at is not null
  group by 1, 2
),
manual as (
  select
    es.user_id,
    es.period,
    ec.key as criteria_key,
    avg(es.score) as score,
    0 as completed_steps
  from public.evaluation_scores es
  join public.evaluation_criteria ec on ec.id = es.criteria_id
  where ec.is_active
  group by 1, 2, 3
),
components as (
  select * from completion
  union all
  select * from manual
),
weighted as (
  select
    c.user_id,
    c.period,
    sum(c.score * w.weight) / nullif(sum(w.weight), 0) as weighted_score,
    sum(c.completed_steps) as completed_steps
  from components c
  join public.profiles p on p.id = c.user_id
  join public.evaluation_criteria ec on ec.key = c.criteria_key and ec.is_active
  join public.evaluation_weights w
    on w.criteria_id = ec.id and w.employee_type = p.employee_type
  where not exists (
    select 1 from public.evaluation_exclusions x where x.user_id = c.user_id
  )
  group by c.user_id, c.period
)
select
  w.user_id,
  p.full_name,
  p.employee_type,
  w.period,
  round(w.weighted_score, 2) as weighted_score,
  w.completed_steps,
  rank() over (partition by w.period order by w.weighted_score desc) as rank_in_period
from weighted w
join public.profiles p on p.id = w.user_id;

comment on view public.employee_evaluation_summary is
  'متوسطات التقييم بالأوزان حسب الفئة مع الترتيب [المراسلات 17، 18]. '
  'مصدر درجة الإنجاز تكليفات الموظف لا مراحل المعاملة.';

-- ── المدد المعدّلة [المراسلات 5] ───────────────────────────────────────
create view public.duration_change_report
with (security_invoker = true) as
select
  dcl.id                   as change_id,
  dcl.assignment_id,
  a.stage_instance_id,
  a.transaction_id,
  t.no                     as transaction_no,
  t.type                   as transaction_type,
  t.subject,
  t.project_id,
  p.name                   as project_name,
  si.name                  as stage_name,
  si.seq,
  a.assignee_id,
  asg.full_name            as assignee_name,
  dcl.old_minutes,
  dcl.new_minutes,
  dcl.new_minutes - coalesce(dcl.old_minutes, 0) as delta_minutes,
  dcl.reason,
  dcl.changed_by,
  chg.full_name            as changed_by_name,
  dcl.changed_at,
  -- التعديل بعد انتهاء التكليف هو ما يستحقّ المراجعة فعلًا [المراسلات 5]
  (a.completed_at is not null and dcl.changed_at > a.completed_at)
                           as changed_after_completion
from public.duration_change_log dcl
join public.transaction_assignments a on a.id = dcl.assignment_id
join public.transaction_stage_instances si on si.id = a.stage_instance_id
join public.transactions t on t.id = a.transaction_id
left join public.projects p on p.id = t.project_id
left join public.profiles asg on asg.id = a.assignee_id
left join public.profiles chg on chg.id = dcl.changed_by
where public.can_read_operational_reports();

comment on view public.duration_change_report is
  'المدد المعدّلة: قبل وبعد ومن عدّل، وهل كان التعديل بعد الإنجاز [المراسلات 5].';

-- ── المعاملات المتأخّرة ────────────────────────────────────────────────
create view public.overdue_transactions_report
with (security_invoker = true) as
select
  ti.assignment_id,
  ti.stage_instance_id,
  ti.transaction_id,
  ti.transaction_no,
  ti.transaction_type,
  ti.subject,
  ti.project_id,
  ti.project_name,
  ti.stage_name,
  ti.seq,
  ti.assignee_id,
  ti.assignee_name,
  ti.allocated_minutes,
  ti.elapsed_minutes,
  ti.remaining_minutes,
  ti.elapsed_ratio,
  ti.arrived_at,
  ti.due_at,
  (ti.completed_at is not null) as was_completed_late
from public.transaction_inbox ti
where public.can_read_operational_reports()
  and ti.allocated_minutes is not null
  and ti.elapsed_minutes > ti.allocated_minutes;

comment on view public.overdue_transactions_report is
  'التكليفات التي تجاوزت مدّتها بحساب أوقات الدوام — نفس عدّاد صندوق الوارد.';

-- ── تردّد المعاملات على القسم [المراسلات 24] ───────────────────────────
-- القسم صار يأتي من قسم الموظف المكلَّف لا من تعريف المرحلة: المشاركون
-- قد يكونون من أقسام مختلفة على المرحلة الواحدة، فقسم المرحلة لم يعد مفردًا.
create view public.department_frequency_report
with (security_invoker = true) as
select
  d.id                                   as department_id,
  d.name                                 as department_name,
  t.type                                 as transaction_type,
  count(distinct t.id)                   as transactions_count,
  count(a.id)                            as visits_count,
  round(count(a.id)::numeric / nullif(count(distinct t.id), 0), 2)
                                         as visits_per_transaction,
  count(*) filter (where a.status = 'done')                as done_count,
  round(avg(a.score) filter (where a.score is not null), 2) as avg_score
from public.transaction_assignments a
join public.transactions t on t.id = a.transaction_id
join public.profiles pf on pf.id = a.assignee_id
join public.departments d on d.id = pf.department_id
where public.can_read_operational_reports()
group by d.id, d.name, t.type;

comment on view public.department_frequency_report is
  'كم مرّة تمرّ المعاملة على القسم نفسه — كشف الدوران غير المبرَّر [المراسلات 24].';

revoke all on
  public.transaction_inbox,
  public.transaction_stage_progress,
  public.employee_evaluation_summary,
  public.duration_change_report,
  public.overdue_transactions_report,
  public.department_frequency_report
  from anon;

grant select on
  public.transaction_inbox,
  public.transaction_stage_progress,
  public.employee_evaluation_summary,
  public.duration_change_report,
  public.overdue_transactions_report,
  public.department_frequency_report
  to authenticated;
