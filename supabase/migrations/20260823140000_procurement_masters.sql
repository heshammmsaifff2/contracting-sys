-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3 — أساس المشتريات: الموردون، حدود المكتب الفني، المتوفّر بالموقع
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  contact jsonb not null default '{}'::jsonb,
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

comment on table public.suppliers is
  'المورّد يُكوَّد مرة واحدة؛ المشتريات لا تُدخل بياناته يدويًا بعدها، فقط كوده وسعره.';

create index if not exists suppliers_searchable_idx
  on public.suppliers using gin (searchable);

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

drop trigger if exists suppliers_set_created_by on public.suppliers;
create trigger suppliers_set_created_by before insert on public.suppliers
  for each row execute function public.set_created_by();

create or replace function public.search_suppliers(p_query text, p_limit int default 50)
returns setof public.suppliers
language sql
stable
set search_path = public, pg_temp
as $$
  select s.*
  from public.suppliers s
  where
    coalesce(btrim(p_query), '') = ''
    or s.searchable @@ plainto_tsquery('simple', public.normalize_ar(p_query))
    or public.normalize_ar(s.name) like '%' || public.normalize_ar(p_query) || '%'
    or public.normalize_ar(s.code) like '%' || public.normalize_ar(p_query) || '%'
  order by s.name
  limit least(coalesce(p_limit, 50), 200);
$$;

-- ── حسابات المورّد البنكية ─────────────────────────────────────────────
create table if not exists public.supplier_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  bank_name text not null,
  account_no text,
  iban text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.supplier_bank_accounts is
  'تصدير الحوالة يستدعي رقم الحساب والبنك تلقائيًا من هنا.';

create index if not exists supplier_bank_accounts_supplier_idx
  on public.supplier_bank_accounts (supplier_id);

drop trigger if exists supplier_bank_accounts_set_created_by on public.supplier_bank_accounts;
create trigger supplier_bank_accounts_set_created_by
  before insert on public.supplier_bank_accounts
  for each row execute function public.set_created_by();

-- ── حدود المكتب الفني: الكمية القصوى لكل صنف في كل مشروع ───────────────
-- تجسيد البند [1]: المكتب الفني يُدخل الأصناف بكمياتها القصوى مرة واحدة،
-- ثم يُستدعى الحد في كل طلب احتياج ويُحسب المتبقّي آليًا.
create table if not exists public.project_item_limits (
  project_id uuid not null references public.projects (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  boq_item_id uuid references public.boq_items (id) on delete set null,
  max_qty numeric(16, 3) not null check (max_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (project_id, item_id)
);

drop trigger if exists project_item_limits_set_updated_at on public.project_item_limits;
create trigger project_item_limits_set_updated_at
  before update on public.project_item_limits
  for each row execute function public.set_updated_at();

drop trigger if exists project_item_limits_set_created_by on public.project_item_limits;
create trigger project_item_limits_set_created_by
  before insert on public.project_item_limits
  for each row execute function public.set_created_by();

-- ── المتوفّر بالموقع ───────────────────────────────────────────────────
-- طلب الشراء = الاحتياج − المتوفّر بالموقع، فلا يُشترى ما هو موجود.
create table if not exists public.site_stock (
  project_id uuid not null references public.projects (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  quantity numeric(16, 3) not null default 0,
  updated_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id) on delete set null,
  primary key (project_id, item_id)
);

drop trigger if exists site_stock_set_updated_at on public.site_stock;
create trigger site_stock_set_updated_at before update on public.site_stock
  for each row execute function public.set_updated_at();
