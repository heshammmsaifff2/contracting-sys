-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6 — صلاحيات الحسابات المتقدّمة وسياسات RLS
-- كل مستند مالي: صلاحية دقيقة + مشروع معتمد، والتوقيع يتطلّب can_sign.
-- ═══════════════════════════════════════════════════════════════════════

insert into public.permissions (key, description, module) values
  ('contractor.read',   'عرض المقاولين',                    'accounting'),
  ('contractor.manage', 'إضافة وتعديل المقاولين',           'accounting'),
  ('contract.manage',   'إدخال بنود تعاقد المقاولين',       'accounting'),
  ('deduction.manage',  'ضبط استقطاعات المستخلصات',         'accounting'),
  ('extract.read',      'عرض المستخلصات',                   'accounting'),
  ('extract.create',    'تحرير مستخلص وإدخال كمياته',       'accounting'),
  ('extract.approve',   'اعتماد المستخلصات',                'accounting'),
  ('custody.read',      'عرض العهد',                        'accounting'),
  ('custody.manage',    'فتح العهد وإدخال فواتيرها',        'accounting'),
  ('custody.approve',   'اعتماد العهد',                     'accounting'),
  ('invoice.review',    'مراجعة الفواتير المكرّرة وتلقّي بلاغها', 'accounting'),
  ('advance.manage',    'إعداد الدفعات المقدّمة',           'accounting'),
  ('advance.approve',   'اعتماد الدفعات المقدّمة',          'accounting'),
  ('guarantee.manage',  'إدارة خطابات الضمان ومتابعتها',    'accounting')
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
  'contractor.read', 'contractor.manage', 'contract.manage', 'deduction.manage',
  'extract.read', 'extract.create', 'extract.approve',
  'custody.read', 'custody.manage', 'custody.approve', 'invoice.review',
  'advance.manage', 'advance.approve', 'guarantee.manage'
)
where r.key = 'program_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'contractor.read', 'contract.manage', 'extract.read', 'extract.create',
  'custody.read', 'custody.manage', 'invoice.review', 'advance.manage',
  'guarantee.manage'
)
where r.key = 'project_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'contractor.read', 'extract.read', 'extract.create', 'custody.read', 'custody.manage'
)
where r.key = 'engineer'
on conflict do nothing;

-- ── تفعيل RLS ──────────────────────────────────────────────────────────
alter table public.contractors               enable row level security;
alter table public.contractor_boq_contracts  enable row level security;
alter table public.deduction_types           enable row level security;
alter table public.extracts                  enable row level security;
alter table public.extract_lines             enable row level security;
alter table public.extract_deductions        enable row level security;
alter table public.extract_workers           enable row level security;
alter table public.custodies                 enable row level security;
alter table public.custody_invoices          enable row level security;
alter table public.advance_payments          enable row level security;
alter table public.guarantees                enable row level security;

revoke all on public.contractors, public.contractor_boq_contracts,
  public.deduction_types, public.extracts, public.extract_lines,
  public.extract_deductions, public.extract_workers, public.custodies,
  public.custody_invoices, public.advance_payments, public.guarantees
  from anon;

revoke all on public.contractor_balances, public.expiring_guarantees from anon;

-- ── المقاولون وبنود التعاقد ────────────────────────────────────────────
drop policy if exists contractors_select on public.contractors;
create policy contractors_select on public.contractors
  for select to authenticated using (public.has_permission('contractor.read'));

drop policy if exists contractors_write on public.contractors;
create policy contractors_write on public.contractors
  for all to authenticated
  using (public.has_permission('contractor.manage'))
  with check (public.has_permission('contractor.manage'));

drop policy if exists contractor_contracts_select on public.contractor_boq_contracts;
create policy contractor_contracts_select on public.contractor_boq_contracts
  for select to authenticated
  using (
    public.has_permission('contractor.read')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

drop policy if exists contractor_contracts_write on public.contractor_boq_contracts;
create policy contractor_contracts_write on public.contractor_boq_contracts
  for all to authenticated
  using (
    public.has_permission('contract.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('contract.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

-- ── الاستقطاعات: يقرأها الجميع ليفهموا مستخلصاتهم، ويضبطها صاحب الصلاحية
drop policy if exists deduction_types_select on public.deduction_types;
create policy deduction_types_select on public.deduction_types
  for select to authenticated using (public.is_active_user());

drop policy if exists deduction_types_write on public.deduction_types;
create policy deduction_types_write on public.deduction_types
  for all to authenticated
  using (public.has_permission('deduction.manage'))
  with check (public.has_permission('deduction.manage'));

-- ── المستخلصات ─────────────────────────────────────────────────────────
drop policy if exists extracts_select on public.extracts;
create policy extracts_select on public.extracts
  for select to authenticated
  using (
    public.has_permission('extract.read')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

-- الإنشاء عبر generate_extract وحدها؛ التعديل هنا للملاحظات وعلامة الختامي
drop policy if exists extracts_update on public.extracts;
create policy extracts_update on public.extracts
  for update to authenticated
  using (
    public.has_permission('extract.create')
    and status in ('draft', 'submitted')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('project.read_all')
    or public.is_assigned_to_project(project_id)
  );

drop policy if exists extract_lines_select on public.extract_lines;
create policy extract_lines_select on public.extract_lines
  for select to authenticated
  using (exists (select 1 from public.extracts e where e.id = extract_id));

-- الكمية تُدخل هنا، والمُشغِّل يمنع تجاوز حد العقد أو تعديل معتمَد
drop policy if exists extract_lines_write on public.extract_lines;
create policy extract_lines_write on public.extract_lines
  for all to authenticated
  using (
    public.has_permission('extract.create')
    and exists (select 1 from public.extracts e where e.id = extract_id)
  )
  with check (
    public.has_permission('extract.create')
    and exists (select 1 from public.extracts e where e.id = extract_id)
  );

drop policy if exists extract_deductions_select on public.extract_deductions;
create policy extract_deductions_select on public.extract_deductions
  for select to authenticated
  using (exists (select 1 from public.extracts e where e.id = extract_id));

-- لا سياسة كتابة: الاستقطاعات تُحسب في approve_extract وحدها.

drop policy if exists extract_workers_select on public.extract_workers;
create policy extract_workers_select on public.extract_workers
  for select to authenticated
  using (exists (select 1 from public.extracts e where e.id = extract_id));

drop policy if exists extract_workers_write on public.extract_workers;
create policy extract_workers_write on public.extract_workers
  for all to authenticated
  using (
    public.has_permission('extract.create')
    and exists (select 1 from public.extracts e where e.id = extract_id)
  )
  with check (
    public.has_permission('extract.create')
    and exists (select 1 from public.extracts e where e.id = extract_id)
  );

-- ── العهد: صاحب العهدة يرى عهدته دائمًا ────────────────────────────────
drop policy if exists custodies_select on public.custodies;
create policy custodies_select on public.custodies
  for select to authenticated
  using (
    holder_id = (select auth.uid())
    or (
      public.has_permission('custody.read')
      and (public.has_permission('project.read_all')
           or public.is_assigned_to_project(project_id))
    )
  );

drop policy if exists custodies_write on public.custodies;
create policy custodies_write on public.custodies
  for all to authenticated
  using (
    public.has_permission('custody.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('custody.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

drop policy if exists custody_invoices_select on public.custody_invoices;
create policy custody_invoices_select on public.custody_invoices
  for select to authenticated
  using (exists (select 1 from public.custodies c where c.id = custody_id));

drop policy if exists custody_invoices_write on public.custody_invoices;
create policy custody_invoices_write on public.custody_invoices
  for all to authenticated
  using (
    public.has_permission('custody.manage')
    and exists (
      select 1 from public.custodies c
      where c.id = custody_id and c.status in ('open', 'submitted')
    )
  )
  with check (
    public.has_permission('custody.manage')
    and exists (
      select 1 from public.custodies c
      where c.id = custody_id and c.status in ('open', 'submitted')
    )
  );

-- مراجعة التكرار: صاحب صلاحية المراجعة وحده يعلّم الفاتورة مراجَعة
drop policy if exists custody_invoices_review on public.custody_invoices;
create policy custody_invoices_review on public.custody_invoices
  for update to authenticated
  using (public.has_permission('invoice.review'))
  with check (public.has_permission('invoice.review'));

-- ── الدفعات المقدّمة والضمانات ─────────────────────────────────────────
drop policy if exists advance_payments_select on public.advance_payments;
create policy advance_payments_select on public.advance_payments
  for select to authenticated
  using (
    (public.has_permission('advance.manage') or public.has_permission('extract.read'))
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

drop policy if exists advance_payments_write on public.advance_payments;
create policy advance_payments_write on public.advance_payments
  for all to authenticated
  using (
    public.has_permission('advance.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('advance.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

drop policy if exists guarantees_select on public.guarantees;
create policy guarantees_select on public.guarantees
  for select to authenticated
  using (
    (public.has_permission('guarantee.manage') or public.has_permission('extract.read'))
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

drop policy if exists guarantees_write on public.guarantees;
create policy guarantees_write on public.guarantees
  for all to authenticated
  using (
    public.has_permission('guarantee.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('guarantee.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );
