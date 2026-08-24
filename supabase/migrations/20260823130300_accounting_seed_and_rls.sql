-- ═══════════════════════════════════════════════════════════════════════
-- Phase 2 — شجرة الحسابات وقواعد الترحيل والصلاحيات وسياسات RLS
-- ═══════════════════════════════════════════════════════════════════════

-- ── شجرة حسابات مبدئية ─────────────────────────────────────────────────
-- قابلة للتوسعة بالكامل من الواجهة؛ هذه أرضية تكفي لأحداث القسم 8.
insert into public.accounts (code, name, type, is_postable) values
  ('1',    'الأصول',                 'asset',     false),
  ('2',    'الخصوم',                 'liability', false),
  ('3',    'حقوق الملكية',           'equity',    false),
  ('4',    'الإيرادات',              'revenue',   false),
  ('5',    'المصروفات',              'expense',   false)
on conflict (code) do update set name = excluded.name;

insert into public.accounts (code, name, type, is_postable, parent_id) values
  ('11',   'النقدية والبنوك',        'asset',     false, (select id from public.accounts where code = '1')),
  ('12',   'المخزون',                'asset',     false, (select id from public.accounts where code = '1')),
  ('13',   'الذمم المدينة',          'asset',     false, (select id from public.accounts where code = '1')),
  ('21',   'الذمم الدائنة',          'liability', false, (select id from public.accounts where code = '2')),
  ('22',   'الضرائب المستحقّة',       'liability', false, (select id from public.accounts where code = '2')),
  ('31',   'رأس المال',              'equity',    false, (select id from public.accounts where code = '3')),
  ('41',   'إيرادات المقاولات',      'revenue',   false, (select id from public.accounts where code = '4')),
  ('51',   'تكاليف المشاريع',        'expense',   false, (select id from public.accounts where code = '5'))
on conflict (code) do update set name = excluded.name, parent_id = excluded.parent_id;

insert into public.accounts (code, name, type, is_postable, parent_id) values
  ('1101', 'البنك',                        'asset',     true, (select id from public.accounts where code = '11')),
  ('1102', 'الخزينة',                      'asset',     true, (select id from public.accounts where code = '11')),
  ('1201', 'مخزون المشاريع',               'asset',     true, (select id from public.accounts where code = '12')),
  ('1301', 'ذمم العمال',                   'asset',     true, (select id from public.accounts where code = '13')),
  ('1302', 'عهد الموظفين',                 'asset',     true, (select id from public.accounts where code = '13')),
  ('2101', 'ذمم الموردين',                 'liability', true, (select id from public.accounts where code = '21')),
  ('2102', 'ذمم المقاولين',                'liability', true, (select id from public.accounts where code = '21')),
  ('2201', 'ضريبة القيمة المضافة',         'liability', true, (select id from public.accounts where code = '22')),
  ('3101', 'رأس المال المدفوع',            'equity',    true, (select id from public.accounts where code = '31')),
  ('3900', 'الأرصدة الافتتاحية',           'equity',    true, (select id from public.accounts where code = '31')),
  ('4101', 'إيرادات عقود المقاولات',       'revenue',   true, (select id from public.accounts where code = '41')),
  ('5101', 'تكلفة تنفيذ المشاريع',         'expense',   true, (select id from public.accounts where code = '51')),
  ('5102', 'مصروفات عمومية وإدارية',       'expense',   true, (select id from public.accounts where code = '51'))
on conflict (code) do update set name = excluded.name, parent_id = excluded.parent_id;

-- ── قواعد الترحيل — جدول المواصفات القسم 8 ─────────────────────────────
-- المدعوم الآن: opening_balance. البقية هيكل جاهز يُفعَّل مع مستنداته.
insert into public.posting_rules (source_type, debit_account_code, credit_account_code, description) values
  ('opening_balance',   null,   '3900', 'رصيد افتتاحي: الحساب مدين مقابل الأرصدة الافتتاحية'),
  ('custody_approval',  '5101', '1302', 'اعتماد عهدة: مصروف المشروع مقابل ذمم صاحب العهدة'),
  ('payment_transfer',  '2101', '1101', 'تحويل مبلغ: ذمم المورد مقابل البنك'),
  ('extract_approval',  '5101', '2102', 'اعتماد مستخلص: تكلفة البند مقابل ذمم المقاول'),
  ('material_transfer', '1201', '1201', 'نقل مواد بين المواقع بثمنها آليًا'),
  ('loan_disbursement', '1301', '1101', 'صرف سلفة: ذمم العامل مقابل البنك')
on conflict (source_type) do update
  set debit_account_code  = excluded.debit_account_code,
      credit_account_code = excluded.credit_account_code,
      description         = excluded.description;

-- ── صلاحيات المرحلة الثانية ────────────────────────────────────────────
insert into public.permissions (key, description, module) values
  ('item.read',              'عرض الأصناف',                    'catalog'),
  ('item.create',            'إضافة صنف',                      'catalog'),
  ('item.update',            'تعديل صنف',                      'catalog'),
  ('item.delete',            'حذف صنف',                        'catalog'),
  ('boq.read',               'عرض البنود',                     'catalog'),
  ('boq.manage',             'إضافة وتعديل البنود وتكوينها',   'catalog'),
  ('account.read',           'عرض شجرة الحسابات',              'accounting'),
  ('account.manage',         'تعديل شجرة الحسابات',            'accounting'),
  ('journal.read',           'عرض القيود المحاسبية',           'accounting'),
  ('manual_entry.post',      'تسجيل قيد يدوي',                 'accounting'),
  ('opening_balance.manage', 'إدارة الأرصدة الافتتاحية',       'accounting'),
  ('posting_rule.manage',    'تعديل قواعد الترحيل الآلي',      'accounting')
on conflict (key) do update
  set description = excluded.description, module = excluded.module;

-- مدير النظام يأخذ كل صلاحية جديدة تلقائيًا
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

-- مدير البرنامج: يقرأ ويدير الكتالوج ويقرأ المحاسبة، بلا قيد يدوي
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'item.read', 'item.create', 'item.update',
  'boq.read', 'boq.manage',
  'account.read', 'journal.read'
)
where r.key = 'program_manager'
on conflict do nothing;

-- المهندس ومدير المشروع: يقرآن الأصناف والبنود فقط
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('item.read', 'boq.read')
where r.key in ('engineer', 'project_manager')
on conflict do nothing;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table public.items                 enable row level security;
alter table public.boq_items             enable row level security;
alter table public.item_boq_map          enable row level security;
alter table public.saved_item_lists      enable row level security;
alter table public.saved_item_list_lines enable row level security;
alter table public.accounts              enable row level security;
alter table public.journal_entries       enable row level security;
alter table public.journal_lines         enable row level security;
alter table public.posting_rules         enable row level security;
alter table public.opening_balances      enable row level security;

revoke all on public.items, public.boq_items, public.item_boq_map,
  public.saved_item_lists, public.saved_item_list_lines, public.accounts,
  public.journal_entries, public.journal_lines, public.posting_rules,
  public.opening_balances
  from anon;

-- الأصناف
drop policy if exists items_select on public.items;
create policy items_select on public.items
  for select to authenticated using (public.has_permission('item.read'));

drop policy if exists items_insert on public.items;
create policy items_insert on public.items
  for insert to authenticated with check (public.has_permission('item.create'));

drop policy if exists items_update on public.items;
create policy items_update on public.items
  for update to authenticated
  using (public.has_permission('item.update'))
  with check (public.has_permission('item.update'));

drop policy if exists items_delete on public.items;
create policy items_delete on public.items
  for delete to authenticated using (public.has_permission('item.delete'));

-- البنود
drop policy if exists boq_items_select on public.boq_items;
create policy boq_items_select on public.boq_items
  for select to authenticated using (public.has_permission('boq.read'));

drop policy if exists boq_items_write on public.boq_items;
create policy boq_items_write on public.boq_items
  for all to authenticated
  using (public.has_permission('boq.manage'))
  with check (public.has_permission('boq.manage'));

drop policy if exists item_boq_map_select on public.item_boq_map;
create policy item_boq_map_select on public.item_boq_map
  for select to authenticated using (public.has_permission('boq.read'));

drop policy if exists item_boq_map_write on public.item_boq_map;
create policy item_boq_map_write on public.item_boq_map
  for all to authenticated
  using (public.has_permission('boq.manage'))
  with check (public.has_permission('boq.manage'));

-- القوائم المحفوظة: ملك صاحبها، ما لم تُشارَك
drop policy if exists saved_item_lists_select on public.saved_item_lists;
create policy saved_item_lists_select on public.saved_item_lists
  for select to authenticated
  using (owner_id = (select auth.uid()) or is_shared);

drop policy if exists saved_item_lists_write on public.saved_item_lists;
create policy saved_item_lists_write on public.saved_item_lists
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists saved_item_list_lines_select on public.saved_item_list_lines;
create policy saved_item_list_lines_select on public.saved_item_list_lines
  for select to authenticated
  using (exists (
    select 1 from public.saved_item_lists l
    where l.id = list_id and (l.owner_id = (select auth.uid()) or l.is_shared)
  ));

drop policy if exists saved_item_list_lines_write on public.saved_item_list_lines;
create policy saved_item_list_lines_write on public.saved_item_list_lines
  for all to authenticated
  using (exists (
    select 1 from public.saved_item_lists l
    where l.id = list_id and l.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.saved_item_lists l
    where l.id = list_id and l.owner_id = (select auth.uid())
  ));

-- شجرة الحسابات
drop policy if exists accounts_select on public.accounts;
create policy accounts_select on public.accounts
  for select to authenticated using (public.has_permission('account.read'));

drop policy if exists accounts_write on public.accounts;
create policy accounts_write on public.accounts
  for all to authenticated
  using (public.has_permission('account.manage'))
  with check (public.has_permission('account.manage'));

-- دفتر اليومية: قراءة فقط من الواجهة. الكتابة حصرًا عبر الدوال.
drop policy if exists journal_entries_select on public.journal_entries;
create policy journal_entries_select on public.journal_entries
  for select to authenticated
  using (
    public.has_permission('journal.read')
    and (
      project_id is null
      or public.has_permission('project.read_all')
      or public.is_assigned_to_project(project_id)
    )
  );

drop policy if exists journal_lines_select on public.journal_lines;
create policy journal_lines_select on public.journal_lines
  for select to authenticated
  using (exists (select 1 from public.journal_entries e where e.id = entry_id));

-- قواعد الترحيل
drop policy if exists posting_rules_select on public.posting_rules;
create policy posting_rules_select on public.posting_rules
  for select to authenticated using (public.has_permission('account.read'));

drop policy if exists posting_rules_write on public.posting_rules;
create policy posting_rules_write on public.posting_rules
  for all to authenticated
  using (public.has_permission('posting_rule.manage'))
  with check (public.has_permission('posting_rule.manage'));

-- الأرصدة الافتتاحية
drop policy if exists opening_balances_select on public.opening_balances;
create policy opening_balances_select on public.opening_balances
  for select to authenticated
  using (
    public.has_permission('opening_balance.manage')
    or public.has_permission('journal.read')
  );

drop policy if exists opening_balances_write on public.opening_balances;
create policy opening_balances_write on public.opening_balances
  for all to authenticated
  using (public.has_permission('opening_balance.manage'))
  with check (public.has_permission('opening_balance.manage'));
