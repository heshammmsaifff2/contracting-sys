-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6 — تحصين كشف تكرار الفواتير
-- ثغرتان ظهرتا في الاختبار:
-- (١) التطبيع كان يحذف الحروف العربية، فرقم «١٢٣/أ» يصير «123» بينما
--     «123/A» يصير «123A» — نُبقي الحروف العربية ونوحّدها بـ normalize_ar.
-- (٢) مُشغِّل BEFORE لا يرى صفوف نفس الأمر، فإدراج فاتورتين متطابقتين في
--     INSERT واحد يفلت من الكشف. لذا يُعاد المسح إجباريًا قبل الاعتماد.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.normalize_doc_no(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select upper(
    regexp_replace(
      translate(
        public.normalize_ar(coalesce(p_value, '')),
        '٠١٢٣٤٥٦٧٨٩',
        '0123456789'
      ),
      '[^0-9A-Za-zء-ي]', '', 'g'
    )
  );
$$;

comment on function public.normalize_doc_no(text) is
  'رقم مستند موحّد الشكل: أرقام عربية ← لاتينية، تطبيع الحروف العربية، وحذف الفواصل.';

-- الفهرس مبني على الدالة، فيُعاد بناؤه بعد تغيّرها
drop index if exists public.custody_invoices_match_idx;
create index custody_invoices_match_idx
  on public.custody_invoices (public.normalize_doc_no(invoice_no), amount);

/**
 * إعادة مسح فواتير عهدة بالكامل: تُعيد تشغيل مُشغِّل الكشف على كل فاتورة
 * فيرى بعضها بعضًا مهما كان شكل الإدراج. تُعيد عدد المكرّرات.
 */
create or replace function public.rescan_custody_duplicates(p_custody_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  -- قيمة الرقم لا تتغيّر، فلا يُعاد ضبط علامة المراجعة؛ والمُشغِّل يعمل
  update public.custody_invoices
     set invoice_no = invoice_no
   where custody_id = p_custody_id and not is_returned;

  select count(*) into v_count
    from public.custody_invoices
   where custody_id = p_custody_id and is_duplicate and not is_returned;

  return v_count;
end;
$$;

revoke execute on function public.rescan_custody_duplicates(uuid) from public, anon;
grant execute on function public.rescan_custody_duplicates(uuid) to authenticated;

/**
 * الاعتماد يعيد المسح أولًا، فلا تمرّ فاتورة مكرّرة بسبب شكل الإدراج.
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

  -- الفحص الحاسم: يقع هنا لا في الواجهة
  perform public.rescan_custody_duplicates(p_custody_id);

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

revoke execute on function public.approve_custody(uuid) from public, anon;
grant execute on function public.approve_custody(uuid) to authenticated;

/**
 * (٣) الأصل هو الأقدم لا غير: بدون هذا الشرط يتبادل صفّان متطابقان
 * الاتّهام في كل مسح، فتُعلَّم الفاتورة الأصلية مكرّرة أيضًا.
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
     -- الأقدم هو الأصل، وعند التساوي يُحسم بالمعرّف
     and (i.created_at < new.created_at
          or (i.created_at = new.created_at and i.id < new.id))
   order by i.created_at, i.id
   limit 1;

  new.is_duplicate := v_original is not null;
  new.duplicate_of := v_original;

  if tg_op = 'UPDATE' and (
       old.invoice_no is distinct from new.invoice_no
       or old.amount is distinct from new.amount
     ) then
    new.duplicate_reviewed := false;
  end if;

  return new;
end;
$$;
