-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6 — محرّك الترحيل v3: المستخلصات والعهد والدفعات المقدّمة.
-- المستخلص قيد متعدّد الأطراف: تكلفة البند مدينة، وكل استقطاع دائن
-- بحسابه، والصافي ذمم المقاول — بلا أي إدخال بشري [الحسابات 19].
-- ═══════════════════════════════════════════════════════════════════════

insert into public.posting_rules
  (source_type, debit_account_code, credit_account_code, description)
values
  ('advance_payment', '1303', '2102',
   'دفعة مقدّمة: أصل على المقاول مقابل ذممه')
on conflict (source_type) do update
  set debit_account_code = excluded.debit_account_code,
      credit_account_code = excluded.credit_account_code,
      description = excluded.description;

create or replace function public.post_accounting_entry(
  p_source_type text,
  p_source_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule           public.posting_rules%rowtype;
  v_entry_id       uuid;
  v_existing_id    uuid;
  v_project_id     uuid;
  v_debit_account  uuid;
  v_credit_account uuid;
  v_description    text;
  v_entry_date     date;
  v_lines          jsonb := '[]'::jsonb;
begin
  -- حدث واحد ⇒ قيد واحد. إعادة الاستدعاء تُعيد القيد القائم بلا تكرار.
  select id into v_existing_id
    from public.journal_entries
   where source_type = p_source_type and source_id = p_source_id and is_manual = false;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select * into v_rule
    from public.posting_rules
   where source_type = p_source_type and is_active;

  if not found then
    raise exception 'لا توجد قاعدة ترحيل مفعّلة للحدث %', p_source_type
      using errcode = 'no_data_found';
  end if;

  select id into v_debit_account from public.accounts where code = v_rule.debit_account_code;
  select id into v_credit_account from public.accounts where code = v_rule.credit_account_code;

  case p_source_type

    -- ── رصيد افتتاحي ───────────────────────────────────────────────────
    when 'opening_balance' then
      declare
        v_row public.opening_balances%rowtype;
        v_amount numeric(16, 2);
      begin
        select * into v_row from public.opening_balances where id = p_source_id;
        if not found then
          raise exception 'الرصيد الافتتاحي غير موجود' using errcode = 'no_data_found';
        end if;
        if v_row.status <> 'approved' then
          raise exception 'لا يُرحَّل رصيد افتتاحي غير معتمد' using errcode = 'check_violation';
        end if;

        v_amount := abs(v_row.amount);
        v_project_id := v_row.project_id;
        v_entry_date := v_row.as_of;
        v_description := 'رصيد افتتاحي';

        if v_row.amount > 0 then
          v_lines := jsonb_build_array(
            jsonb_build_object('account_id', v_row.account_id, 'debit', v_amount),
            jsonb_build_object('account_id', v_credit_account, 'credit', v_amount)
          );
        else
          v_lines := jsonb_build_array(
            jsonb_build_object('account_id', v_credit_account, 'debit', v_amount),
            jsonb_build_object('account_id', v_row.account_id, 'credit', v_amount)
          );
        end if;
      end;

    -- ── استلام أصناف: مخزون + ضريبة مقابل ذمم المورّد ──────────────────
    when 'receipt_approval' then
      declare
        v_rr public.receipt_requests%rowtype;
        v_goods numeric(16, 2);
        v_vat_rate numeric(6, 3);
        v_vat numeric(16, 2);
        v_vat_account uuid;
        v_supplier_id uuid;
      begin
        select * into v_rr from public.receipt_requests where id = p_source_id;
        if not found then
          raise exception 'طلب الاستلام غير موجود' using errcode = 'no_data_found';
        end if;
        if v_rr.status <> 'received' then
          raise exception 'لا يُرحَّل استلام غير مؤكَّد' using errcode = 'check_violation';
        end if;

        select coalesce(sum(qty * unit_price), 0) into v_goods
          from public.receipt_request_lines where rr_id = p_source_id;

        if v_goods <= 0 then
          raise exception 'قيمة الاستلام صفر' using errcode = 'check_violation';
        end if;

        select so.vat_rate, so.supplier_id into v_vat_rate, v_supplier_id
          from public.supply_orders so where so.id = v_rr.supply_order_id;

        v_vat := round(v_goods * coalesce(v_vat_rate, 0) / 100, 2);
        v_vat_account := public.account_id_by_setting('vat_account_code');

        v_project_id := v_rr.project_id;
        v_entry_date := coalesce(v_rr.received_at, current_date);
        v_description := 'استلام أصناف — طلب رقم ' || v_rr.no;

        v_lines := jsonb_build_array(
          jsonb_build_object('account_id', v_debit_account, 'debit', v_goods,
                             'description', 'قيمة الأصناف المستلمة')
        );

        if v_vat > 0 and v_vat_account is not null then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_vat_account, 'debit', v_vat,
                               'description', 'ضريبة القيمة المضافة')
          );
        else
          v_vat := 0;
        end if;

        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_id', v_credit_account, 'credit', v_goods + v_vat,
                             'party_type', 'supplier', 'party_id', v_supplier_id,
                             'description', 'ذمم المورّد')
        );
      end;

    -- ── تحويل مبلغ: ذمم المستفيد ومصاريف البنك مقابل البنك ─────────────
    when 'payment_transfer' then
      declare
        v_pay public.payment_requests%rowtype;
        v_fee_account uuid;
        v_payable_account uuid;
      begin
        select * into v_pay from public.payment_requests where id = p_source_id;
        if not found then
          raise exception 'طلب الدفع غير موجود' using errcode = 'no_data_found';
        end if;
        if v_pay.status <> 'transferred' then
          raise exception 'لا يُرحَّل طلب دفع لم يُحوَّل' using errcode = 'check_violation';
        end if;

        -- ذمم المقاول حساب مستقل عن ذمم المورّد
        v_payable_account := case v_pay.party_type
          when 'contractor' then (select id from public.accounts where code = '2102')
          when 'worker'     then (select id from public.accounts where code = '1301')
          when 'employee'   then (select id from public.accounts where code = '1302')
          else v_debit_account
        end;

        v_fee_account := public.account_id_by_setting('bank_fee_account_code');
        v_project_id := v_pay.project_id;
        v_entry_date := coalesce(v_pay.transferred_at::date, current_date);
        v_description := 'تحويل بنكي — طلب دفع رقم ' || v_pay.no;

        v_lines := jsonb_build_array(
          jsonb_build_object('account_id', coalesce(v_payable_account, v_debit_account),
                             'debit', v_pay.amount,
                             'party_type', v_pay.party_type, 'party_id', v_pay.party_id,
                             'description', 'سداد ذمم')
        );

        if v_pay.bank_fee_company > 0 and v_fee_account is not null then
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_fee_account, 'debit', v_pay.bank_fee_company,
                               'description', 'مصاريف تحويل بنكي')
          );
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_credit_account,
                               'credit', v_pay.amount + v_pay.bank_fee_company,
                               'description', 'البنك')
          );
        else
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_credit_account, 'credit', v_pay.amount,
                               'description', 'البنك')
          );
        end if;
      end;

    -- ── نقل مواد بين المواقع بثمنها آليًا ──────────────────────────────
    when 'material_transfer' then
      declare
        v_note public.transfer_notes%rowtype;
        v_value numeric(16, 2);
      begin
        select * into v_note from public.transfer_notes where id = p_source_id;
        if not found then
          raise exception 'سند النقل غير موجود' using errcode = 'no_data_found';
        end if;
        if v_note.status <> 'approved' then
          raise exception 'لا يُرحَّل سند نقل غير معتمد' using errcode = 'check_violation';
        end if;

        select coalesce(sum(qty * unit_cost), 0) into v_value
          from public.transfer_note_lines where note_id = p_source_id;

        if v_value <= 0 then
          raise exception 'قيمة سند النقل صفر' using errcode = 'check_violation';
        end if;

        v_project_id := v_note.to_project_id;
        v_entry_date := current_date;
        v_description := 'نقل مواد — سند رقم ' || v_note.no;

        v_lines := jsonb_build_array(
          jsonb_build_object('account_id', v_debit_account, 'debit', v_value,
                             'party_type', 'project', 'party_id', v_note.to_project_id,
                             'description', 'مخزون الموقع المستقبِل'),
          jsonb_build_object('account_id', v_credit_account, 'credit', v_value,
                             'party_type', 'project', 'party_id', v_note.from_project_id,
                             'description', 'مخزون الموقع المُرسِل')
        );
      end;

    -- ── اعتماد مستخلص: تكلفة البند مقابل الاستقطاعات وصافي ذمم المقاول ─
    when 'extract_approval' then
      declare
        v_extract public.extracts%rowtype;
        v_deduction record;
        v_retention_account uuid;
      begin
        select * into v_extract from public.extracts where id = p_source_id;
        if not found then
          raise exception 'المستخلص غير موجود' using errcode = 'no_data_found';
        end if;
        if v_extract.status not in ('approved', 'paid') then
          raise exception 'لا يُرحَّل مستخلص غير معتمد' using errcode = 'check_violation';
        end if;
        if v_extract.gross_amount <= 0 then
          raise exception 'قيمة المستخلص صفر' using errcode = 'check_violation';
        end if;

        v_project_id := v_extract.project_id;
        v_entry_date := v_extract.extract_date;
        v_description := 'مستخلص رقم ' || v_extract.seq ||
                         case when v_extract.is_final then ' (ختامي)' else '' end;

        -- تكلفة تنفيذ المشروع مدينة بالإجمالي قبل أي استقطاع
        v_lines := jsonb_build_array(
          jsonb_build_object('account_id', v_debit_account, 'debit', v_extract.gross_amount,
                             'party_type', 'contractor', 'party_id', v_extract.contractor_id,
                             'description', 'تكلفة أعمال المستخلص')
        );

        -- ردّ الضمان المحتجز في الختامي: يُقفل الالتزام ويزيد المستحقّ
        if v_extract.retention_released > 0 then
          select id into v_retention_account from public.accounts where code = '2103';
          if v_retention_account is not null then
            v_lines := v_lines || jsonb_build_array(
              jsonb_build_object('account_id', v_retention_account,
                                 'debit', v_extract.retention_released,
                                 'party_type', 'contractor',
                                 'party_id', v_extract.contractor_id,
                                 'description', 'ردّ محتجزات ضمان الأعمال')
            );
          end if;
        end if;

        -- كل استقطاع بحسابه كما ضُبط في إعداد الاستقطاعات
        for v_deduction in
          select d.name, d.amount, a.id as account_id
          from public.extract_deductions d
          join public.accounts a on a.code = d.account_code
          where d.extract_id = p_source_id and d.amount > 0
        loop
          v_lines := v_lines || jsonb_build_array(
            jsonb_build_object('account_id', v_deduction.account_id,
                               'credit', v_deduction.amount,
                               'party_type', 'contractor',
                               'party_id', v_extract.contractor_id,
                               'description', v_deduction.name)
          );
        end loop;

        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object('account_id', v_credit_account, 'credit', v_extract.net_amount,
                             'party_type', 'contractor', 'party_id', v_extract.contractor_id,
                             'description', 'صافي مستحقّ المقاول')
        );
      end;

    -- ── اعتماد عهدة: مصروف المشروع مقابل ذمة صاحب العهدة ───────────────
    when 'custody_approval' then
      declare
        v_custody public.custodies%rowtype;
      begin
        select * into v_custody from public.custodies where id = p_source_id;
        if not found then
          raise exception 'العهدة غير موجودة' using errcode = 'no_data_found';
        end if;
        if v_custody.status not in ('approved', 'closed') then
          raise exception 'لا تُرحَّل عهدة غير معتمدة' using errcode = 'check_violation';
        end if;
        if v_custody.total_amount <= 0 then
          raise exception 'قيمة العهدة صفر' using errcode = 'check_violation';
        end if;

        v_project_id := v_custody.project_id;
        v_entry_date := coalesce(v_custody.approved_at::date, current_date);
        v_description := 'عهدة مسلسل ' || v_custody.serial;

        v_lines := jsonb_build_array(
          jsonb_build_object('account_id', v_debit_account, 'debit', v_custody.total_amount,
                             'party_type', 'project', 'party_id', v_custody.project_id,
                             'description', 'مصروفات العهدة'),
          jsonb_build_object('account_id', v_credit_account, 'credit', v_custody.total_amount,
                             'party_type', 'employee', 'party_id', v_custody.holder_id,
                             'description', 'ذمة صاحب العهدة')
        );
      end;

    -- ── دفعة مقدّمة: أصل على المقاول مقابل ذممه ────────────────────────
    when 'advance_payment' then
      declare
        v_advance public.advance_payments%rowtype;
      begin
        select * into v_advance from public.advance_payments where id = p_source_id;
        if not found then
          raise exception 'الدفعة غير موجودة' using errcode = 'no_data_found';
        end if;
        if v_advance.status not in ('approved', 'paid') then
          raise exception 'لا تُرحَّل دفعة غير معتمدة' using errcode = 'check_violation';
        end if;

        v_project_id := v_advance.project_id;
        v_entry_date := coalesce(v_advance.approved_at::date, current_date);
        v_description := 'دفعة مقدّمة رقم ' || v_advance.no;

        v_lines := jsonb_build_array(
          jsonb_build_object('account_id', v_debit_account, 'debit', v_advance.amount,
                             'party_type', 'contractor', 'party_id', v_advance.contractor_id,
                             'description', 'دفعة مقدّمة للمقاول'),
          jsonb_build_object('account_id', v_credit_account, 'credit', v_advance.amount,
                             'party_type', 'contractor', 'party_id', v_advance.contractor_id,
                             'description', 'ذمم المقاول')
        );
      end;

    else
      raise exception 'نوع الحدث % غير مدعوم في المرحلة الحالية', p_source_type
        using errcode = 'feature_not_supported';
  end case;

  if jsonb_array_length(v_lines) < 2 then
    raise exception 'تعذّر بناء أسطر القيد للحدث %', p_source_type
      using errcode = 'no_data_found';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_lines) l
    join public.accounts a on a.id = (l ->> 'account_id')::uuid
    where not a.is_postable
  ) then
    raise exception 'لا يجوز الترحيل على حساب تجميعي' using errcode = 'check_violation';
  end if;

  -- توازن القيد شرط لا يُتجاوز مهما كان مصدره
  if (
    select round(sum(coalesce((l ->> 'debit')::numeric, 0))
               - sum(coalesce((l ->> 'credit')::numeric, 0)), 2)
    from jsonb_array_elements(v_lines) l
  ) <> 0 then
    raise exception 'القيد غير متوازن للحدث %', p_source_type
      using errcode = 'check_violation';
  end if;

  insert into public.journal_entries
    (entry_date, description, source_type, source_id, is_manual, project_id)
  values
    (coalesce(v_entry_date, current_date), v_description, p_source_type,
     p_source_id, false, v_project_id)
  returning id into v_entry_id;

  insert into public.journal_lines
    (entry_id, account_id, debit, credit, description, party_type, party_id)
  select
    v_entry_id,
    (l ->> 'account_id')::uuid,
    coalesce((l ->> 'debit')::numeric, 0),
    coalesce((l ->> 'credit')::numeric, 0),
    coalesce(l ->> 'description', v_description),
    l ->> 'party_type',
    (l ->> 'party_id')::uuid
  from jsonb_array_elements(v_lines) l;

  return v_entry_id;
end;
$$;

comment on function public.post_accounting_entry(text, uuid) is
  'يبني القيد آليًا من المستند وقاعدة الترحيل، بأسطر متعدّدة ومتوازنة. تُستدعى من Edge Function فقط.';

revoke execute on function public.post_accounting_entry(text, uuid)
  from public, anon, authenticated;
grant execute on function public.post_accounting_entry(text, uuid) to service_role;
