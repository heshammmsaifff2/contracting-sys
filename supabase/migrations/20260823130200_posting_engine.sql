-- ═══════════════════════════════════════════════════════════════════════
-- Phase 2 — محرّك الترحيل الآلي (القسم 8 من المواصفات)
-- كل الحدث يقع داخل معاملة Postgres واحدة، فالقيد إمّا يكتمل متوازنًا أو لا يُسجَّل.
-- ═══════════════════════════════════════════════════════════════════════

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
  v_amount         numeric(16, 2);
  v_project_id     uuid;
  v_debit_account  uuid;
  v_credit_account uuid;
  v_description    text;
  v_entry_date     date;
begin
  -- حدث واحد ⇒ قيد واحد. إعادة الاستدعاء تُعيد القيد القائم بلا تكرار.
  select id into v_existing_id
    from public.journal_entries
   where source_type = p_source_type
     and source_id = p_source_id
     and is_manual = false;

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

  -- الحسابات الثابتة تأتي من القاعدة؛ الديناميكية تُحدَّد من المستند أدناه
  select id into v_debit_account
    from public.accounts where code = v_rule.debit_account_code;
  select id into v_credit_account
    from public.accounts where code = v_rule.credit_account_code;

  case p_source_type
    when 'opening_balance' then
      declare
        v_row public.opening_balances%rowtype;
      begin
        select * into v_row from public.opening_balances where id = p_source_id;
        if not found then
          raise exception 'الرصيد الافتتاحي غير موجود: %', p_source_id
            using errcode = 'no_data_found';
        end if;
        if v_row.status <> 'approved' then
          raise exception 'لا يُرحَّل رصيد افتتاحي غير معتمد'
            using errcode = 'check_violation';
        end if;

        v_amount      := abs(v_row.amount);
        v_project_id  := v_row.project_id;
        v_entry_date  := v_row.as_of;
        v_description := 'رصيد افتتاحي';

        -- الرصيد الموجب يجعل الحساب مدينًا، والسالب يعكس الطرفين
        if v_row.amount > 0 then
          v_debit_account := v_row.account_id;
        else
          v_credit_account := v_row.account_id;
          select id into v_debit_account
            from public.accounts where code = v_rule.credit_account_code;
        end if;
      end;

    else
      -- المستندات المصدرية للمراحل 3 و6 و7 لم تُبنَ بعد.
      raise exception 'نوع الحدث % غير مدعوم في المرحلة الحالية', p_source_type
        using errcode = 'feature_not_supported';
  end case;

  if v_debit_account is null or v_credit_account is null then
    raise exception 'تعذّر تحديد حسابَي القيد للحدث %', p_source_type
      using errcode = 'no_data_found';
  end if;

  if exists (
    select 1 from public.accounts
    where id in (v_debit_account, v_credit_account) and not is_postable
  ) then
    raise exception 'لا يجوز الترحيل على حساب تجميعي'
      using errcode = 'check_violation';
  end if;

  insert into public.journal_entries
    (entry_date, description, source_type, source_id, is_manual, project_id)
  values
    (coalesce(v_entry_date, current_date), v_description, p_source_type,
     p_source_id, false, v_project_id)
  returning id into v_entry_id;

  insert into public.journal_lines (entry_id, account_id, debit, credit, description)
  values
    (v_entry_id, v_debit_account, v_amount, 0, v_description),
    (v_entry_id, v_credit_account, 0, v_amount, v_description);

  return v_entry_id;
end;
$$;

comment on function public.post_accounting_entry(text, uuid) is
  'يبني القيد آليًا من المستند وقاعدة الترحيل، بلا أي إدخال بشري. تُستدعى من Edge Function فقط.';

-- لا يستدعيها المتصفّح: الاستدعاء يمرّ عبر Edge Function بمفتاح service_role
revoke execute on function public.post_accounting_entry(text, uuid)
  from public, anon, authenticated;
grant execute on function public.post_accounting_entry(text, uuid) to service_role;

-- ── القيد اليدوي — ممنوع افتراضيًا، يُفتح بصلاحية manual_entry.post ─────
create or replace function public.post_manual_entry(
  p_entry_date date,
  p_description text,
  p_project_id uuid,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry_id uuid;
  v_count int;
begin
  if not public.has_permission('manual_entry.post') then
    raise exception 'القيد اليدوي يتطلّب صلاحية manual_entry.post'
      using errcode = 'insufficient_privilege';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'القيد يحتاج سطرين على الأقل' using errcode = 'check_violation';
  end if;

  insert into public.journal_entries
    (entry_date, description, source_type, source_id, is_manual, posted_by, project_id)
  values
    (coalesce(p_entry_date, current_date), coalesce(p_description, ''),
     'manual', null, true, auth.uid(), p_project_id)
  returning id into v_entry_id;

  insert into public.journal_lines
    (entry_id, account_id, debit, credit, description)
  select
    v_entry_id,
    (line ->> 'account_id')::uuid,
    coalesce((line ->> 'debit')::numeric, 0),
    coalesce((line ->> 'credit')::numeric, 0),
    coalesce(line ->> 'description', '')
  from jsonb_array_elements(p_lines) as line;

  get diagnostics v_count = row_count;
  if v_count < 2 then
    raise exception 'تعذّر إدراج أسطر القيد' using errcode = 'check_violation';
  end if;

  -- المُشغِّل المؤجّل يتحقّق من التوازن عند إنهاء المعاملة
  return v_entry_id;
end;
$$;

revoke execute on function public.post_manual_entry(date, text, uuid, jsonb)
  from public, anon;
grant execute on function public.post_manual_entry(date, text, uuid, jsonb)
  to authenticated;
