-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3 — طلبات الاحتياج وسندات النقل
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.material_requests (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  project_id uuid not null references public.projects (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'rejected', 'converted', 'cancelled')),
  notes text not null default '',
  merged_group_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on column public.material_requests.merged_group_id is
  'دمج طلبات مشاريع متعددة [المشتريات 7] — التكلفة تبقى موزّعة على كل مشروع';

create index if not exists material_requests_project_idx
  on public.material_requests (project_id);
create index if not exists material_requests_merged_idx
  on public.material_requests (merged_group_id);

drop trigger if exists material_requests_set_updated_at on public.material_requests;
create trigger material_requests_set_updated_at before update on public.material_requests
  for each row execute function public.set_updated_at();

drop trigger if exists material_requests_set_created_by on public.material_requests;
create trigger material_requests_set_created_by before insert on public.material_requests
  for each row execute function public.set_created_by();

create table if not exists public.material_request_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.material_requests (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  boq_item_id uuid references public.boq_items (id) on delete set null,
  requested_qty numeric(16, 3) not null check (requested_qty > 0),
  -- الثلاثة التالية تُحسب آليًا ولا تُدخل يدويًا إطلاقًا
  max_qty numeric(16, 3),
  prev_requested_qty numeric(16, 3) not null default 0,
  remaining_balance numeric(16, 3),
  unique (request_id, item_id)
);

comment on column public.material_request_lines.max_qty is
  'مستدعى من project_item_limits — لا يُدخل يدويًا';
comment on column public.material_request_lines.remaining_balance is
  'max_qty − (prev_requested_qty + requested_qty) — يُحسب آليًا [المشتريات 2]';

create index if not exists material_request_lines_request_idx
  on public.material_request_lines (request_id);
create index if not exists material_request_lines_item_idx
  on public.material_request_lines (item_id);

-- ── الحساب الآلي للحد الأقصى والسابق والمتبقّي ─────────────────────────
-- تجسيد البند [2]: يحسب prev + current ثم max − total = remaining تلقائيًا.
-- SECURITY DEFINER لأنه يقرأ حدود المكتب الفني وطلبات سابقة قد لا يراها المُدخِل.
create or replace function public.fill_material_request_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid;
  v_max numeric(16, 3);
  v_prev numeric(16, 3);
begin
  select project_id into v_project_id
    from public.material_requests where id = new.request_id;

  select max_qty into v_max
    from public.project_item_limits
   where project_id = v_project_id and item_id = new.item_id;

  -- المطلوب سابقًا لنفس الصنف في نفس المشروع، عدا هذا السطر والطلبات الملغاة
  select coalesce(sum(l.requested_qty), 0) into v_prev
    from public.material_request_lines l
    join public.material_requests r on r.id = l.request_id
   where r.project_id = v_project_id
     and l.item_id = new.item_id
     and l.id is distinct from new.id
     and r.status not in ('cancelled', 'rejected');

  new.max_qty := v_max;
  new.prev_requested_qty := v_prev;
  new.remaining_balance :=
    case when v_max is null then null
         else v_max - (v_prev + new.requested_qty)
    end;

  return new;
end;
$$;

drop trigger if exists material_request_lines_fill on public.material_request_lines;
create trigger material_request_lines_fill
  before insert or update of requested_qty, item_id on public.material_request_lines
  for each row execute function public.fill_material_request_line();

revoke execute on function public.fill_material_request_line()
  from public, anon, authenticated;

-- ── سندات نقل الأصناف بين المواقع ──────────────────────────────────────
create table if not exists public.transfer_notes (
  id uuid primary key default gen_random_uuid(),
  no bigint generated always as identity,
  from_project_id uuid not null references public.projects (id) on delete restrict,
  to_project_id uuid not null references public.projects (id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint transfer_notes_distinct_projects
    check (from_project_id <> to_project_id)
);

create table if not exists public.transfer_note_lines (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.transfer_notes (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  qty numeric(16, 3) not null check (qty > 0),
  unit_cost numeric(16, 2) not null default 0 check (unit_cost >= 0),
  unique (note_id, item_id)
);

comment on column public.transfer_note_lines.unit_cost is
  'ثمن المادة يُنقل مع الصنف آليًا [المشتريات 9]';

drop trigger if exists transfer_notes_set_updated_at on public.transfer_notes;
create trigger transfer_notes_set_updated_at before update on public.transfer_notes
  for each row execute function public.set_updated_at();

drop trigger if exists transfer_notes_set_created_by on public.transfer_notes;
create trigger transfer_notes_set_created_by before insert on public.transfer_notes
  for each row execute function public.set_created_by();
