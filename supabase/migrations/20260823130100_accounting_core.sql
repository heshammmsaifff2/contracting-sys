-- ═══════════════════════════════════════════════════════════════════════
-- Phase 2 — المحاسبة الأساسية: شجرة الحسابات ودفتر اليومية
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null check (type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id uuid references public.accounts (id) on delete restrict,
  is_postable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on column public.accounts.is_postable is
  'الحسابات التجميعية (الآباء) لا يُسجَّل عليها قيد مباشر';

create index if not exists accounts_parent_idx on public.accounts (parent_id);

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists accounts_set_created_by on public.accounts;
create trigger accounts_set_created_by before insert on public.accounts
  for each row execute function public.set_created_by();

-- ── دفتر اليومية — سجلّ غير قابل للتعديل ───────────────────────────────
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_no bigint generated always as identity,
  entry_date date not null default current_date,
  description text not null default '',
  source_type text not null,
  source_id uuid,
  is_manual boolean not null default false,
  posted_by uuid references auth.users (id) on delete set null,
  project_id uuid references public.projects (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.journal_entries is
  'القيود المحاسبية. تُسجَّل آليًا بلا تدخّل بشري؛ لا تعديل ولا حذف بعد الترحيل.';

-- منع الترحيل المزدوج لنفس المستند: حدث واحد ⇒ قيد واحد
create unique index if not exists journal_entries_source_unique
  on public.journal_entries (source_type, source_id)
  where source_id is not null and is_manual = false;

create index if not exists journal_entries_project_idx on public.journal_entries (project_id);
create index if not exists journal_entries_date_idx on public.journal_entries (entry_date);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  debit numeric(16, 2) not null default 0 check (debit >= 0),
  credit numeric(16, 2) not null default 0 check (credit >= 0),
  party_type text,
  party_id uuid,
  item_id uuid references public.items (id) on delete set null,
  boq_item_id uuid references public.boq_items (id) on delete set null,
  description text not null default '',
  -- طرف واحد فقط من كل سطر
  constraint journal_lines_one_side check ((debit = 0) <> (credit = 0))
);

create index if not exists journal_lines_entry_idx on public.journal_lines (entry_id);
create index if not exists journal_lines_account_idx on public.journal_lines (account_id);
create index if not exists journal_lines_party_idx on public.journal_lines (party_type, party_id);

-- ── ثابت المحاسبة: مجموع المدين = مجموع الدائن ─────────────────────────
-- مؤجّل حتى نهاية المعاملة ليمكن إدراج الأسطر تباعًا.
create or replace function public.assert_entry_balanced()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_entry_id uuid := coalesce(new.entry_id, old.entry_id);
  v_debit numeric;
  v_credit numeric;
begin
  -- حُذف القيد نفسه (cascade) فلا شيء نتحقّق منه
  if not exists (select 1 from public.journal_entries where id = v_entry_id) then
    return null;
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_debit, v_credit
    from public.journal_lines
   where entry_id = v_entry_id;

  if v_debit <> v_credit then
    raise exception 'القيد غير متوازن: مدين % ودائن %', v_debit, v_credit
      using errcode = 'check_violation';
  end if;

  if v_debit = 0 then
    raise exception 'القيد بلا مبالغ' using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists journal_lines_balanced on public.journal_lines;
create constraint trigger journal_lines_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.assert_entry_balanced();

-- ── قواعد الترحيل — جدول القسم 8 من المواصفات ──────────────────────────
create table if not exists public.posting_rules (
  id uuid primary key default gen_random_uuid(),
  source_type text not null unique,
  debit_account_code text references public.accounts (code) on update cascade,
  credit_account_code text references public.accounts (code) on update cascade,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.posting_rules is
  'ربط كل حدث بحسابَي المدين والدائن. NULL يعني أن الحساب يُحدَّد من المستند نفسه.';

drop trigger if exists posting_rules_set_updated_at on public.posting_rules;
create trigger posting_rules_set_updated_at before update on public.posting_rules
  for each row execute function public.set_updated_at();

-- ── الأرصدة الافتتاحية — أول حدث يُشغّل محرّك الترحيل الآلي ─────────────
create table if not exists public.opening_balances (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete restrict,
  project_id uuid references public.projects (id) on delete restrict,
  amount numeric(16, 2) not null check (amount <> 0),
  as_of date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.opening_balances is
  'الرصيد الافتتاحي لحساب. اعتماده يُطلق قيدًا آليًا عبر post_accounting_entry.';

drop trigger if exists opening_balances_set_updated_at on public.opening_balances;
create trigger opening_balances_set_updated_at before update on public.opening_balances
  for each row execute function public.set_updated_at();

drop trigger if exists opening_balances_set_created_by on public.opening_balances;
create trigger opening_balances_set_created_by before insert on public.opening_balances
  for each row execute function public.set_created_by();
