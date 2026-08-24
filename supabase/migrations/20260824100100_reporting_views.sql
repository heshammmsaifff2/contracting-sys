-- Phase 8 — التقارير الشاملة العابرة للوحدات
--
-- كل تقرير هنا يجمع بيانات أكثر من وحدة، ولهذا لم يكن مكانه أي مرحلة سابقة.
-- المبدأ نفسه المتبَّع في تقارير المخازن: الحساب كلّه في Postgres، والواجهة تعرض
-- فقط — فلا تختلف الأرقام بين شاشة وأخرى ولا يتكرّر المنطق في المتصفّح.
--
-- كل العروض `security_invoker = true`: تُطبَّق سياسات الجداول الأصلية على القارئ،
-- فلا يرى الموظف في التقرير ما لا يراه في شاشته. لا حاجة لسياسة على العرض نفسه.

-- ── 1) تكلفة المشروع مجمّعة من كل المصادر ──────────────────────────────
-- تكلفة العمالة ليست هنا عمدًا: مصدرها `profile_salaries` المحميّة بـ RLS،
-- فضمّها كان سيُنقص الإجمالي صامتًا لمن لا يملك `user.read_salary`.
-- مكانها العرض المستقل `project_labor_cost` وتُعرض بجانبه في الواجهة.
create or replace view public.project_cost_summary
with (security_invoker = true) as
select
  p.id                                as project_id,
  p.code                              as project_code,
  p.name                              as project_name,
  p.status                            as project_status,
  p.contract_value,
  coalesce(so.total, 0)               as supply_total,
  coalesce(cu.total, 0)               as custody_total,
  coalesce(ex.total, 0)               as extract_total,
  coalesce(ad.total, 0)               as advance_total,
  coalesce(so.total, 0) + coalesce(cu.total, 0)
    + coalesce(ex.total, 0) + coalesce(ad.total, 0)
                                      as committed_total,
  coalesce(pay.total, 0)              as paid_total,
  p.contract_value - (
    coalesce(so.total, 0) + coalesce(cu.total, 0)
    + coalesce(ex.total, 0) + coalesce(ad.total, 0)
  )                                   as remaining_budget,
  case
    when p.contract_value = 0 then null
    else round((
      coalesce(so.total, 0) + coalesce(cu.total, 0)
      + coalesce(ex.total, 0) + coalesce(ad.total, 0)
    ) / p.contract_value, 4)
  end                                 as consumed_ratio
from public.projects p
-- التوريدات: تُحمَّل على المشروع من سطر أمر التوريد لا من رأسه،
-- لأن الأمر الواحد قد يخدم أكثر من مشروع [المشتريات 7].
left join lateral (
  select sum(sol.qty * sol.unit_price) as total
  from public.supply_order_lines sol
  join public.supply_orders so2 on so2.id = sol.so_id
  where sol.project_id = p.id
    and so2.status in ('approved', 'received')
) so on true
left join lateral (
  select sum(c.total_amount) as total
  from public.custodies c
  where c.project_id = p.id
    and c.status in ('approved', 'closed')
) cu on true
left join lateral (
  select sum(e.net_amount) as total
  from public.extracts e
  where e.project_id = p.id
    and e.status in ('approved', 'paid')
) ex on true
left join lateral (
  select sum(a.amount) as total
  from public.advance_payments a
  where a.project_id = p.id
    and a.status in ('approved', 'paid')
) ad on true
left join lateral (
  select sum(pr.amount) as total
  from public.payment_requests pr
  where pr.project_id = p.id
    and pr.status = 'transferred'
) pay on true
where public.can_read_financial_reports();

comment on view public.project_cost_summary is
  'تكلفة المشروع من كل المصادر (توريد/عهد/مستخلصات/دفعات) مقابل قيمة العقد. '
  'تكلفة العمالة في project_labor_cost لأن مصدرها محميّ بـ RLS.';

-- ── 2) أرصدة الأطراف من دفتر الأستاذ ───────────────────────────────────
-- مصدرها القيود لا المستندات: هذا هو الرصيد المحاسبي الفعلي بعد كل
-- استحقاق وصرف، لا مجرّد جمع لمستندات وحدة واحدة.
create or replace view public.party_balances
with (security_invoker = true) as
select
  jl.party_type,
  jl.party_id,
  case jl.party_type
    when 'supplier'   then s.name
    when 'contractor' then ct.name
    else pf.full_name
  end                                       as party_name,
  case jl.party_type
    when 'supplier'   then s.code
    when 'contractor' then ct.code
    else pf.code
  end                                       as party_code,
  a.code                                    as account_code,
  a.name                                    as account_name,
  a.type                                    as account_type,
  count(*)                                  as lines_count,
  coalesce(sum(jl.debit), 0)                as debit_total,
  coalesce(sum(jl.credit), 0)               as credit_total,
  -- الرصيد بإشارة طبيعة الحساب: الدائن موجب على الخصوم، والمدين موجب على الأصول
  case a.type
    when 'liability' then coalesce(sum(jl.credit), 0) - coalesce(sum(jl.debit), 0)
    else coalesce(sum(jl.debit), 0) - coalesce(sum(jl.credit), 0)
  end                                       as balance,
  max(je.entry_date)                        as last_entry_date
from public.journal_lines jl
join public.journal_entries je on je.id = jl.entry_id
join public.accounts a on a.id = jl.account_id
left join public.suppliers s
  on jl.party_type = 'supplier' and s.id = jl.party_id
left join public.contractors ct
  on jl.party_type = 'contractor' and ct.id = jl.party_id
left join public.profiles pf
  on jl.party_type in ('worker', 'employee') and pf.id = jl.party_id
where public.can_read_financial_reports()
  and jl.party_type is not null
  and jl.party_id is not null
group by
  jl.party_type, jl.party_id, s.name, ct.name, pf.full_name,
  s.code, ct.code, pf.code, a.code, a.name, a.type;

comment on view public.party_balances is
  'أرصدة الموردين والمقاولين والعمال من دفتر الأستاذ — المصدر الوحيد للمديونية.';

-- ── 3) القيود اليدوية [الحسابات 17] ────────────────────────────────────
-- القيد اليدوي استثناء بصلاحية تُفتح وتُغلق، فوجب أن يكون مرئيًا ومسمّى صاحبه.
create or replace view public.manual_entries_report
with (security_invoker = true) as
select
  je.id                          as entry_id,
  je.entry_no,
  je.entry_date,
  je.description,
  je.source_type,
  je.project_id,
  p.name                         as project_name,
  je.posted_by,
  pf.full_name                   as posted_by_name,
  je.created_at,
  coalesce(sum(jl.debit), 0)     as total_debit,
  coalesce(sum(jl.credit), 0)    as total_credit,
  -- القيود التي نقلت مبلغًا من الذمم إلى المصروف تُرصد صراحةً [الحسابات 17]
  bool_or(dr.type = 'expense')
    and bool_or(cr.code like '13%' or cr.code like '21%')
                                 as moves_receivable_to_expense
from public.journal_entries je
join public.journal_lines jl on jl.entry_id = je.id
left join public.accounts dr on dr.id = jl.account_id and jl.debit > 0
left join public.accounts cr on cr.id = jl.account_id and jl.credit > 0
left join public.projects p on p.id = je.project_id
left join public.profiles pf on pf.id = je.posted_by
where public.can_read_financial_reports()
  and je.is_manual
group by
  je.id, je.entry_no, je.entry_date, je.description, je.source_type,
  je.project_id, p.name, je.posted_by, pf.full_name, je.created_at;

comment on view public.manual_entries_report is
  'كل قيد يدوي ومن رحّله، ورصد ما نقل مبلغًا من الذمم إلى المصروف [الحسابات 17].';

-- ── 4) المعاملات التي لم تُستلم أصولها [المراسلات 22] ──────────────────
create or replace view public.archive_pending_report
with (security_invoker = true) as
select
  t.id                     as transaction_id,
  t.no                     as transaction_no,
  t.type                   as transaction_type,
  t.subject,
  t.status                 as transaction_status,
  t.project_id,
  p.name                   as project_name,
  t.requested_by,
  rq.full_name             as requested_by_name,
  t.created_at,
  t.closed_at,
  ar.received,
  ar.has_original,
  ar.received_at,
  ar.notes,
  -- الأيام منذ إغلاق المعاملة بلا استلام أصل — ترتيب الإلحاح
  case
    when ar.received then null
    else floor(
      extract(epoch from now() - coalesce(t.closed_at, t.created_at)) / 86400
    )::integer
  end                      as days_pending
from public.transactions t
left join public.archive_receipts ar on ar.transaction_id = t.id
left join public.projects p on p.id = t.project_id
left join public.profiles rq on rq.id = t.requested_by
-- المعاملة الجارية لم يحن دور أرشيفها بعد: القائمة تقتصر على ما أُغلق فعلًا
-- أو ما فُتح له سجل استلام ولم يكتمل.
where public.can_read_operational_reports()
  and (t.is_closed or t.status = 'completed' or ar.transaction_id is not null)
  and (coalesce(ar.received, false) = false
       or coalesce(ar.has_original, false) = false);

comment on view public.archive_pending_report is
  'المعاملات التي لم يُستلم أصلها في الأرشيف [المراسلات 22].';

-- ── 5) المدد المعدّلة: قبل/بعد/الموظف [المراسلات 5] ────────────────────
create or replace view public.duration_change_report
with (security_invoker = true) as
select
  dcl.id                   as change_id,
  dcl.step_instance_id,
  tsi.transaction_id,
  t.no                     as transaction_no,
  t.type                   as transaction_type,
  t.subject,
  t.project_id,
  p.name                   as project_name,
  tsi.name                 as step_name,
  tsi.order_no,
  tsi.assignee_id,
  asg.full_name            as assignee_name,
  dcl.old_minutes,
  dcl.new_minutes,
  dcl.new_minutes - coalesce(dcl.old_minutes, 0) as delta_minutes,
  dcl.reason,
  dcl.changed_by,
  chg.full_name            as changed_by_name,
  dcl.changed_at,
  -- التعديل بعد انتهاء المرحلة هو ما يستحقّ المراجعة فعلًا [المراسلات 5]
  (tsi.completed_at is not null and dcl.changed_at > tsi.completed_at)
                           as changed_after_completion
from public.duration_change_log dcl
join public.transaction_step_instances tsi on tsi.id = dcl.step_instance_id
join public.transactions t on t.id = tsi.transaction_id
left join public.projects p on p.id = t.project_id
left join public.profiles asg on asg.id = tsi.assignee_id
left join public.profiles chg on chg.id = dcl.changed_by
where public.can_read_operational_reports();

comment on view public.duration_change_report is
  'المدد المعدّلة: القيمة قبل وبعد ومن عدّلها، وهل كان التعديل بعد الإنجاز [المراسلات 5].';

-- ── 6) المعاملات المتأخّرة ─────────────────────────────────────────────
-- تعتمد على العدّاد داخل الدوام نفسه المستخدَم في صندوق الوارد،
-- فلا يختلف «متأخّر» بين الشاشة والتقرير.
create or replace view public.overdue_transactions_report
with (security_invoker = true) as
select
  ti.step_instance_id,
  ti.transaction_id,
  ti.transaction_no,
  ti.transaction_type,
  ti.subject,
  ti.project_id,
  ti.project_name,
  ti.step_name,
  ti.order_no,
  ti.assignee_id,
  ti.assignee_name,
  ti.allocated_minutes,
  ti.elapsed_minutes,
  ti.remaining_minutes,
  ti.elapsed_ratio,
  ti.arrived_at,
  ti.due_at,
  -- تأخّر بلا إنجاز، أو أُنجز بعد موعده
  (ti.completed_at is not null) as was_completed_late
from public.transaction_inbox ti
where public.can_read_operational_reports()
  and ti.allocated_minutes is not null
  and ti.elapsed_minutes > ti.allocated_minutes;

comment on view public.overdue_transactions_report is
  'المعاملات التي تجاوزت مدّتها بحساب أوقات الدوام — نفس عدّاد صندوق الوارد.';

-- ── 7) تردّد المعاملات على نفس القسم [المراسلات 24] ────────────────────
create or replace view public.department_frequency_report
with (security_invoker = true) as
select
  d.id                                   as department_id,
  d.name                                 as department_name,
  t.type                                 as transaction_type,
  count(distinct t.id)                   as transactions_count,
  count(tsi.id)                          as visits_count,
  -- أكثر من زيارة للقسم نفسه في المعاملة الواحدة = تردّد يستحقّ المراجعة
  round(count(tsi.id)::numeric / nullif(count(distinct t.id), 0), 2)
                                         as visits_per_transaction,
  count(*) filter (where tsi.status = 'done')    as done_count,
  round(avg(tsi.score) filter (where tsi.score is not null), 2) as avg_score
from public.transaction_step_instances tsi
join public.transactions t on t.id = tsi.transaction_id
join public.workflow_steps ws on ws.id = tsi.step_id
join public.departments d on d.id = ws.department_id
where public.can_read_operational_reports()
group by d.id, d.name, t.type;

comment on view public.department_frequency_report is
  'كم مرّة تمرّ المعاملة على القسم نفسه — كشف الدوران غير المبرَّر [المراسلات 24].';

-- ── العروض ممنوعة على الزائر ───────────────────────────────────────────
revoke all on
  public.project_cost_summary,
  public.party_balances,
  public.manual_entries_report,
  public.archive_pending_report,
  public.duration_change_report,
  public.overdue_transactions_report,
  public.department_frequency_report
  from anon;
