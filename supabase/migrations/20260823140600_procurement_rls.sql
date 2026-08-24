-- ═══════════════════════════════════════════════════════════════════════
-- Phase 3 — صلاحيات المشتريات وسياسات RLS
-- ═══════════════════════════════════════════════════════════════════════

-- ── دوال نطاق الرؤية: مستند بلا مشروع مباشر يُقاس بمشاريع أسطره ────────
create or replace function public.can_access_purchase_request(p_pr_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('project.read_all')
      or exists (
        select 1 from public.purchase_request_lines l
        where l.pr_id = p_pr_id
          and l.project_id in (select public.current_project_ids())
      );
$$;

create or replace function public.can_access_supply_order(p_so_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission('project.read_all')
      or exists (
        select 1 from public.supply_order_lines l
        where l.so_id = p_so_id
          and l.project_id in (select public.current_project_ids())
      );
$$;

revoke execute on function public.can_access_purchase_request(uuid) from public, anon;
revoke execute on function public.can_access_supply_order(uuid) from public, anon;
grant execute on function public.can_access_purchase_request(uuid) to authenticated;
grant execute on function public.can_access_supply_order(uuid) to authenticated;

-- ── الصلاحيات ──────────────────────────────────────────────────────────
insert into public.permissions (key, description, module) values
  ('supplier.read',            'عرض الموردين',                     'procurement'),
  ('supplier.manage',          'إضافة وتعديل الموردين وحساباتهم',  'procurement'),
  ('project_item_limit.manage','إدخال الكميات القصوى للأصناف',     'procurement'),
  ('site_stock.manage',        'تسجيل المتوفّر بالموقع',            'procurement'),
  ('material_request.read',    'عرض طلبات الاحتياج',               'procurement'),
  ('material_request.create',  'إنشاء طلب احتياج',                 'procurement'),
  ('material_request.approve', 'اعتماد طلب احتياج',                'procurement'),
  ('purchase.manage',          'إدارة طلبات الشراء والتسعير',      'procurement'),
  ('supply_order.manage',      'إصدار أوامر التوريد',              'procurement'),
  ('supply_order.approve',     'اعتماد أوامر التوريد',             'procurement'),
  ('receipt.confirm',          'تأكيد استلام الأصناف',             'procurement'),
  ('payment.manage',           'إعداد طلبات الدفع والدفعات',       'procurement'),
  ('payment.transfer',         'تنفيذ التحويل البنكي',             'procurement'),
  ('transfer_note.manage',     'إعداد سندات نقل الأصناف',          'procurement'),
  ('transfer_note.approve',    'اعتماد سندات نقل الأصناف',         'procurement')
on conflict (key) do update
  set description = excluded.description, module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'supplier.read', 'supplier.manage', 'project_item_limit.manage', 'site_stock.manage',
  'material_request.read', 'material_request.create', 'material_request.approve',
  'purchase.manage', 'supply_order.manage', 'supply_order.approve',
  'receipt.confirm', 'payment.manage', 'transfer_note.manage', 'transfer_note.approve'
)
where r.key = 'program_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'supplier.read', 'material_request.read', 'material_request.create',
  'site_stock.manage', 'receipt.confirm'
)
where r.key in ('engineer', 'project_manager')
on conflict do nothing;

-- ── تفعيل RLS ──────────────────────────────────────────────────────────
alter table public.suppliers                enable row level security;
alter table public.supplier_bank_accounts   enable row level security;
alter table public.project_item_limits      enable row level security;
alter table public.site_stock               enable row level security;
alter table public.material_requests        enable row level security;
alter table public.material_request_lines   enable row level security;
alter table public.transfer_notes           enable row level security;
alter table public.transfer_note_lines      enable row level security;
alter table public.purchase_requests        enable row level security;
alter table public.purchase_request_sources enable row level security;
alter table public.purchase_request_lines   enable row level security;
alter table public.supplier_quotes          enable row level security;
alter table public.supplier_quote_lines     enable row level security;
alter table public.supply_orders            enable row level security;
alter table public.supply_order_lines       enable row level security;
alter table public.receipt_requests         enable row level security;
alter table public.receipt_request_lines    enable row level security;
alter table public.payment_requests         enable row level security;
alter table public.payment_batches          enable row level security;
alter table public.payment_batch_items      enable row level security;
alter table public.cheques                  enable row level security;

revoke all on public.suppliers, public.supplier_bank_accounts, public.project_item_limits,
  public.site_stock, public.material_requests, public.material_request_lines,
  public.transfer_notes, public.transfer_note_lines, public.purchase_requests,
  public.purchase_request_sources, public.purchase_request_lines, public.supplier_quotes,
  public.supplier_quote_lines, public.supply_orders, public.supply_order_lines,
  public.receipt_requests, public.receipt_request_lines, public.payment_requests,
  public.payment_batches, public.payment_batch_items, public.cheques
  from anon;

-- ── الموردون ───────────────────────────────────────────────────────────
drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select on public.suppliers
  for select to authenticated using (public.has_permission('supplier.read'));

drop policy if exists suppliers_write on public.suppliers;
create policy suppliers_write on public.suppliers
  for all to authenticated
  using (public.has_permission('supplier.manage'))
  with check (public.has_permission('supplier.manage'));

drop policy if exists supplier_bank_accounts_select on public.supplier_bank_accounts;
create policy supplier_bank_accounts_select on public.supplier_bank_accounts
  for select to authenticated using (public.has_permission('supplier.read'));

drop policy if exists supplier_bank_accounts_write on public.supplier_bank_accounts;
create policy supplier_bank_accounts_write on public.supplier_bank_accounts
  for all to authenticated
  using (public.has_permission('supplier.manage'))
  with check (public.has_permission('supplier.manage'));

-- ── حدود المكتب الفني والمتوفّر بالموقع — مقيّدة بالمشروع ──────────────
drop policy if exists project_item_limits_select on public.project_item_limits;
create policy project_item_limits_select on public.project_item_limits
  for select to authenticated
  using (
    public.has_permission('project.read_all')
    or public.is_assigned_to_project(project_id)
  );

drop policy if exists project_item_limits_write on public.project_item_limits;
create policy project_item_limits_write on public.project_item_limits
  for all to authenticated
  using (public.has_permission('project_item_limit.manage'))
  with check (public.has_permission('project_item_limit.manage'));

drop policy if exists site_stock_select on public.site_stock;
create policy site_stock_select on public.site_stock
  for select to authenticated
  using (
    public.has_permission('project.read_all')
    or public.is_assigned_to_project(project_id)
  );

drop policy if exists site_stock_write on public.site_stock;
create policy site_stock_write on public.site_stock
  for all to authenticated
  using (
    public.has_permission('site_stock.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('site_stock.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

-- ── طلبات الاحتياج ─────────────────────────────────────────────────────
drop policy if exists material_requests_select on public.material_requests;
create policy material_requests_select on public.material_requests
  for select to authenticated
  using (
    public.has_permission('material_request.read')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

drop policy if exists material_requests_insert on public.material_requests;
create policy material_requests_insert on public.material_requests
  for insert to authenticated
  with check (
    public.has_permission('material_request.create')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

drop policy if exists material_requests_update on public.material_requests;
create policy material_requests_update on public.material_requests
  for update to authenticated
  using (
    (public.has_permission('material_request.approve')
     or public.has_permission('material_request.create'))
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('project.read_all')
    or public.is_assigned_to_project(project_id)
  );

drop policy if exists material_request_lines_select on public.material_request_lines;
create policy material_request_lines_select on public.material_request_lines
  for select to authenticated
  using (exists (select 1 from public.material_requests r where r.id = request_id));

drop policy if exists material_request_lines_write on public.material_request_lines;
create policy material_request_lines_write on public.material_request_lines
  for all to authenticated
  using (
    public.has_permission('material_request.create')
    and exists (select 1 from public.material_requests r where r.id = request_id)
  )
  with check (
    public.has_permission('material_request.create')
    and exists (select 1 from public.material_requests r where r.id = request_id)
  );

-- ── سندات النقل ────────────────────────────────────────────────────────
drop policy if exists transfer_notes_select on public.transfer_notes;
create policy transfer_notes_select on public.transfer_notes
  for select to authenticated
  using (
    public.has_permission('project.read_all')
    or public.is_assigned_to_project(from_project_id)
    or public.is_assigned_to_project(to_project_id)
  );

drop policy if exists transfer_notes_write on public.transfer_notes;
create policy transfer_notes_write on public.transfer_notes
  for all to authenticated
  using (public.has_permission('transfer_note.manage'))
  with check (public.has_permission('transfer_note.manage'));

drop policy if exists transfer_note_lines_select on public.transfer_note_lines;
create policy transfer_note_lines_select on public.transfer_note_lines
  for select to authenticated
  using (exists (select 1 from public.transfer_notes n where n.id = note_id));

drop policy if exists transfer_note_lines_write on public.transfer_note_lines;
create policy transfer_note_lines_write on public.transfer_note_lines
  for all to authenticated
  using (
    public.has_permission('transfer_note.manage')
    and exists (select 1 from public.transfer_notes n where n.id = note_id)
  )
  with check (
    public.has_permission('transfer_note.manage')
    and exists (select 1 from public.transfer_notes n where n.id = note_id)
  );

-- ── طلبات الشراء والتسعير ──────────────────────────────────────────────
drop policy if exists purchase_requests_select on public.purchase_requests;
create policy purchase_requests_select on public.purchase_requests
  for select to authenticated
  using (
    public.has_permission('purchase.manage')
    and public.can_access_purchase_request(id)
  );

drop policy if exists purchase_requests_write on public.purchase_requests;
create policy purchase_requests_write on public.purchase_requests
  for all to authenticated
  using (public.has_permission('purchase.manage'))
  with check (public.has_permission('purchase.manage'));

drop policy if exists purchase_request_sources_select on public.purchase_request_sources;
create policy purchase_request_sources_select on public.purchase_request_sources
  for select to authenticated
  using (exists (select 1 from public.purchase_requests p where p.id = purchase_request_id));

drop policy if exists purchase_request_lines_select on public.purchase_request_lines;
create policy purchase_request_lines_select on public.purchase_request_lines
  for select to authenticated
  using (exists (select 1 from public.purchase_requests p where p.id = pr_id));

drop policy if exists purchase_request_lines_write on public.purchase_request_lines;
create policy purchase_request_lines_write on public.purchase_request_lines
  for all to authenticated
  using (public.has_permission('purchase.manage'))
  with check (public.has_permission('purchase.manage'));

drop policy if exists supplier_quotes_select on public.supplier_quotes;
create policy supplier_quotes_select on public.supplier_quotes
  for select to authenticated using (public.has_permission('purchase.manage'));

drop policy if exists supplier_quotes_write on public.supplier_quotes;
create policy supplier_quotes_write on public.supplier_quotes
  for all to authenticated
  using (public.has_permission('purchase.manage'))
  with check (public.has_permission('purchase.manage'));

drop policy if exists supplier_quote_lines_select on public.supplier_quote_lines;
create policy supplier_quote_lines_select on public.supplier_quote_lines
  for select to authenticated using (public.has_permission('purchase.manage'));

drop policy if exists supplier_quote_lines_write on public.supplier_quote_lines;
create policy supplier_quote_lines_write on public.supplier_quote_lines
  for all to authenticated
  using (public.has_permission('purchase.manage'))
  with check (public.has_permission('purchase.manage'));

-- ── أوامر التوريد ──────────────────────────────────────────────────────
drop policy if exists supply_orders_select on public.supply_orders;
create policy supply_orders_select on public.supply_orders
  for select to authenticated
  using (
    public.has_permission('supply_order.manage')
    and public.can_access_supply_order(id)
  );

drop policy if exists supply_orders_write on public.supply_orders;
create policy supply_orders_write on public.supply_orders
  for all to authenticated
  using (
    public.has_permission('supply_order.manage')
    or public.has_permission('supply_order.approve')
  )
  with check (
    public.has_permission('supply_order.manage')
    or public.has_permission('supply_order.approve')
  );

drop policy if exists supply_order_lines_select on public.supply_order_lines;
create policy supply_order_lines_select on public.supply_order_lines
  for select to authenticated
  using (exists (select 1 from public.supply_orders s where s.id = so_id));

drop policy if exists supply_order_lines_write on public.supply_order_lines;
create policy supply_order_lines_write on public.supply_order_lines
  for all to authenticated
  using (public.has_permission('supply_order.manage'))
  with check (public.has_permission('supply_order.manage'));

-- ── طلبات الاستلام — مقيّدة بمشروع الاستلام ────────────────────────────
drop policy if exists receipt_requests_select on public.receipt_requests;
create policy receipt_requests_select on public.receipt_requests
  for select to authenticated
  using (
    public.has_permission('project.read_all')
    or public.is_assigned_to_project(project_id)
  );

drop policy if exists receipt_requests_write on public.receipt_requests;
create policy receipt_requests_write on public.receipt_requests
  for all to authenticated
  using (
    public.has_permission('receipt.confirm')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('receipt.confirm')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

drop policy if exists receipt_request_lines_select on public.receipt_request_lines;
create policy receipt_request_lines_select on public.receipt_request_lines
  for select to authenticated
  using (exists (select 1 from public.receipt_requests r where r.id = rr_id));

drop policy if exists receipt_request_lines_write on public.receipt_request_lines;
create policy receipt_request_lines_write on public.receipt_request_lines
  for all to authenticated
  using (
    public.has_permission('receipt.confirm')
    and exists (select 1 from public.receipt_requests r where r.id = rr_id)
  )
  with check (
    public.has_permission('receipt.confirm')
    and exists (select 1 from public.receipt_requests r where r.id = rr_id)
  );

-- ── الدفع والتحويلات ───────────────────────────────────────────────────
drop policy if exists payment_requests_select on public.payment_requests;
create policy payment_requests_select on public.payment_requests
  for select to authenticated
  using (
    public.has_permission('payment.manage')
    or public.has_permission('payment.transfer')
  );

drop policy if exists payment_requests_write on public.payment_requests;
create policy payment_requests_write on public.payment_requests
  for all to authenticated
  using (
    public.has_permission('payment.manage')
    or public.has_permission('payment.transfer')
  )
  with check (
    public.has_permission('payment.manage')
    or public.has_permission('payment.transfer')
  );

drop policy if exists payment_batches_select on public.payment_batches;
create policy payment_batches_select on public.payment_batches
  for select to authenticated
  using (
    public.has_permission('payment.manage')
    or public.has_permission('payment.transfer')
  );

drop policy if exists payment_batches_write on public.payment_batches;
create policy payment_batches_write on public.payment_batches
  for all to authenticated
  using (public.has_permission('payment.manage'))
  with check (public.has_permission('payment.manage'));

drop policy if exists payment_batch_items_select on public.payment_batch_items;
create policy payment_batch_items_select on public.payment_batch_items
  for select to authenticated
  using (exists (select 1 from public.payment_batches b where b.id = batch_id));

drop policy if exists payment_batch_items_write on public.payment_batch_items;
create policy payment_batch_items_write on public.payment_batch_items
  for all to authenticated
  using (public.has_permission('payment.manage'))
  with check (public.has_permission('payment.manage'));

drop policy if exists cheques_select on public.cheques;
create policy cheques_select on public.cheques
  for select to authenticated
  using (
    public.has_permission('payment.manage')
    or public.has_permission('payment.transfer')
  );

drop policy if exists cheques_write on public.cheques;
create policy cheques_write on public.cheques
  for all to authenticated
  using (public.has_permission('payment.manage'))
  with check (public.has_permission('payment.manage'));
