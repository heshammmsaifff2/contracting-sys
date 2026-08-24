-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6 — أساس الحسابات المتقدّمة: المقاولون، بنود التعاقد، الاستقطاعات
-- الاستقطاعات جدول قابل للتعديل لا أرقام في الكود: صاحب البرنامج يضبط
-- نسبها وحساباتها عند بدء الاستخدام، ويضيف ما ينقص.
-- ═══════════════════════════════════════════════════════════════════════

-- ── حسابات جديدة تحتاجها المستخلصات والدفعات ───────────────────────────
insert into public.accounts (code, name, type, is_postable, parent_id)
select v.code, v.name, v.type, true, p.id
from (values
  ('1303', 'دفعات مقدّمة للمقاولين', 'asset',     '13'),
  ('2103', 'محتجزات ضمان الأعمال',   'liability', '21'),
  ('2202', 'ضرائب مستحقّة — خصم من المنبع', 'liability', '22'),
  ('2203', 'تأمينات اجتماعية مستحقّة', 'liability', '22')
) as v(code, name, type, parent_code)
left join public.accounts p on p.code = v.parent_code
on conflict (code) do nothing;

-- ── المقاولون ──────────────────────────────────────────────────────────
create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  contact jsonb not null default '{}'::jsonb,
  bank jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  searchable tsvector generated always as (
    to_tsvector(
      'simple',
      public.normalize_ar(coalesce(code, '') || ' ' || coalesce(name, ''))
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.contractors is
  'المقاول يُكوَّد مرة واحدة، ثم يُستدعى في كل مستخلص ودفعة بلا إعادة إدخال.';

create index if not exists contractors_searchable_idx
  on public.contractors using gin (searchable);

drop trigger if exists contractors_set_updated_at on public.contractors;
create trigger contractors_set_updated_at before update on public.contractors
  for each row execute function public.set_updated_at();

drop trigger if exists contractors_set_created_by on public.contractors;
create trigger contractors_set_created_by before insert on public.contractors
  for each row execute function public.set_created_by();

create or replace function public.search_contractors(p_query text, p_limit int default 50)
returns setof public.contractors
language sql
stable
set search_path = public, pg_temp
as $$
  select c.*
  from public.contractors c
  where
    coalesce(btrim(p_query), '') = ''
    or c.searchable @@ plainto_tsquery('simple', public.normalize_ar(p_query))
    or public.normalize_ar(c.name) like '%' || public.normalize_ar(p_query) || '%'
    or public.normalize_ar(c.code) like '%' || public.normalize_ar(p_query) || '%'
  order by c.name
  limit least(coalesce(p_limit, 50), 200);
$$;

-- ── بنود التعاقد: السعر والكمية القصوى مرة واحدة لكل بند ───────────────
-- هذه هي «القاعدة الذهبية» في المستخلصات: المستخلص لا يسأل عن سعر ولا حد،
-- بل يستدعيهما من العقد ويحسب السابق والمتبقّي آليًا [الحسابات 18].
create table if not exists public.contractor_boq_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  contractor_id uuid not null references public.contractors (id) on delete restrict,
  boq_item_id uuid not null references public.boq_items (id) on delete restrict,
  unit_price numeric(16, 2) not null check (unit_price > 0),
  max_qty numeric(16, 3) not null check (max_qty > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (project_id, contractor_id, boq_item_id)
);

comment on table public.contractor_boq_contracts is
  'سعر البند وكميته القصوى في عقد المقاول — تُستدعى في كل مستخلص [الحسابات 18].';

create index if not exists contractor_boq_contracts_contractor_idx
  on public.contractor_boq_contracts (contractor_id, project_id);

drop trigger if exists contractor_boq_contracts_set_updated_at
  on public.contractor_boq_contracts;
create trigger contractor_boq_contracts_set_updated_at
  before update on public.contractor_boq_contracts
  for each row execute function public.set_updated_at();

drop trigger if exists contractor_boq_contracts_set_created_by
  on public.contractor_boq_contracts;
create trigger contractor_boq_contracts_set_created_by
  before insert on public.contractor_boq_contracts
  for each row execute function public.set_created_by();

-- ── أنواع الاستقطاعات — يضبطها صاحب البرنامج عند بدء الاستخدام ─────────
create table if not exists public.deduction_types (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  -- النسبة المئوية من إجمالي المستند؛ 0 يعني معطّل عمليًا
  rate numeric(6, 3) not null default 0 check (rate >= 0 and rate <= 100),
  applies_to text not null default 'extract'
    check (applies_to in ('extract', 'advance')),
  -- الحساب الذي يُرصَّد به الاستقطاع (دائن)
  account_code text not null references public.accounts (code) on update cascade,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.deduction_types is
  'استقطاعات المستخلص (ضمان، ضرائب، تأمينات…) — نسبها وحساباتها قابلة للتعديل بالكامل.';

drop trigger if exists deduction_types_set_updated_at on public.deduction_types;
create trigger deduction_types_set_updated_at before update on public.deduction_types
  for each row execute function public.set_updated_at();

-- قيم افتراضية للبدء فقط — تُعدَّل أو تُعطَّل من شاشة الاستقطاعات.
insert into public.deduction_types
  (key, name, rate, applies_to, account_code, is_active, sort_order, description)
values
  ('retention',        'ضمان أعمال',            5,  'extract', '2103', true,  10,
   'يُحتجز من كل مستخلص ويُردّ عند المستخلص الختامي'),
  ('withholding_tax',  'خصم من المنبع',         1,  'extract', '2202', true,  20,
   'ضريبة تُورَّد للمصلحة نيابة عن المقاول'),
  ('social_insurance', 'تأمينات اجتماعية',      0,  'extract', '2203', false, 30,
   'يُفعَّل ونسبته تُضبط حسب طبيعة التعاقد'),
  ('advance_recovery', 'استرداد دفعة مقدّمة',   0,  'extract', '1303', false, 40,
   'يُفعَّل حين تُصرف دفعة مقدّمة، وتُسترد على أقساط من المستخلصات')
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      account_code = excluded.account_code;
