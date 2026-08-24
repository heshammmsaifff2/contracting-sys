-- ═══════════════════════════════════════════════════════════════════════
-- Phase 5 — صلاحيات المخازن وسياسات RLS
-- القاعدة نفسها في كل الوحدات: صلاحية دقيقة + مشروع معتمد.
-- ═══════════════════════════════════════════════════════════════════════

insert into public.permissions (key, description, module) values
  ('warehouse.read',       'عرض بيانات المخازن والعهد والاستهلاك', 'warehouse'),
  ('warehouse.notify',     'تلقّي إشعارات حركة المخازن',            'warehouse'),
  ('warehouse.report',     'تقارير المقارنة والهدر',                'warehouse'),
  ('facility.manage',      'إدارة المنشآت وأوزانها',                'warehouse'),
  ('mandoub_stock.issue',  'تسليم واسترداد عهدة المندوب',           'warehouse'),
  ('consumption.record',   'تنزيل الكميات على المنشآت',             'warehouse'),
  ('equipment.read',       'عرض المعدّات والشاغر منها',             'warehouse'),
  ('equipment.manage',     'إضافة وتعديل المعدّات وصيانتها',        'warehouse'),
  ('equipment.move',       'نقل المعدّات وإخلاؤها',                 'warehouse'),
  ('surplus.manage',       'تسجيل المواد الزائدة عن الحاجة',        'warehouse')
on conflict (key) do update
  set description = excluded.description, module = excluded.module;

-- admin يأخذ كل شيء
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'warehouse.read', 'warehouse.notify', 'warehouse.report', 'facility.manage',
  'mandoub_stock.issue', 'consumption.record', 'equipment.read',
  'equipment.manage', 'equipment.move', 'surplus.manage'
)
where r.key = 'program_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'warehouse.read', 'warehouse.notify', 'warehouse.report', 'facility.manage',
  'mandoub_stock.issue', 'consumption.record', 'equipment.read',
  'equipment.move', 'surplus.manage'
)
where r.key = 'project_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'warehouse.read', 'consumption.record', 'equipment.read', 'surplus.manage'
)
where r.key = 'engineer'
on conflict do nothing;

-- ── تفعيل RLS ──────────────────────────────────────────────────────────
alter table public.facilities           enable row level security;
alter table public.mandoub_stock        enable row level security;
alter table public.stock_movements      enable row level security;
alter table public.facility_consumption enable row level security;
alter table public.surplus_materials    enable row level security;
alter table public.equipment            enable row level security;
alter table public.equipment_maintenance enable row level security;
alter table public.equipment_movements  enable row level security;
alter table public.idle_equipment       enable row level security;

revoke all on public.facilities, public.mandoub_stock, public.stock_movements,
  public.facility_consumption, public.surplus_materials, public.equipment,
  public.equipment_maintenance, public.equipment_movements, public.idle_equipment
  from anon;

-- ── المنشآت — مقيّدة بالمشروع ──────────────────────────────────────────
drop policy if exists facilities_select on public.facilities;
create policy facilities_select on public.facilities
  for select to authenticated
  using (
    public.has_permission('warehouse.read')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

drop policy if exists facilities_write on public.facilities;
create policy facilities_write on public.facilities
  for all to authenticated
  using (
    public.has_permission('facility.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('facility.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

-- ── عهدة المندوب — يراها صاحبها دائمًا، وغيره بصلاحية ومشروع معتمد ────
drop policy if exists mandoub_stock_select on public.mandoub_stock;
create policy mandoub_stock_select on public.mandoub_stock
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.has_permission('warehouse.read')
      and (public.has_permission('project.read_all')
           or public.is_assigned_to_project(project_id))
    )
  );

-- لا سياسة كتابة: الرصيد لا يتغيّر إلا عبر دوال الخادم
-- (issue_stock_to_mandoub / return_mandoub_stock / record_facility_consumption).

-- ── سجل الحركة — قراءة فقط ─────────────────────────────────────────────
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select on public.stock_movements
  for select to authenticated
  using (
    mandoub_id = (select auth.uid())
    or (
      public.has_permission('warehouse.read')
      and (public.has_permission('project.read_all')
           or public.is_assigned_to_project(project_id))
    )
  );

-- ── الاستهلاك — القراءة بالمشروع، والكتابة عبر الدالة وحدها ───────────
drop policy if exists facility_consumption_select on public.facility_consumption;
create policy facility_consumption_select on public.facility_consumption
  for select to authenticated
  using (
    supervisor_id = (select auth.uid())
    or mandoub_id = (select auth.uid())
    or (
      public.has_permission('warehouse.read')
      and (public.has_permission('project.read_all')
           or public.is_assigned_to_project(project_id))
    )
  );

-- تعديل الصور أو الملاحظة يبقى لصاحب التنزيل ضمن صلاحيته
drop policy if exists facility_consumption_update on public.facility_consumption;
create policy facility_consumption_update on public.facility_consumption
  for update to authenticated
  using (
    public.has_permission('consumption.record')
    and supervisor_id = (select auth.uid())
  )
  with check (
    public.has_permission('consumption.record')
    and supervisor_id = (select auth.uid())
  );

-- ── المواد الزائدة — يراها الجميع ليُستفاد منها، وتُكتب بصلاحية ───────
drop policy if exists surplus_materials_select on public.surplus_materials;
create policy surplus_materials_select on public.surplus_materials
  for select to authenticated
  using (public.has_permission('warehouse.read'));

drop policy if exists surplus_materials_write on public.surplus_materials;
create policy surplus_materials_write on public.surplus_materials
  for all to authenticated
  using (
    public.has_permission('surplus.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('surplus.manage')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

-- ── المعدّات — أصل الشركة لا أصل المشروع، فتُرى بالصلاحية ─────────────
drop policy if exists equipment_select on public.equipment;
create policy equipment_select on public.equipment
  for select to authenticated using (public.has_permission('equipment.read'));

drop policy if exists equipment_write on public.equipment;
create policy equipment_write on public.equipment
  for all to authenticated
  using (public.has_permission('equipment.manage'))
  with check (public.has_permission('equipment.manage'));

drop policy if exists equipment_maintenance_select on public.equipment_maintenance;
create policy equipment_maintenance_select on public.equipment_maintenance
  for select to authenticated using (public.has_permission('equipment.read'));

drop policy if exists equipment_maintenance_write on public.equipment_maintenance;
create policy equipment_maintenance_write on public.equipment_maintenance
  for all to authenticated
  using (public.has_permission('equipment.manage'))
  with check (public.has_permission('equipment.manage'));

drop policy if exists equipment_movements_select on public.equipment_movements;
create policy equipment_movements_select on public.equipment_movements
  for select to authenticated using (public.has_permission('equipment.read'));

-- الحركة تُنشأ عبر move_equipment/release_equipment، والتصحيح اليدوي بصلاحية النقل
drop policy if exists equipment_movements_write on public.equipment_movements;
create policy equipment_movements_write on public.equipment_movements
  for all to authenticated
  using (public.has_permission('equipment.move'))
  with check (public.has_permission('equipment.move'));

drop policy if exists idle_equipment_select on public.idle_equipment;
create policy idle_equipment_select on public.idle_equipment
  for select to authenticated using (public.has_permission('equipment.read'));

drop policy if exists idle_equipment_write on public.idle_equipment;
create policy idle_equipment_write on public.idle_equipment
  for all to authenticated
  using (public.has_permission('equipment.move'))
  with check (public.has_permission('equipment.move'));

-- ── العروض: security_invoker يكفي لمنع anon، والسحب الصريح توكيد ───────
revoke all on public.mandoub_stock_view, public.facility_consumption_view,
  public.facility_waste_report, public.project_consumption_summary,
  public.supervisor_consumption_summary
  from anon;
