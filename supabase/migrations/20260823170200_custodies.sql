-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6 — العهد وفواتيرها وكشف التكرار [الحسابات 29، 30]
-- الكشف يقع في قاعدة البيانات لا في الواجهة: مُشغِّل يفحص كل فاتورة عند
-- إدخالها أو تعديلها، ويُبلّغ صاحب الصلاحية — لا مُدخِل الفاتورة.
-- قراءة الصورة (OCR) مجرّد مُعين على التعبئة؛ المطابقة تجري على الحقول.
-- ═══════════════════════════════════════════════════════════════════════

-- توحيد شكل رقم الفاتورة: أرقام عربية ← لاتينية، وحذف الفواصل والمسافات
create or replace function public.normalize_doc_no(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select upper(
    regexp_replace(
      translate(coalesce(p_value, ''), '٠١٢٣٤٥٦٧٨٩٬،', '0123456789'),
      '[^0-9A-Za-z]', '', 'g'
    )
  );
$$;

comment on function public.normalize_doc_no(text) is
  'رقم مستند موحّد الشكل — «١٢٣/أ» و«123 A» يصيران سواء في المطابقة.';

create table if not exists public.custodies (
  id uuid primary key default gen_random_uuid(),
  serial bigint generated always as identity,
  holder_id uuid not null references public.profiles (id) on delete restrict,
  project_id uuid not null references public.projects (id) on delete restrict,
  status text not null default 'open'
    check (status in ('open', 'submitted', 'approved', 'closed', 'cancelled')),
  -- العهدة الحمراء: وعاء الفواتير المرتجعة [الحسابات 30]
  is_returned_box boolean not null default false,
  opened_at date not null default current_date,
  closed_at date,
  total_amount numeric(16, 2) not null default 0,
  notes text not null default '',
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.custodies is
  'عهدة موظف على مشروع. لا سقف للمبلغ — الضبط بالاعتماد والمراجعة لا بحدّ رقمي.';

create index if not exists custodies_holder_idx on public.custodies (holder_id, status);
create index if not exists custodies_project_idx on public.custodies (project_id, status);

-- وعاء مرتجعات واحد لكل (مشروع + صاحب عهدة)
create unique index if not exists custodies_returned_box_idx
  on public.custodies (project_id, holder_id) where is_returned_box;

drop trigger if exists custodies_set_updated_at on public.custodies;
create trigger custodies_set_updated_at before update on public.custodies
  for each row execute function public.set_updated_at();

drop trigger if exists custodies_set_created_by on public.custodies;
create trigger custodies_set_created_by before insert on public.custodies
  for each row execute function public.set_created_by();

create table if not exists public.custody_invoices (
  id uuid primary key default gen_random_uuid(),
  custody_id uuid not null references public.custodies (id) on delete cascade,
  seq integer not null default 1,
  supplier_id uuid references public.suppliers (id) on delete set null,
  -- رقم الفاتورة في دفتر المورّد كما هو مطبوع عليها
  supplier_seq_no text not null default '',
  invoice_no text not null,
  invoice_date date not null default current_date,
  amount numeric(16, 2) not null check (amount > 0),
  item_id uuid references public.items (id) on delete set null,
  -- Cloudinary: صورة الفاتورة (أصل خاص برابط موقّع)
  image_public_id text,
  image_url text,
  -- ناتج المسح الضوئي في المتصفّح — يملأ الحقول ويُحفظ للمراجعة
  ocr_text text not null default '',
  is_duplicate boolean not null default false,
  duplicate_of uuid references public.custody_invoices (id) on delete set null,
  duplicate_reviewed boolean not null default false,
  is_returned boolean not null default false,
  return_reason text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.custody_invoices is
  'فواتير العهدة. التكرار يُكشف آليًا بمطابقة (الرقم + القيمة) [الحسابات 29].';

create index if not exists custody_invoices_custody_idx
  on public.custody_invoices (custody_id, seq);

-- فهرس المطابقة: عليه يقوم كشف التكرار
create index if not exists custody_invoices_match_idx
  on public.custody_invoices (public.normalize_doc_no(invoice_no), amount);

create index if not exists custody_invoices_duplicate_idx
  on public.custody_invoices (is_duplicate) where is_duplicate;

drop trigger if exists custody_invoices_set_updated_at on public.custody_invoices;
create trigger custody_invoices_set_updated_at before update on public.custody_invoices
  for each row execute function public.set_updated_at();

drop trigger if exists custody_invoices_set_created_by on public.custody_invoices;
create trigger custody_invoices_set_created_by
  before insert on public.custody_invoices
  for each row execute function public.set_created_by();

/**
 * كشف التكرار قبل الحفظ: فاتورة بنفس الرقم والقيمة (ونفس المورّد إن حُدِّد)
 * تُعلَّم مكرّرة وتُربط بالأصل. الفاتورة المرتجعة لا تُحسب أصلًا للمطابقة.
 */
create or replace function public.detect_invoice_duplicate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original uuid;
begin
  if new.is_returned then
    new.is_duplicate := false;
    new.duplicate_of := null;
    return new;
  end if;

  select i.id into v_original
    from public.custody_invoices i
   where i.id <> new.id
     and not i.is_returned
     and public.normalize_doc_no(i.invoice_no) = public.normalize_doc_no(new.invoice_no)
     and i.amount = new.amount
     and (
       new.supplier_id is null or i.supplier_id is null
       or i.supplier_id = new.supplier_id
     )
   order by i.created_at
   limit 1;

  new.is_duplicate := v_original is not null;
  new.duplicate_of := v_original;

  -- تغيّر الرقم أو القيمة يُعيد فتح المراجعة
  if tg_op = 'UPDATE' and (
       old.invoice_no is distinct from new.invoice_no
       or old.amount is distinct from new.amount
     ) then
    new.duplicate_reviewed := false;
  end if;

  return new;
end;
$$;

drop trigger if exists custody_invoices_detect_duplicate on public.custody_invoices;
create trigger custody_invoices_detect_duplicate
  before insert or update of invoice_no, amount, supplier_id, is_returned
  on public.custody_invoices
  for each row execute function public.detect_invoice_duplicate();

/**
 * الإبلاغ: يذهب لأصحاب صلاحية المراجعة لا لمن أدخل الفاتورة [الحسابات 29].
 */
create or replace function public.notify_invoice_duplicate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_custody public.custodies%rowtype;
  v_holder text;
begin
  if not new.is_duplicate then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_duplicate then
    return new;
  end if;

  select * into v_custody from public.custodies where id = new.custody_id;
  select full_name into v_holder from public.profiles where id = v_custody.holder_id;

  perform public.notify_users(
    array(select public.users_to_notify('invoice.review', v_custody.project_id)),
    'invoice_duplicate',
    'فاتورة مكرّرة في عهدة',
    format('فاتورة رقم %s بقيمة %s — عهدة %s (مسلسل %s)',
           new.invoice_no, new.amount, coalesce(v_holder, ''), v_custody.serial),
    'custody_invoice', new.id, v_custody.project_id
  );

  return new;
end;
$$;

drop trigger if exists custody_invoices_notify_duplicate on public.custody_invoices;
create trigger custody_invoices_notify_duplicate
  after insert or update of is_duplicate on public.custody_invoices
  for each row execute function public.notify_invoice_duplicate();

/**
 * ترحيل فاتورة مرتجعة إلى العهدة الحمراء المخصّصة [الحسابات 30].
 * الوعاء يُنشأ عند أول حاجة إليه — لا يطلب من المستخدم إنشاءه.
 */
create or replace function public.return_custody_invoice(
  p_invoice_id uuid,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.custody_invoices%rowtype;
  v_custody public.custodies%rowtype;
  v_box_id uuid;
begin
  if not public.has_permission('custody.manage') then
    raise exception 'يتطلّب صلاحية custody.manage'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_invoice from public.custody_invoices where id = p_invoice_id;
  if not found then
    raise exception 'الفاتورة غير موجودة' using errcode = 'no_data_found';
  end if;

  select * into v_custody from public.custodies where id = v_invoice.custody_id;

  if v_custody.status in ('approved', 'closed') then
    raise exception 'لا تُرتجع فاتورة من عهدة معتمَدة' using errcode = 'check_violation';
  end if;

  select id into v_box_id
    from public.custodies
   where project_id = v_custody.project_id
     and holder_id = v_custody.holder_id
     and is_returned_box;

  if v_box_id is null then
    insert into public.custodies
      (holder_id, project_id, status, is_returned_box, notes, created_by)
    values
      (v_custody.holder_id, v_custody.project_id, 'open', true,
       'وعاء الفواتير المرتجعة', auth.uid())
    returning id into v_box_id;
  end if;

  update public.custody_invoices
     set custody_id = v_box_id,
         is_returned = true,
         return_reason = coalesce(p_reason, ''),
         seq = coalesce(
           (select max(seq) + 1 from public.custody_invoices where custody_id = v_box_id),
           1)
   where id = p_invoice_id;

  return v_box_id;
end;
$$;

/**
 * اعتماد العهدة: يجمع فواتيرها غير المرتجعة، ويرفض الاعتماد ما دامت
 * هناك فاتورة مكرّرة لم تُراجَع — فلا يمرّ التكرار بالسكوت عنه.
 */
create or replace function public.approve_custody(p_custody_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_custody public.custodies%rowtype;
  v_total numeric(16, 2);
  v_unreviewed integer;
begin
  if not public.has_permission('custody.approve') then
    raise exception 'يتطلّب صلاحية custody.approve'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_custody from public.custodies where id = p_custody_id;
  if not found then
    raise exception 'العهدة غير موجودة' using errcode = 'no_data_found';
  end if;
  if v_custody.is_returned_box then
    raise exception 'وعاء المرتجعات لا يُعتمد' using errcode = 'check_violation';
  end if;
  if v_custody.status not in ('open', 'submitted') then
    raise exception 'العهدة معتمَدة بالفعل' using errcode = 'check_violation';
  end if;

  if not public.can_sign_project(v_custody.project_id) then
    raise exception 'لا يحقّ لك التوقيع على مستندات هذا المشروع'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_unreviewed
    from public.custody_invoices
   where custody_id = p_custody_id
     and is_duplicate and not duplicate_reviewed and not is_returned;

  if v_unreviewed > 0 then
    raise exception 'توجد % فاتورة مكرّرة لم تُراجَع', v_unreviewed
      using errcode = 'check_violation';
  end if;

  select coalesce(sum(amount), 0) into v_total
    from public.custody_invoices
   where custody_id = p_custody_id and not is_returned;

  if v_total <= 0 then
    raise exception 'لا فواتير في العهدة' using errcode = 'check_violation';
  end if;

  update public.custodies
     set status = 'approved',
         total_amount = v_total,
         approved_at = now(),
         approved_by = auth.uid()
   where id = p_custody_id;

  return p_custody_id;
end;
$$;

revoke execute on function public.return_custody_invoice(uuid, text) from public, anon;
revoke execute on function public.approve_custody(uuid) from public, anon;
grant execute on function public.return_custody_invoice(uuid, text) to authenticated;
grant execute on function public.approve_custody(uuid) to authenticated;
