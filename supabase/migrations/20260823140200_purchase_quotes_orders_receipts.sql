-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3 — طلبات الشراء والتسعير والمقارنة وأوامر التوريد والاستلام
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  status text not null default 'draft'
    check (status in ('draft', 'quoting', 'compared', 'ordered', 'cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.purchase_requests is
  'يُولَّد آليًا من طلب احتياج واحد أو أكثر بعد طرح المتوفّر بالموقع.';

-- طلب شراء واحد قد ينبع من عدّة طلبات احتياج (دمج مشاريع متعددة)
create table if not exists public.purchase_request_sources (
  purchase_request_id uuid not null
    references public.purchase_requests (id) on delete cascade,
  material_request_id uuid not null
    references public.material_requests (id) on delete restrict,
  primary key (purchase_request_id, material_request_id)
);

create table if not exists public.purchase_request_lines (
  id uuid primary key default gen_random_uuid(),
  pr_id uuid not null references public.purchase_requests (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  -- التكلفة تبقى على المشروع صاحب الاحتياج حتى بعد الدمج [المشتريات 7]
  project_id uuid not null references public.projects (id) on delete restrict,
  qty numeric(16, 3) not null check (qty > 0),
  unique (pr_id, item_id, project_id)
);

create index if not exists purchase_request_lines_pr_idx
  on public.purchase_request_lines (pr_id);

drop trigger if exists purchase_requests_set_updated_at on public.purchase_requests;
create trigger purchase_requests_set_updated_at before update on public.purchase_requests
  for each row execute function public.set_updated_at();

drop trigger if exists purchase_requests_set_created_by on public.purchase_requests;
create trigger purchase_requests_set_created_by before insert on public.purchase_requests
  for each row execute function public.set_created_by();

-- ── التسعير: عرض سعر من مورّد لطلب شراء ────────────────────────────────
create table if not exists public.supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  pr_id uuid not null references public.purchase_requests (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  notes text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (pr_id, supplier_id)
);

comment on table public.supplier_quotes is
  'المشتريات لا تُدخل إلا كود المورّد وسعره [المشتريات 3] — باقي البيانات مستدعاة.';

create table if not exists public.supplier_quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.supplier_quotes (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  unit_price numeric(16, 2) not null check (unit_price >= 0),
  unique (quote_id, item_id)
);

drop trigger if exists supplier_quotes_set_created_by on public.supplier_quotes;
create trigger supplier_quotes_set_created_by before insert on public.supplier_quotes
  for each row execute function public.set_created_by();

-- ── محرّك المقارنة ─────────────────────────────────────────────────────
-- security_invoker: تسري سياسات RLS الخاصة بالجداول الأصلية على من يقرأ العرض.
create or replace view public.price_comparison
with (security_invoker = true) as
select
  q.pr_id,
  l.item_id,
  i.code            as item_code,
  i.name            as item_name,
  i.unit            as item_unit,
  q.supplier_id,
  s.code            as supplier_code,
  s.name            as supplier_name,
  l.unit_price,
  prl.qty           as required_qty,
  l.unit_price * prl.qty as line_total,
  -- ترتيب العروض لكل صنف: 1 = الأرخص
  rank() over (partition by q.pr_id, l.item_id order by l.unit_price) as price_rank
from public.supplier_quote_lines l
join public.supplier_quotes q on q.id = l.quote_id
join public.suppliers s on s.id = q.supplier_id
join public.items i on i.id = l.item_id
left join lateral (
  select sum(x.qty) as qty
  from public.purchase_request_lines x
  where x.pr_id = q.pr_id and x.item_id = l.item_id
) prl on true;

comment on view public.price_comparison is
  'مقارنة أسعار الموردين لكل صنف في طلب الشراء، مع ترتيب الأرخص.';

-- ── طلبات التوريد ──────────────────────────────────────────────────────
create table if not exists public.supply_orders (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  pr_id uuid not null references public.purchase_requests (id) on delete restrict,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  subtotal numeric(16, 2) not null default 0 check (subtotal >= 0),
  -- الضريبة في بند منفصل قبل السداد [المشتريات 12]
  vat_rate numeric(6, 3) not null default 0 check (vat_rate >= 0),
  vat_amount numeric(16, 2) not null default 0 check (vat_amount >= 0),
  total numeric(16, 2) not null default 0 check (total >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'received', 'cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table if not exists public.supply_order_lines (
  id uuid primary key default gen_random_uuid(),
  so_id uuid not null references public.supply_orders (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  project_id uuid not null references public.projects (id) on delete restrict,
  qty numeric(16, 3) not null check (qty > 0),
  unit_price numeric(16, 2) not null check (unit_price >= 0),
  unique (so_id, item_id, project_id)
);

create index if not exists supply_order_lines_so_idx on public.supply_order_lines (so_id);

drop trigger if exists supply_orders_set_updated_at on public.supply_orders;
create trigger supply_orders_set_updated_at before update on public.supply_orders
  for each row execute function public.set_updated_at();

drop trigger if exists supply_orders_set_created_by on public.supply_orders;
create trigger supply_orders_set_created_by before insert on public.supply_orders
  for each row execute function public.set_created_by();

-- ── طلبات استلام الأصناف ───────────────────────────────────────────────
create table if not exists public.receipt_requests (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  supply_order_id uuid not null references public.supply_orders (id) on delete restrict,
  project_id uuid not null references public.projects (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'received', 'cancelled')),
  received_at date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (supply_order_id, project_id)
);

create table if not exists public.receipt_request_lines (
  id uuid primary key default gen_random_uuid(),
  rr_id uuid not null references public.receipt_requests (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  qty numeric(16, 3) not null check (qty > 0),
  unit_price numeric(16, 2) not null default 0 check (unit_price >= 0),
  unique (rr_id, item_id)
);

drop trigger if exists receipt_requests_set_updated_at on public.receipt_requests;
create trigger receipt_requests_set_updated_at before update on public.receipt_requests
  for each row execute function public.set_updated_at();

drop trigger if exists receipt_requests_set_created_by on public.receipt_requests;
create trigger receipt_requests_set_created_by before insert on public.receipt_requests
  for each row execute function public.set_created_by();
