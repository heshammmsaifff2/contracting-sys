-- ═══════════════════════════════════════════════════════════════════════
-- Phase 7 — سلف العمالة والأجور والتقييم
-- السلفة تُطلب من العامل نفسه (الخدمة الذاتية [7])، وتُعتمد بصلاحية،
-- ثم تمرّ بآلة التحويلات نفسها فيُسجَّل قيد «ذمم العامل / البنك» آليًا.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  worker_id uuid not null references public.employees (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  -- التقسيط: عدد الأشهر التي تُخصم عليها من المستحقّ
  installments integer not null default 1 check (installments > 0),
  reason text not null default '',
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'paid', 'settled')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.loans is
  'سلفة عامل — يطلبها بنفسه من الخدمة الذاتية [شؤون الموظفين 7]، ويعتمدها صاحب الصلاحية.';

create index if not exists loans_worker_idx on public.loans (worker_id, status);
create index if not exists loans_status_idx on public.loans (status, created_at desc);

drop trigger if exists loans_set_updated_at on public.loans;
create trigger loans_set_updated_at before update on public.loans
  for each row execute function public.set_updated_at();

drop trigger if exists loans_set_created_by on public.loans;
create trigger loans_set_created_by before insert on public.loans
  for each row execute function public.set_created_by();

/**
 * البتّ في السلفة: الاعتماد يولّد طلب دفع للعامل، فيمرّ بالتحويل البنكي
 * نفسه ويُسجَّل قيده آليًا (ذمم العامل مدين / البنك دائن).
 */
create or replace function public.decide_loan(
  p_loan_id uuid,
  p_approve boolean,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loan public.loans%rowtype;
begin
  if not public.has_permission('loan.approve') then
    raise exception 'يتطلّب صلاحية loan.approve'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_loan from public.loans where id = p_loan_id;
  if not found then
    raise exception 'السلفة غير موجودة' using errcode = 'no_data_found';
  end if;
  if v_loan.status <> 'requested' then
    raise exception 'تم البتّ في السلفة سلفًا' using errcode = 'check_violation';
  end if;

  update public.loans
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note = coalesce(p_note, '')
   where id = p_loan_id;

  if p_approve then
    insert into public.payment_requests
      (source_type, source_id, party_type, party_id, project_id, amount, status, created_by)
    values
      ('loan', p_loan_id, 'worker', v_loan.worker_id, v_loan.project_id,
       v_loan.amount, 'pending', auth.uid())
    on conflict (source_type, source_id, party_id) do nothing;
  end if;

  return p_loan_id;
end;
$$;

revoke execute on function public.decide_loan(uuid, boolean, text) from public, anon;
grant execute on function public.decide_loan(uuid, boolean, text) to authenticated;

-- ── تعديلات الأجر: لا يتغيّر أجر بلا أثر ───────────────────────────────
create table if not exists public.salary_changes (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles (id) on delete cascade,
  old_base numeric(14, 2) not null default 0,
  new_base numeric(14, 2) not null default 0,
  old_daily numeric(14, 2) not null default 0,
  new_daily numeric(14, 2) not null default 0,
  effective_from date not null default current_date,
  reason text not null default '',
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.salary_changes is
  'سجل تغيّر الأجر: القيمة قبل وبعد ومن اعتمدها — للمراجعة لا للعرض العام.';

create index if not exists salary_changes_worker_idx
  on public.salary_changes (worker_id, created_at desc);

/**
 * تغيير الأجر مع تسجيل الأثر في معاملة واحدة.
 */
create or replace function public.change_worker_salary(
  p_worker_id uuid,
  p_new_base numeric,
  p_new_daily numeric,
  p_effective_from date default current_date,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_base numeric(14, 2) := 0;
  v_old_daily numeric(14, 2) := 0;
  v_id uuid;
begin
  if not public.has_permission('user.manage_salary') then
    raise exception 'يتطلّب صلاحية user.manage_salary'
      using errcode = 'insufficient_privilege';
  end if;

  if p_new_base < 0 or p_new_daily < 0 then
    raise exception 'الأجر لا يكون سالبًا' using errcode = 'check_violation';
  end if;

  select base_salary, daily_wage into v_old_base, v_old_daily
    from public.profile_salaries where profile_id = p_worker_id;

  insert into public.profile_salaries (profile_id, base_salary, daily_wage, updated_by)
  values (p_worker_id, p_new_base, p_new_daily, auth.uid())
  on conflict (profile_id) do update
    set base_salary = excluded.base_salary,
        daily_wage = excluded.daily_wage,
        updated_by = excluded.updated_by;

  insert into public.salary_changes
    (worker_id, old_base, new_base, old_daily, new_daily,
     effective_from, reason, approved_by)
  values
    (p_worker_id, coalesce(v_old_base, 0), p_new_base,
     coalesce(v_old_daily, 0), p_new_daily,
     coalesce(p_effective_from, current_date), coalesce(p_reason, ''), auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function
  public.change_worker_salary(uuid, numeric, numeric, date, text) from public, anon;
grant execute on function
  public.change_worker_salary(uuid, numeric, numeric, date, text) to authenticated;

-- ── توصيات شؤون الموظفين — لا يراها إلا HR [شؤون الموظفين] ────────────
create table if not exists public.worker_recommendations (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.employees (id) on delete cascade,
  note text not null,
  kind text not null default 'note'
    check (kind in ('note', 'praise', 'warning')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.worker_recommendations is
  'ملاحظات وتوصيات عن العامل — مقصورة على شؤون الموظفين، لا يراها العامل ولا المشرف.';

create index if not exists worker_recommendations_worker_idx
  on public.worker_recommendations (worker_id, created_at desc);

drop trigger if exists worker_recommendations_set_created_by
  on public.worker_recommendations;
create trigger worker_recommendations_set_created_by
  before insert on public.worker_recommendations
  for each row execute function public.set_created_by();

-- ── تقييم معدّل الإنتاج حسب الدخل [شؤون الموظفين 10] ──────────────────
-- المعادلة قرار عمل: النسبة = الدخل المنسوب للعامل ÷ تكلفة يومياته،
-- والدرجة تُقرأ من شرائح قابلة للتعديل — لا رقم في الكود.
insert into public.settings (key, value, description, category) values
  ('production_score_bands',
   '[{"min_ratio": 3, "score": 100}, {"min_ratio": 2, "score": 80},
     {"min_ratio": 1.5, "score": 60}, {"min_ratio": 1, "score": 40},
     {"min_ratio": null, "score": 20}]'::jsonb,
   'درجة معدّل الإنتاج حسب نسبة الدخل إلى تكلفة اليوميات', 'hr')
on conflict (key) do update set description = excluded.description;

create table if not exists public.production_ratings (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.employees (id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  income numeric(16, 2) not null default 0 check (income >= 0),
  cost numeric(16, 2) not null default 0 check (cost >= 0),
  ratio numeric(10, 3),
  score numeric(6, 2),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (worker_id, period)
);

comment on table public.production_ratings is
  'تقييم إنتاج العامل في شهر: دخله مقابل تكلفة يومياته، والدرجة من الشرائح.';

drop trigger if exists production_ratings_set_created_by on public.production_ratings;
create trigger production_ratings_set_created_by
  before insert on public.production_ratings
  for each row execute function public.set_created_by();

create or replace function public.production_score(p_ratio numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_band jsonb;
  v_min numeric;
begin
  if p_ratio is null then
    return null;
  end if;

  for v_band in
    select jsonb_array_elements(value)
    from public.settings where key = 'production_score_bands'
  loop
    v_min := nullif(v_band ->> 'min_ratio', '')::numeric;
    if v_min is null or p_ratio >= v_min then
      return (v_band ->> 'score')::numeric;
    end if;
  end loop;

  return 0;
end;
$$;

/**
 * احتساب تقييم الإنتاج لشهر: التكلفة من اليوميات، والنسبة والدرجة آليًا.
 * الدخل يُدخله المستخدم لأنه يأتي من خارج النظام (قيمة ما أنتجه العامل).
 */
create or replace function public.rate_worker_production(
  p_worker_id uuid,
  p_period text,
  p_income numeric,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cost numeric(16, 2);
  v_ratio numeric(10, 3);
  v_id uuid;
begin
  if not public.has_permission('worker.rate') then
    raise exception 'يتطلّب صلاحية worker.rate'
      using errcode = 'insufficient_privilege';
  end if;

  select coalesce(
           sum(public.attendance_day_value(a.status)) * max(s.daily_wage), 0)
    into v_cost
    from public.attendance a
    join public.profile_salaries s on s.profile_id = a.worker_id
   where a.worker_id = p_worker_id
     and to_char(a.work_date, 'YYYY-MM') = p_period;

  v_ratio := case when v_cost > 0 then round(p_income / v_cost, 3) else null end;

  insert into public.production_ratings
    (worker_id, period, income, cost, ratio, score, note, created_by)
  values
    (p_worker_id, p_period, p_income, v_cost, v_ratio,
     public.production_score(v_ratio), coalesce(p_note, ''), auth.uid())
  on conflict (worker_id, period) do update
    set income = excluded.income,
        cost = excluded.cost,
        ratio = excluded.ratio,
        score = excluded.score,
        note = excluded.note
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.production_score(numeric) from public, anon;
revoke execute on function public.rate_worker_production(uuid, text, numeric, text)
  from public, anon;
grant execute on function public.production_score(numeric) to authenticated;
grant execute on function public.rate_worker_production(uuid, text, numeric, text)
  to authenticated;

-- ── بنود تقييم العمالة [شؤون الموظفين 11] ─────────────────────────────
-- محرّك التقييم من المرحلة 4 يُعاد استخدامه؛ نضيف فئة العامل وبنوده.
alter table public.evaluation_weights drop constraint if exists evaluation_weights_employee_type_check;
alter table public.evaluation_weights add constraint evaluation_weights_employee_type_check
  check (employee_type in ('admin', 'engineer', 'supervisor', 'worker'));

insert into public.evaluation_criteria (key, name, kind) values
  ('discipline', 'الانضباط', 'manual'),
  ('quality',    'جودة العمل', 'manual'),
  ('technique',  'الفنيات', 'manual')
on conflict (key) do update set name = excluded.name;

-- أوزان مبدئية للعامل — قابلة للتعديل من شاشة التقييم
insert into public.evaluation_weights (criteria_id, employee_type, weight)
select c.id, 'worker', v.weight
from (values
  ('discipline', 30), ('quality', 30), ('technique', 25), ('behavior', 15)
) as v(key, weight)
join public.evaluation_criteria c on c.key = v.key
on conflict (criteria_id, employee_type) do nothing;
