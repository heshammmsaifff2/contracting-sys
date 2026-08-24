-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3 — التحويلات البنكية (مشترك بين المشتريات والحسابات، القسم 7.4)
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  -- المستند الذي نشأ عنه الطلب: supply_order الآن، ومستخلص/عهدة لاحقًا
  source_type text not null,
  source_id uuid not null,
  party_type text not null
    check (party_type in ('supplier', 'contractor', 'worker', 'employee')),
  party_id uuid not null,
  supplier_bank_account_id uuid
    references public.supplier_bank_accounts (id) on delete set null,
  project_id uuid references public.projects (id) on delete restrict,
  amount numeric(16, 2) not null check (amount > 0),
  bank_fee_company numeric(16, 2) not null default 0 check (bank_fee_company >= 0),
  bank_fee_client numeric(16, 2) not null default 0 check (bank_fee_client >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'transferred', 'cancelled')),
  transferred_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (source_type, source_id, party_id)
);

comment on table public.payment_requests is
  'ضغط «تم التحويل» يُطلق قيد الصرف وذمم المورّد آليًا [المشتريات 4].';
comment on column public.payment_requests.bank_fee_company is
  'مصاريف التحويل على الشركة — تُرحَّل كمصروف مستقل';
comment on column public.payment_requests.bank_fee_client is
  'مصاريف التحويل على المستفيد — يخصمها البنك منه فلا تدخل القيد';

create index if not exists payment_requests_source_idx
  on public.payment_requests (source_type, source_id);
create index if not exists payment_requests_party_idx
  on public.payment_requests (party_type, party_id);

drop trigger if exists payment_requests_set_updated_at on public.payment_requests;
create trigger payment_requests_set_updated_at before update on public.payment_requests
  for each row execute function public.set_updated_at();

drop trigger if exists payment_requests_set_created_by on public.payment_requests;
create trigger payment_requests_set_created_by before insert on public.payment_requests
  for each row execute function public.set_created_by();

-- ── دفعات التحويل: مجمّعة / مؤجّلة / شيكات / مفردة ──────────────────────
create table if not exists public.payment_batches (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  kind text not null check (kind in ('grouped', 'deferred', 'cheque', 'single')),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'transferred', 'cancelled')),
  total numeric(16, 2) not null default 0 check (total >= 0),
  due_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create table if not exists public.payment_batch_items (
  batch_id uuid not null references public.payment_batches (id) on delete cascade,
  payment_request_id uuid not null
    references public.payment_requests (id) on delete restrict,
  primary key (batch_id, payment_request_id)
);

drop trigger if exists payment_batches_set_updated_at on public.payment_batches;
create trigger payment_batches_set_updated_at before update on public.payment_batches
  for each row execute function public.set_updated_at();

drop trigger if exists payment_batches_set_created_by on public.payment_batches;
create trigger payment_batches_set_created_by before insert on public.payment_batches
  for each row execute function public.set_created_by();

-- ── الشيكات: تعبئة بياناتها = أوراق دفع آليًا ──────────────────────────
create table if not exists public.cheques (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null unique
    references public.payment_requests (id) on delete cascade,
  cheque_no text not null,
  bank_name text not null default '',
  due_date date,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

drop trigger if exists cheques_set_created_by on public.cheques;
create trigger cheques_set_created_by before insert on public.cheques
  for each row execute function public.set_created_by();

-- ── إجمالي الدفعة يُحسب آليًا من بنودها ────────────────────────────────
create or replace function public.refresh_payment_batch_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch_id uuid := coalesce(new.batch_id, old.batch_id);
begin
  update public.payment_batches b
     set total = coalesce((
           select sum(pr.amount)
           from public.payment_batch_items bi
           join public.payment_requests pr on pr.id = bi.payment_request_id
           where bi.batch_id = v_batch_id
         ), 0)
   where b.id = v_batch_id;
  return null;
end;
$$;

drop trigger if exists payment_batch_items_refresh_total on public.payment_batch_items;
create trigger payment_batch_items_refresh_total
  after insert or delete on public.payment_batch_items
  for each row execute function public.refresh_payment_batch_total();

revoke execute on function public.refresh_payment_batch_total()
  from public, anon, authenticated;
