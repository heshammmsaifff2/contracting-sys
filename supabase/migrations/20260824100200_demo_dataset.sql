-- Phase 8 — النسخة الاختبارية من البيانات [الحسابات 1]
--
-- المطلب: نسخة يتدرّب عليها المحاسب والموظف الجديد بلا خوف من إفساد بيانات
-- حقيقية. التنفيذ هنا يقوم على ثلاث قواعد:
--
-- 1) **سجل صريح لكل صف مُولَّد** (`demo_data_objects`). الحذف لاحقًا يمرّ على
--    هذا السجل وحده، فيستحيل أن يمسّ صفًّا حقيقيًا حتى لو تشابهت الأكواد.
-- 2) **الأكواد كلها مسبوقة بـ `DEMO-`** فيميّزها المستخدم في أي شاشة بلا شرح.
-- 3) **القيود تُرحَّل بالمحرّك نفسه** (`post_accounting_entry`) لا بإدراج يدوي
--    في دفتر اليومية — وإلا لكانت النسخة الاختبارية تتصرّف بغير منطق النظام،
--    وهذا يُبطل الغرض منها أصلًا.
--
-- التنفيذ بصلاحية `demo_data.manage` وحدها، ومن داخل النظام بمستخدم مسجَّل:
-- الدالة تحتاج ملفًّا شخصيًا حقيقيًا ليكون صاحب العهدة والمعتمِد.

-- ── سجل ما وُلِّد ──────────────────────────────────────────────────────
create table if not exists public.demo_data_objects (
  id bigint generated always as identity primary key,
  entity text not null,
  row_id uuid not null,
  created_at timestamptz not null default now(),
  unique (entity, row_id)
);

comment on table public.demo_data_objects is
  'سجل صفوف النسخة الاختبارية — مرجع الحذف الآمن. لا يُحرَّر يدويًا.';

alter table public.demo_data_objects enable row level security;

drop policy if exists demo_data_objects_select on public.demo_data_objects;
create policy demo_data_objects_select on public.demo_data_objects
  for select to authenticated using (public.has_permission('demo_data.manage'));

revoke all on public.demo_data_objects from anon;

-- ── مساعد التسجيل ─────────────────────────────────────────────────────
create or replace function public.demo_track(p_entity text, p_id uuid)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.demo_data_objects (entity, row_id)
  values (p_entity, p_id)
  on conflict (entity, row_id) do nothing
  returning row_id;
$$;

revoke all on function public.demo_track(text, uuid) from public, anon, authenticated;

-- ── حالة النسخة الاختبارية ────────────────────────────────────────────
create or replace function public.demo_data_status()
returns table (entity text, rows_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select d.entity, count(*)
  from public.demo_data_objects d
  where public.has_permission('demo_data.manage')
  group by d.entity
  order by d.entity;
$$;

comment on function public.demo_data_status is
  'ماذا تحتوي النسخة الاختبارية الآن — تقرؤه الشاشة قبل عرض زرّ الحذف.';

-- ── توليد النسخة الاختبارية ───────────────────────────────────────────
create or replace function public.seed_demo_data(p_actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor        uuid := coalesce(p_actor, (select auth.uid()));
  v_p1           uuid;
  v_p2           uuid;
  v_sup1         uuid;
  v_sup2         uuid;
  v_con1         uuid;
  v_boq1         uuid;
  v_boq2         uuid;
  v_item         uuid;
  v_items        uuid[] := '{}';
  v_mr           uuid;
  v_pr           uuid;
  v_quote        uuid;
  v_so           uuid;
  v_custody      uuid;
  v_extract      uuid;
  v_advance      uuid;
  v_pay          uuid;
  v_facility     uuid;
  v_dept         uuid;
  v_created      integer := 0;
  v_spec         record;
begin
  if not public.has_permission('demo_data.manage') then
    raise exception 'لا تملك صلاحية إدارة النسخة الاختبارية'
      using errcode = 'insufficient_privilege';
  end if;

  if v_actor is null then
    raise exception 'النسخة الاختبارية تحتاج مستخدمًا مسجّلًا ليكون صاحب العهدة والمعتمِد'
      using errcode = 'null_value_not_allowed';
  end if;

  if not exists (select 1 from public.profiles where id = v_actor) then
    raise exception 'لا يوجد ملف شخصي للمستخدم %', v_actor
      using errcode = 'no_data_found';
  end if;

  -- إعادة التوليد فوق نسخة قائمة تُنتج ازدواجًا لا فائدة منه
  if exists (select 1 from public.demo_data_objects) then
    raise exception 'توجد نسخة اختبارية بالفعل — احذفها أولًا بـ clear_demo_data()'
      using errcode = 'unique_violation';
  end if;

  -- ── الأقسام ─────────────────────────────────────────────────────────
  insert into public.departments (name) values ('DEMO-الإدارة الهندسية')
  returning id into v_dept;
  perform public.demo_track('departments', v_dept);

  -- ── المشاريع ────────────────────────────────────────────────────────
  insert into public.projects (code, name, owner_entity, contract_value, received_at,
                               manager_id, status)
  values ('DEMO-P1', 'مشروع تجريبي — إسكان الواحة', 'جهة مالكة تجريبية',
          12000000, current_date - 180, v_actor, 'active')
  returning id into v_p1;
  perform public.demo_track('projects', v_p1);

  insert into public.projects (code, name, owner_entity, contract_value, received_at,
                               manager_id, status)
  values ('DEMO-P2', 'مشروع تجريبي — طريق الخدمة', 'جهة مالكة تجريبية',
          4500000, current_date - 90, v_actor, 'active')
  returning id into v_p2;
  perform public.demo_track('projects', v_p2);

  -- المنفّذ معتمَد على المشروعين وله حق التوقيع، وإلا حجبت RLS عنه ما ولّده
  insert into public.project_assignments (project_id, user_id, can_sign)
  values (v_p1, v_actor, true), (v_p2, v_actor, true)
  on conflict do nothing;

  -- ── الأصناف ─────────────────────────────────────────────────────────
  for v_spec in
    select * from (values
      ('DEMO-IT-001', 'أسمنت بورتلاندي', 'طن',   'مواد بناء'),
      ('DEMO-IT-002', 'حديد تسليح 12مم', 'طن',   'مواد بناء'),
      ('DEMO-IT-003', 'رمل',             'م3',   'مواد بناء'),
      ('DEMO-IT-004', 'زلط',             'م3',   'مواد بناء'),
      ('DEMO-IT-005', 'طوب أحمر',        'ألف',  'مواد بناء'),
      ('DEMO-IT-006', 'خشب فرم',         'م3',   'مستهلكات')
    ) as s(code, name, unit, category)
  loop
    insert into public.items (code, name, unit, category)
    values (v_spec.code, v_spec.name, v_spec.unit, v_spec.category)
    returning id into v_item;
    perform public.demo_track('items', v_item);
    v_items := v_items || v_item;
  end loop;

  -- ── البنود ──────────────────────────────────────────────────────────
  insert into public.boq_items (code, name, unit)
  values ('DEMO-BQ-01', 'أعمال الخرسانة المسلّحة', 'م3')
  returning id into v_boq1;
  perform public.demo_track('boq_items', v_boq1);

  insert into public.boq_items (code, name, unit)
  values ('DEMO-BQ-02', 'أعمال المباني', 'م2')
  returning id into v_boq2;
  perform public.demo_track('boq_items', v_boq2);

  insert into public.item_boq_map (boq_item_id, item_id)
  values (v_boq1, v_items[1]), (v_boq1, v_items[2]), (v_boq2, v_items[5])
  on conflict do nothing;

  -- ── الموردون ────────────────────────────────────────────────────────
  insert into public.suppliers (code, name, contact)
  values ('DEMO-SUP-01', 'شركة التوريدات التجريبية',
          '{"phone": "0100000000", "email": "demo1@example.test"}'::jsonb)
  returning id into v_sup1;
  perform public.demo_track('suppliers', v_sup1);

  insert into public.suppliers (code, name, contact)
  values ('DEMO-SUP-02', 'مؤسسة المواد التجريبية',
          '{"phone": "0100000001", "email": "demo2@example.test"}'::jsonb)
  returning id into v_sup2;
  perform public.demo_track('suppliers', v_sup2);

  insert into public.supplier_bank_accounts (supplier_id, bank_name, account_no, iban)
  values (v_sup1, 'بنك تجريبي', 'DEMO-ACC-1', 'EG000000000000000000000001');

  -- ── المقاولون ───────────────────────────────────────────────────────
  insert into public.contractors (code, name, bank)
  values ('DEMO-CON-01', 'مقاول التنفيذ التجريبي',
          '{"bank_name": "بنك تجريبي", "account_no": "DEMO-CON-ACC"}'::jsonb)
  returning id into v_con1;
  perform public.demo_track('contractors', v_con1);

  insert into public.contractor_boq_contracts
    (project_id, contractor_id, boq_item_id, unit_price, max_qty)
  values (v_p1, v_con1, v_boq1, 1800, 500);

  -- ── دورة المشتريات: احتياج ← شراء ← تسعير ← توريد ──────────────────
  insert into public.material_requests (project_id, status, created_by)
  values (v_p1, 'approved', v_actor)
  returning id into v_mr;
  perform public.demo_track('material_requests', v_mr);

  insert into public.material_request_lines (request_id, item_id, boq_item_id, requested_qty)
  values (v_mr, v_items[1], v_boq1, 120), (v_mr, v_items[2], v_boq1, 45);

  insert into public.purchase_requests (status, notes)
  values ('ordered', 'مولَّد ضمن النسخة الاختبارية')
  returning id into v_pr;
  perform public.demo_track('purchase_requests', v_pr);

  insert into public.purchase_request_lines (pr_id, item_id, project_id, qty)
  values (v_pr, v_items[1], v_p1, 120),
         (v_pr, v_items[2], v_p1, 45),
         (v_pr, v_items[3], v_p2, 200);

  -- عرضا سعر متفاوتان: المقارنة تصبح ذات معنى في الشاشة التجريبية
  insert into public.supplier_quotes (pr_id, supplier_id) values (v_pr, v_sup1)
  returning id into v_quote;
  insert into public.supplier_quote_lines (quote_id, item_id, unit_price)
  values (v_quote, v_items[1], 2100), (v_quote, v_items[2], 42000),
         (v_quote, v_items[3], 260);

  insert into public.supplier_quotes (pr_id, supplier_id) values (v_pr, v_sup2)
  returning id into v_quote;
  insert into public.supplier_quote_lines (quote_id, item_id, unit_price)
  values (v_quote, v_items[1], 2050), (v_quote, v_items[2], 43500),
         (v_quote, v_items[3], 245);

  insert into public.supply_orders (pr_id, supplier_id, status, notes)
  values (v_pr, v_sup2, 'approved', 'مولَّد ضمن النسخة الاختبارية')
  returning id into v_so;
  perform public.demo_track('supply_orders', v_so);

  insert into public.supply_order_lines (so_id, item_id, project_id, qty, unit_price)
  values (v_so, v_items[1], v_p1, 120, 2050),
         (v_so, v_items[2], v_p1, 45, 43500),
         (v_so, v_items[3], v_p2, 200, 245);

  -- ── تحويل للمورّد ⇒ قيد صرف آلي ────────────────────────────────────
  insert into public.payment_requests
    (source_type, source_id, party_type, party_id, project_id, amount, status,
     transferred_at, notes)
  values ('supply_order', v_so, 'supplier', v_sup2, v_p1, 250000, 'transferred',
          now() - interval '10 days', 'تحويل تجريبي')
  returning id into v_pay;
  perform public.demo_track('payment_requests', v_pay);
  perform public.post_accounting_entry('payment_transfer', v_pay);

  -- ── عهدة بفواتيرها ⇒ قيد استحقاق آلي ───────────────────────────────
  insert into public.custodies (holder_id, project_id, status, opened_at, notes,
                                approved_at, approved_by)
  values (v_actor, v_p1, 'approved', current_date - 30,
          'عهدة تجريبية', now() - interval '5 days', v_actor)
  returning id into v_custody;
  perform public.demo_track('custodies', v_custody);

  insert into public.custody_invoices
    (custody_id, seq, supplier_id, supplier_seq_no, invoice_no, invoice_date, amount, item_id)
  values
    (v_custody, 1, v_sup1, 'S-1', 'DEMO-INV-1001', current_date - 25, 8400,  v_items[3]),
    (v_custody, 2, v_sup1, 'S-2', 'DEMO-INV-1002', current_date - 20, 12750, v_items[4]),
    -- فاتورة مكرّرة عمدًا: شاشة كشف التكرار تحتاج حالة تُظهر عملها [الحسابات 29]
    (v_custody, 3, v_sup1, 'S-2', 'DEMO-INV-1002', current_date - 20, 12750, v_items[4]);

  perform public.post_accounting_entry('custody_approval', v_custody);

  -- ── مستخلص معتمَد ⇒ قيد استحقاق آلي ────────────────────────────────
  insert into public.extracts (seq, project_id, contractor_id, extract_date, status,
                               approved_at, approved_by, notes)
  values (1, v_p1, v_con1, current_date - 15, 'approved',
          now() - interval '15 days', v_actor, 'مستخلص تجريبي')
  returning id into v_extract;
  perform public.demo_track('extracts', v_extract);

  insert into public.extract_lines
    (extract_id, boq_item_id, unit_price, max_qty, prev_qty, current_qty)
  values (v_extract, v_boq1, 1800, 500, 0, 140);

  perform public.post_accounting_entry('extract_approval', v_extract);

  -- ── دفعة مقدّمة معتمَدة ⇒ قيد آلي ──────────────────────────────────
  insert into public.advance_payments (contractor_id, project_id, boq_item_id, amount,
                                       status, approved_at, approved_by, notes)
  values (v_con1, v_p1, v_boq1, 300000, 'approved',
          now() - interval '40 days', v_actor, 'دفعة مقدّمة تجريبية')
  returning id into v_advance;
  perform public.demo_track('advance_payments', v_advance);
  perform public.post_accounting_entry('advance_payment', v_advance);

  -- ── ضمان قارب على الانتهاء: تقرير الضمانات يحتاج حالة حيّة ─────────
  insert into public.guarantees (project_id, type, amount, expires_at, notes)
  values (v_p1, 'performance', 600000, current_date + 21, 'خطاب ضمان تجريبي');

  -- ── منشأة واستهلاك: تقارير المخازن تحتاج وزنًا لتقارن به ───────────
  insert into public.facilities (project_id, code, group_name, district, name, weight)
  values (v_p1, 'DEMO-FC-01', 'تجمّع تجريبي', 'حي تجريبي', 'منشأة تجريبية 1', 100)
  returning id into v_facility;
  perform public.demo_track('facilities', v_facility);

  insert into public.facility_consumption (facility_id, project_id, item_id, qty, supervisor_id)
  values (v_facility, v_p1, v_items[1], 18, v_actor),
         (v_facility, v_p1, v_items[5], 6,  v_actor);

  select count(*) into v_created from public.demo_data_objects;

  return jsonb_build_object(
    'seeded', true,
    'tracked_rows', v_created,
    'projects', jsonb_build_array(v_p1, v_p2)
  );
end;
$$;

comment on function public.seed_demo_data is
  'يولّد نسخة اختبارية كاملة بأكواد DEMO- ويرحّل قيودها بمحرّك الترحيل نفسه [الحسابات 1].';

-- ── حذف النسخة الاختبارية ─────────────────────────────────────────────
-- الحذف بالسجل لا بالكود: لو أنشأ مستخدم صفًّا حقيقيًا كوده يبدأ بـ DEMO-
-- فلن يمسّه هذا الحذف، لأنه ليس في `demo_data_objects`.
create or replace function public.clear_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_removed integer;
begin
  if not public.has_permission('demo_data.manage') then
    raise exception 'لا تملك صلاحية إدارة النسخة الاختبارية'
      using errcode = 'insufficient_privilege';
  end if;

  -- القيود أولًا: هي وحدها ما يُحذف بمرجع المستند لا بمعرّفه
  delete from public.journal_entries je
  using public.demo_data_objects d
  where je.source_id = d.row_id;

  -- ثم المستندات بترتيب عكس التبعية؛ الأسطر تذهب بـ on delete cascade
  delete from public.facility_consumption fc
   using public.demo_data_objects d
   where d.entity = 'facilities' and fc.facility_id = d.row_id;
  delete from public.facilities f
   using public.demo_data_objects d where d.entity = 'facilities' and f.id = d.row_id;

  delete from public.advance_payments a
   using public.demo_data_objects d where d.entity = 'advance_payments' and a.id = d.row_id;
  delete from public.extracts e
   using public.demo_data_objects d where d.entity = 'extracts' and e.id = d.row_id;
  delete from public.custodies c
   using public.demo_data_objects d where d.entity = 'custodies' and c.id = d.row_id;
  delete from public.payment_requests p
   using public.demo_data_objects d where d.entity = 'payment_requests' and p.id = d.row_id;
  delete from public.supply_orders s
   using public.demo_data_objects d where d.entity = 'supply_orders' and s.id = d.row_id;
  delete from public.purchase_requests pr
   using public.demo_data_objects d where d.entity = 'purchase_requests' and pr.id = d.row_id;
  delete from public.material_requests m
   using public.demo_data_objects d where d.entity = 'material_requests' and m.id = d.row_id;

  delete from public.contractors c
   using public.demo_data_objects d where d.entity = 'contractors' and c.id = d.row_id;
  delete from public.suppliers s
   using public.demo_data_objects d where d.entity = 'suppliers' and s.id = d.row_id;
  delete from public.boq_items b
   using public.demo_data_objects d where d.entity = 'boq_items' and b.id = d.row_id;
  delete from public.items i
   using public.demo_data_objects d where d.entity = 'items' and i.id = d.row_id;

  -- الضمانات والتخصيصات تتبع مشاريعها
  delete from public.guarantees g
   using public.demo_data_objects d where d.entity = 'projects' and g.project_id = d.row_id;
  delete from public.project_assignments pa
   using public.demo_data_objects d where d.entity = 'projects' and pa.project_id = d.row_id;
  delete from public.projects p
   using public.demo_data_objects d where d.entity = 'projects' and p.id = d.row_id;

  delete from public.departments dep
   using public.demo_data_objects d where d.entity = 'departments' and dep.id = d.row_id;

  select count(*) into v_removed from public.demo_data_objects;
  delete from public.demo_data_objects;

  return jsonb_build_object('cleared', true, 'tracked_rows_removed', v_removed);
end;
$$;

comment on function public.clear_demo_data is
  'يحذف كل ما ولّدته seed_demo_data بالاعتماد على السجل — لا يمسّ صفًّا حقيقيًا.';

revoke all on function public.seed_demo_data(uuid) from public, anon;
revoke all on function public.clear_demo_data() from public, anon;
revoke all on function public.demo_data_status() from public, anon;
grant execute on function public.seed_demo_data(uuid) to authenticated;
grant execute on function public.clear_demo_data() to authenticated;
grant execute on function public.demo_data_status() to authenticated;
