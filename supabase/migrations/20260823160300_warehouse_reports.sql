-- ═══════════════════════════════════════════════════════════════════════
-- Phase 5 — تقارير المخازن
-- كل الحساب في Postgres: العروض تُقرأ بـ security_invoker فتسري عليها
-- سياسات الجداول الأصلية، فلا يرى أحد مشروعًا غير معتمد له.
-- ═══════════════════════════════════════════════════════════════════════

-- عتبة الهدر: كم ضِعف متوسط المشروع يُعدّ هدرًا؟ رقم قابل للتعديل لا سحري.
insert into public.settings (key, value, description, category) values
  ('waste_deviation_ratio', '1.5'::jsonb,
   'نسبة تجاوز متوسط الاستهلاك لكل وحدة وزن التي تُعدّ هدرًا (1.5 = ضعف ونصف)',
   'warehouse'),
  ('consumption_trend_months', '[3, 6, 12]'::jsonb,
   'فترات التقرير التراكمي للاستهلاك بالأشهر', 'warehouse')
on conflict (key) do update
  set description = excluded.description, category = excluded.category;

create or replace function public.waste_deviation_ratio()
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (value #>> '{}')::numeric from public.settings where key = 'waste_deviation_ratio'),
    1.5
  );
$$;

revoke execute on function public.waste_deviation_ratio() from public, anon;
grant execute on function public.waste_deviation_ratio() to authenticated;

-- ── عهدة المندوبين بالأسماء ────────────────────────────────────────────
create or replace view public.mandoub_stock_view
with (security_invoker = true) as
select
  ms.project_id,
  p.code  as project_code,
  p.name  as project_name,
  ms.user_id as mandoub_id,
  pr.full_name as mandoub_name,
  ms.item_id,
  i.code  as item_code,
  i.name  as item_name,
  i.unit  as item_unit,
  ms.quantity,
  ms.updated_at
from public.mandoub_stock ms
join public.projects p on p.id = ms.project_id
join public.profiles pr on pr.id = ms.user_id
join public.items i on i.id = ms.item_id;

-- ── الاستهلاك بالأسماء ─────────────────────────────────────────────────
create or replace view public.facility_consumption_view
with (security_invoker = true) as
select
  c.id,
  c.batch_id,
  c.facility_id,
  f.code as facility_code,
  f.name as facility_name,
  f.group_name,
  f.district,
  f.weight as facility_weight,
  c.project_id,
  p.name as project_name,
  c.item_id,
  i.code as item_code,
  i.name as item_name,
  i.unit as item_unit,
  c.qty,
  c.mandoub_id,
  m.full_name as mandoub_name,
  c.supervisor_id,
  s.full_name as supervisor_name,
  c.consumed_at,
  c.note,
  c.photos
from public.facility_consumption c
join public.facilities f on f.id = c.facility_id
join public.projects p on p.id = c.project_id
join public.items i on i.id = c.item_id
left join public.profiles m on m.id = c.mandoub_id
left join public.profiles s on s.id = c.supervisor_id;

-- ── تقرير الهدر بالوزن النسبي [المخازن 9] ──────────────────────────────
-- منشأتان بنفس الحي قد تختلفان حجمًا، فالمقارنة العادلة هي:
-- الكمية ÷ وزن المنشأة، مقيسة إلى متوسط المشروع لنفس الصنف.
create or replace view public.facility_waste_report
with (security_invoker = true) as
with per_facility as (
  select
    c.project_id,
    c.item_id,
    c.facility_id,
    max(f.name)       as facility_name,
    max(f.group_name) as group_name,
    max(f.district)   as district,
    max(f.weight)     as weight,
    sum(c.qty)        as qty,
    max(c.consumed_at) as last_consumed_at
  from public.facility_consumption c
  join public.facilities f on f.id = c.facility_id
  group by c.project_id, c.item_id, c.facility_id
),
rated as (
  select pf.*, pf.qty / nullif(pf.weight, 0) as qty_per_weight
  from per_facility pf
),
project_avg as (
  select project_id, item_id, avg(qty_per_weight) as avg_qty_per_weight
  from rated
  group by project_id, item_id
)
select
  r.project_id,
  p.name as project_name,
  r.item_id,
  i.code as item_code,
  i.name as item_name,
  i.unit as item_unit,
  r.facility_id,
  r.facility_name,
  r.group_name,
  r.district,
  r.weight,
  r.qty,
  r.qty_per_weight,
  a.avg_qty_per_weight,
  r.qty_per_weight / nullif(a.avg_qty_per_weight, 0) as deviation_ratio,
  (
    r.qty_per_weight / nullif(a.avg_qty_per_weight, 0)
  ) > public.waste_deviation_ratio() as is_wasteful,
  r.last_consumed_at
from rated r
join project_avg a on a.project_id = r.project_id and a.item_id = r.item_id
join public.projects p on p.id = r.project_id
join public.items i on i.id = r.item_id;

comment on view public.facility_waste_report is
  'الاستهلاك لكل وحدة وزن مقيسًا لمتوسط المشروع — ما تجاوز العتبة يُعدّ هدرًا.';

-- ── مقارنة المشاريع ────────────────────────────────────────────────────
-- الوزن يُجمع لكل منشأة مرة واحدة، وإلا تكرّر بعدد أسطر استهلاكها.
create or replace view public.project_consumption_summary
with (security_invoker = true) as
with totals as (
  select
    c.project_id,
    c.item_id,
    sum(c.qty) as qty,
    count(distinct c.facility_id) as facilities_count,
    count(distinct c.batch_id) as downloads_count,
    max(c.consumed_at) as last_consumed_at
  from public.facility_consumption c
  group by c.project_id, c.item_id
),
weights as (
  select d.project_id, d.item_id, sum(f.weight) as total_weight
  from (
    select distinct project_id, item_id, facility_id from public.facility_consumption
  ) d
  join public.facilities f on f.id = d.facility_id
  group by d.project_id, d.item_id
)
select
  t.project_id,
  p.code as project_code,
  p.name as project_name,
  t.item_id,
  i.code as item_code,
  i.name as item_name,
  i.unit as item_unit,
  t.qty,
  t.facilities_count,
  t.downloads_count,
  w.total_weight,
  t.qty / nullif(w.total_weight, 0) as qty_per_weight,
  t.last_consumed_at
from totals t
join weights w on w.project_id = t.project_id and w.item_id = t.item_id
join public.projects p on p.id = t.project_id
join public.items i on i.id = t.item_id;

-- ── مقارنة المشرفين ────────────────────────────────────────────────────
create or replace view public.supervisor_consumption_summary
with (security_invoker = true) as
select
  c.supervisor_id,
  s.full_name as supervisor_name,
  c.project_id,
  p.name as project_name,
  count(distinct c.batch_id)    as downloads_count,
  count(distinct c.facility_id) as facilities_count,
  sum(c.qty)                    as total_qty,
  count(*) filter (where jsonb_array_length(c.photos) > 0) as with_photos,
  max(c.consumed_at)            as last_consumed_at
from public.facility_consumption c
join public.projects p on p.id = c.project_id
left join public.profiles s on s.id = c.supervisor_id
group by c.supervisor_id, s.full_name, c.project_id, p.name;

/**
 * التراكمي لآخر N شهرًا (3/6/12) لمشروع أو لكل المشاريع المرئية.
 * دالة عادية (لا SECURITY DEFINER) فتسري عليها RLS كما هي.
 */
create or replace function public.consumption_trend(
  p_months integer default 6,
  p_project_id uuid default null,
  p_item_id uuid default null
)
returns table (
  period text,
  qty numeric,
  cumulative_qty numeric,
  downloads_count bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with months as (
    select to_char(
             generate_series(
               date_trunc('month', now()) - make_interval(months => greatest(p_months, 1) - 1),
               date_trunc('month', now()),
               interval '1 month'
             ),
             'YYYY-MM'
           ) as period
  ),
  totals as (
    select
      to_char(date_trunc('month', c.consumed_at), 'YYYY-MM') as period,
      sum(c.qty) as qty,
      count(distinct c.batch_id) as downloads_count
    from public.facility_consumption c
    where (p_project_id is null or c.project_id = p_project_id)
      and (p_item_id is null or c.item_id = p_item_id)
      and c.consumed_at >= date_trunc('month', now())
                           - make_interval(months => greatest(p_months, 1) - 1)
    group by 1
  )
  select
    m.period,
    coalesce(t.qty, 0) as qty,
    sum(coalesce(t.qty, 0)) over (order by m.period) as cumulative_qty,
    coalesce(t.downloads_count, 0) as downloads_count
  from months m
  left join totals t on t.period = m.period
  order by m.period;
$$;

revoke execute on function public.consumption_trend(integer, uuid, uuid) from public, anon;
grant execute on function public.consumption_trend(integer, uuid, uuid) to authenticated;
