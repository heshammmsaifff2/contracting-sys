-- إصلاح: شاشة الدفع والتحويلات كانت تفشل عند كل فتح.
--
-- السبب: `payment_requests.party_id` عمود **متعدّد الأنواع** — قد يشير إلى
-- مورّد أو مقاول أو عامل بحسب `party_type`، ولذلك لا مفتاح أجنبي له ولا
-- يمكن أن يكون. لكن طبقة البيانات كانت تطلب من PostgREST تضمين
-- `suppliers(name)` مباشرةً على الجدول، وPostgREST لا يستطيع استنتاج علاقة
-- بلا مفتاح أجنبي، فيردّ بخطأ قبل أن يصل الطلب إلى أي صفّ.
--
-- ولو نجح التضمين لبقي ناقصًا: كان سيُسمّي المورّدين وحدهم، ويترك اسم
-- المقاول والعامل فارغًا في شاشة تعرض تحويلاتهم جميعًا.
--
-- الحلّ أن يقع الربط حيث يمكن أن يقع صحيحًا: في SQL، بشرط على `party_type`
-- لكل جدول طرف — وهو النمط نفسه المتبَّع في `party_balances`.

create or replace view public.payment_request_details
with (security_invoker = true) as
select
  pr.id,
  pr.no,
  pr.source_type,
  pr.source_id,
  pr.party_type,
  pr.party_id,
  case pr.party_type
    when 'supplier'   then s.name
    when 'contractor' then c.name
    else pf.full_name
  end                            as party_name,
  case pr.party_type
    when 'supplier'   then s.code
    when 'contractor' then c.code
    else pf.code
  end                            as party_code,
  pr.supplier_bank_account_id,
  sba.bank_name,
  sba.account_no,
  pr.project_id,
  p.name                         as project_name,
  pr.amount,
  pr.bank_fee_company,
  pr.bank_fee_client,
  pr.status,
  pr.transferred_at,
  pr.notes,
  pr.created_at
from public.payment_requests pr
left join public.suppliers s
  on pr.party_type = 'supplier' and s.id = pr.party_id
left join public.contractors c
  on pr.party_type = 'contractor' and c.id = pr.party_id
left join public.profiles pf
  on pr.party_type in ('worker', 'employee') and pf.id = pr.party_id
left join public.supplier_bank_accounts sba
  on sba.id = pr.supplier_bank_account_id
left join public.projects p
  on p.id = pr.project_id;

comment on view public.payment_request_details is
  'طلبات الدفع بأسماء أطرافها محلولة حسب party_type — الربط المتعدّد الأنواع '
  'لا يمكن أن يقع في PostgREST لأنه بلا مفتاح أجنبي.';

revoke all on public.payment_request_details from anon;
