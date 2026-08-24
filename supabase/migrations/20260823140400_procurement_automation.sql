-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3 — أتمتة سلسلة المشتريات.
-- كل مستند يُولَّد من سابقه على الخادم: صفر إدخال يدوي مكرّر.
-- كلها SECURITY DEFINER لأنها تعبر عدّة جداول ومشاريع، وتفحص الصلاحية بنفسها.
-- ═══════════════════════════════════════════════════════════════════════

-- نسبة الضريبة من جدول الإعدادات — لا رقم سحري في الكود.
create or replace function public.current_vat_rate()
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select (value #>> '{}')::numeric from public.settings where key = 'vat_rate'),
    0
  );
$$;

revoke execute on function public.current_vat_rate() from public, anon;
grant execute on function public.current_vat_rate() to authenticated;

-- ── 1) طلب شراء من طلبات احتياج: الاحتياج − المتوفّر بالموقع ───────────
create or replace function public.generate_purchase_request(
  p_material_request_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pr_id uuid;
  v_count int;
begin
  if not public.has_permission('purchase.manage') then
    raise exception 'يتطلّب صلاحية purchase.manage' using errcode = 'insufficient_privilege';
  end if;

  if p_material_request_ids is null or array_length(p_material_request_ids, 1) is null then
    raise exception 'لم تُحدَّد طلبات احتياج' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.material_requests
    where id = any (p_material_request_ids) and status <> 'approved'
  ) then
    raise exception 'كل طلبات الاحتياج يجب أن تكون معتمدة' using errcode = 'check_violation';
  end if;

  insert into public.purchase_requests (status, created_by)
  values ('draft', auth.uid())
  returning id into v_pr_id;

  insert into public.purchase_request_sources (purchase_request_id, material_request_id)
  select v_pr_id, unnest(p_material_request_ids);

  -- الكمية المطلوبة شراؤها = المطلوب − المتوفّر بالموقع، لكل مشروع على حدة
  insert into public.purchase_request_lines (pr_id, item_id, project_id, qty)
  select v_pr_id, agg.item_id, agg.project_id, agg.needed
  from (
    select
      r.project_id,
      l.item_id,
      sum(l.requested_qty) - coalesce(max(st.quantity), 0) as needed
    from public.material_request_lines l
    join public.material_requests r on r.id = l.request_id
    left join public.site_stock st
      on st.project_id = r.project_id and st.item_id = l.item_id
    where l.request_id = any (p_material_request_ids)
    group by r.project_id, l.item_id
  ) agg
  where agg.needed > 0;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'المتوفّر بالموقع يغطّي الاحتياج بالكامل — لا حاجة للشراء'
      using errcode = 'check_violation';
  end if;

  update public.material_requests
     set status = 'converted'
   where id = any (p_material_request_ids);

  return v_pr_id;
end;
$$;

revoke execute on function public.generate_purchase_request(uuid[]) from public, anon;
grant execute on function public.generate_purchase_request(uuid[]) to authenticated;

-- ── 2) طلب توريد من عرض المورّد الفائز ─────────────────────────────────
create or replace function public.generate_supply_order(
  p_pr_id uuid,
  p_supplier_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_so_id uuid;
  v_subtotal numeric(16, 2);
  v_vat_rate numeric(6, 3);
  v_vat numeric(16, 2);
  v_missing int;
begin
  if not public.has_permission('supply_order.manage') then
    raise exception 'يتطلّب صلاحية supply_order.manage'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.supplier_quotes
    where pr_id = p_pr_id and supplier_id = p_supplier_id
  ) then
    raise exception 'لا يوجد عرض سعر من هذا المورّد لطلب الشراء'
      using errcode = 'no_data_found';
  end if;

  -- لا يُصدر أمر توريد وبعض الأصناف بلا سعر من هذا المورّد
  select count(*) into v_missing
  from public.purchase_request_lines prl
  where prl.pr_id = p_pr_id
    and not exists (
      select 1
      from public.supplier_quote_lines sql_
      join public.supplier_quotes q on q.id = sql_.quote_id
      where q.pr_id = p_pr_id
        and q.supplier_id = p_supplier_id
        and sql_.item_id = prl.item_id
    );

  if v_missing > 0 then
    raise exception 'المورّد لم يسعّر % صنفًا من طلب الشراء', v_missing
      using errcode = 'check_violation';
  end if;

  v_vat_rate := public.current_vat_rate();

  insert into public.supply_orders (pr_id, supplier_id, vat_rate, status, created_by)
  values (p_pr_id, p_supplier_id, v_vat_rate, 'draft', auth.uid())
  returning id into v_so_id;

  -- الأسعار مستدعاة من عرض المورّد؛ الكميات من طلب الشراء. لا إدخال يدوي.
  insert into public.supply_order_lines (so_id, item_id, project_id, qty, unit_price)
  select v_so_id, prl.item_id, prl.project_id, prl.qty, sql_.unit_price
  from public.purchase_request_lines prl
  join public.supplier_quotes q
    on q.pr_id = prl.pr_id and q.supplier_id = p_supplier_id
  join public.supplier_quote_lines sql_
    on sql_.quote_id = q.id and sql_.item_id = prl.item_id
  where prl.pr_id = p_pr_id;

  select coalesce(sum(qty * unit_price), 0) into v_subtotal
    from public.supply_order_lines where so_id = v_so_id;

  v_vat := round(v_subtotal * v_vat_rate / 100, 2);

  update public.supply_orders
     set subtotal = v_subtotal,
         vat_amount = v_vat,
         total = v_subtotal + v_vat
   where id = v_so_id;

  update public.purchase_requests set status = 'ordered' where id = p_pr_id;

  return v_so_id;
end;
$$;

revoke execute on function public.generate_supply_order(uuid, uuid) from public, anon;
grant execute on function public.generate_supply_order(uuid, uuid) to authenticated;

-- ── 3) طلبات استلام: واحد لكل مشروع في أمر التوريد ─────────────────────
create or replace function public.generate_receipt_requests(p_so_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created int := 0;
  v_project record;
  v_rr_id uuid;
begin
  if not public.has_permission('receipt.confirm') then
    raise exception 'يتطلّب صلاحية receipt.confirm'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.supply_orders where id = p_so_id and status = 'approved'
  ) then
    raise exception 'أمر التوريد يجب أن يكون معتمدًا' using errcode = 'check_violation';
  end if;

  for v_project in
    select distinct project_id from public.supply_order_lines where so_id = p_so_id
  loop
    insert into public.receipt_requests (supply_order_id, project_id, status, created_by)
    values (p_so_id, v_project.project_id, 'draft', auth.uid())
    on conflict (supply_order_id, project_id) do nothing
    returning id into v_rr_id;

    if v_rr_id is not null then
      insert into public.receipt_request_lines (rr_id, item_id, qty, unit_price)
      select v_rr_id, sol.item_id, sol.qty, sol.unit_price
      from public.supply_order_lines sol
      where sol.so_id = p_so_id and sol.project_id = v_project.project_id;

      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$$;

revoke execute on function public.generate_receipt_requests(uuid) from public, anon;
grant execute on function public.generate_receipt_requests(uuid) to authenticated;

-- ── 4) تأكيد الاستلام: يزيد مخزون الموقع آليًا ─────────────────────────
create or replace function public.confirm_receipt(p_rr_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_id uuid;
  v_so_id uuid;
begin
  if not public.has_permission('receipt.confirm') then
    raise exception 'يتطلّب صلاحية receipt.confirm'
      using errcode = 'insufficient_privilege';
  end if;

  select project_id, supply_order_id into v_project_id, v_so_id
    from public.receipt_requests where id = p_rr_id and status = 'draft';

  if not found then
    raise exception 'طلب الاستلام غير موجود أو مؤكَّد سلفًا'
      using errcode = 'check_violation';
  end if;

  -- من لا يرى المشروع لا يستلم له
  if not (public.has_permission('project.read_all')
          or public.is_assigned_to_project(v_project_id)) then
    raise exception 'المشروع غير معتمد لك' using errcode = 'insufficient_privilege';
  end if;

  update public.receipt_requests
     set status = 'received', received_at = current_date
   where id = p_rr_id;

  -- المتوفّر بالموقع يزيد آليًا، فيُخصم من الاحتياج القادم
  insert into public.site_stock (project_id, item_id, quantity, recorded_by)
  select v_project_id, l.item_id, l.qty, auth.uid()
  from public.receipt_request_lines l
  where l.rr_id = p_rr_id
  on conflict (project_id, item_id) do update
    set quantity = public.site_stock.quantity + excluded.quantity,
        recorded_by = excluded.recorded_by;

  -- أمر التوريد يصير مستلَمًا متى استُلمت كل مشاريعه
  if not exists (
    select 1 from public.receipt_requests
    where supply_order_id = v_so_id and status = 'draft'
  ) then
    update public.supply_orders set status = 'received' where id = v_so_id;
  end if;

  return p_rr_id;
end;
$$;

revoke execute on function public.confirm_receipt(uuid) from public, anon;
grant execute on function public.confirm_receipt(uuid) to authenticated;

-- ── 5) طلب دفع من أمر التوريد ──────────────────────────────────────────
create or replace function public.generate_payment_request(p_so_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pr_id uuid;
  v_so public.supply_orders%rowtype;
  v_bank_account_id uuid;
  v_project_ids uuid[];
  v_project_id uuid;
begin
  if not public.has_permission('payment.manage') then
    raise exception 'يتطلّب صلاحية payment.manage'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_so from public.supply_orders where id = p_so_id;
  if not found then
    raise exception 'أمر التوريد غير موجود' using errcode = 'no_data_found';
  end if;
  if v_so.status not in ('approved', 'received') then
    raise exception 'أمر التوريد يجب أن يكون معتمدًا أو مستلَمًا'
      using errcode = 'check_violation';
  end if;

  -- حساب المورّد البنكي يُستدعى تلقائيًا [المشتريات 10]
  select id into v_bank_account_id
    from public.supplier_bank_accounts
   where supplier_id = v_so.supplier_id
   order by is_default desc, created_at
   limit 1;

  -- مشروع واحد ⇒ ننسب الدفعة إليه؛ عدّة مشاريع ⇒ تبقى بلا مشروع
  -- لأن التكلفة موزّعة ولا يصحّ نسبها لمشروع بعينه.
  -- ملاحظة: لا توجد دالة min(uuid) في Postgres، لذا نستخدم array_agg.
  select array_agg(distinct project_id) into v_project_ids
    from public.supply_order_lines where so_id = p_so_id;

  v_project_id := case
    when array_length(v_project_ids, 1) = 1 then v_project_ids[1]
    else null
  end;

  insert into public.payment_requests (
    source_type, source_id, party_type, party_id,
    supplier_bank_account_id, project_id, amount, status, created_by
  )
  values (
    'supply_order', p_so_id, 'supplier', v_so.supplier_id,
    v_bank_account_id, v_project_id, v_so.total, 'pending', auth.uid()
  )
  on conflict (source_type, source_id, party_id) do nothing
  returning id into v_pr_id;

  if v_pr_id is null then
    select id into v_pr_id from public.payment_requests
     where source_type = 'supply_order' and source_id = p_so_id
       and party_id = v_so.supplier_id;
  end if;

  return v_pr_id;
end;
$$;

revoke execute on function public.generate_payment_request(uuid) from public, anon;
grant execute on function public.generate_payment_request(uuid) to authenticated;
