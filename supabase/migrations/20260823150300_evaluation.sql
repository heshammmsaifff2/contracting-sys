-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4 — محرّك التقييم [المراسلات 11–18]
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  -- completion يُحسب آليًا من زمن الإنجاز؛ البقية تُقيَّم يدويًا
  kind text not null default 'manual' check (kind in ('completion', 'manual')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists evaluation_criteria_set_updated_at on public.evaluation_criteria;
create trigger evaluation_criteria_set_updated_at
  before update on public.evaluation_criteria
  for each row execute function public.set_updated_at();

-- أوزان مختلفة حسب فئة الموظف [المراسلات: إداري 70٪ / مهندس 20٪]
create table if not exists public.evaluation_weights (
  criteria_id uuid not null
    references public.evaluation_criteria (id) on delete cascade,
  employee_type text not null
    check (employee_type in ('admin', 'engineer', 'supervisor')),
  weight numeric(6, 2) not null check (weight >= 0),
  primary key (criteria_id, employee_type)
);

create table if not exists public.evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  criteria_id uuid not null
    references public.evaluation_criteria (id) on delete cascade,
  -- الفترة بصيغة YYYY-MM
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  score numeric(6, 2) not null check (score >= 0 and score <= 100),
  note text not null default '',
  rated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, criteria_id, period, rated_by)
);

comment on table public.evaluation_scores is
  'تقييم من كل من تولّى الإشراف — لذا rated_by جزء من المفتاح [المراسلات 15].';

-- استثناء موظفين من التقييم [المراسلات 16]
create table if not exists public.evaluation_exclusions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

-- ── بنود التقييم وأوزانها الافتراضية — كلها قابلة للتعديل ──────────────
insert into public.evaluation_criteria (key, name, kind) values
  ('completion', 'الإنجاز في الوقت', 'completion'),
  ('behavior',   'السلوك',           'manual'),
  ('efficiency', 'الكفاءة الفنية',   'manual'),
  ('discipline', 'الانضباط',         'manual')
on conflict (key) do update set name = excluded.name;

insert into public.evaluation_weights (criteria_id, employee_type, weight)
select c.id, w.employee_type, w.weight
from public.evaluation_criteria c
join (values
  ('completion', 'admin',      70),
  ('completion', 'engineer',   20),
  ('completion', 'supervisor', 40),
  ('behavior',   'admin',      10),
  ('behavior',   'engineer',   25),
  ('behavior',   'supervisor', 20),
  ('efficiency', 'admin',      10),
  ('efficiency', 'engineer',   40),
  ('efficiency', 'supervisor', 25),
  ('discipline', 'admin',      10),
  ('discipline', 'engineer',   15),
  ('discipline', 'supervisor', 15)
) as w(key, employee_type, weight) on w.key = c.key
on conflict (criteria_id, employee_type) do update set weight = excluded.weight;

/**
 * ملخّص التقييم لكل موظف في كل فترة، بالوزن المناسب لفئته، مع الترتيب.
 * درجة الإنجاز تأتي آليًا من زمن إنجاز المراحل؛ البقية من التقييمات اليدوية.
 */
create or replace view public.employee_evaluation_summary
with (security_invoker = true) as
with completion as (
  select
    tsi.assignee_id as user_id,
    to_char(tsi.completed_at at time zone public.app_timezone(), 'YYYY-MM') as period,
    'completion'::text as criteria_key,
    avg(tsi.score) as score,
    count(*)::int as completed_steps
  from public.transaction_step_instances tsi
  where tsi.status = 'done'
    and tsi.score is not null
    and tsi.assignee_id is not null
    and tsi.completed_at is not null
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
  'متوسطات التقييم بالأوزان حسب الفئة، مع الترتيب داخل كل فترة [المراسلات 17، 18].';
