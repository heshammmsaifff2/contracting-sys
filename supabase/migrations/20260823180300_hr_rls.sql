-- ═══════════════════════════════════════════════════════════════════════
-- Phase 7 — صلاحيات شؤون الموظفين وسياسات RLS
-- الخدمة الذاتية [7] لا تحتاج صلاحية: العامل يرى ما يخصّه بهويّته وحدها،
-- فيعمل حسابه ولو كان بلا أي دور.
-- ═══════════════════════════════════════════════════════════════════════

insert into public.permissions (key, description, module) values
  ('worker.read',              'عرض ملفات العمالة',                  'hr'),
  ('worker.manage',            'إضافة وتعديل العمالة وحالتها',       'hr'),
  ('worker.rate',              'تقييم معدّل الإنتاج',                'hr'),
  ('worker.recommend',         'كتابة توصيات وملاحظات عن العامل',    'hr'),
  ('attendance.read',          'عرض اليوميات',                       'hr'),
  ('attendance.register',      'تسجيل اليوميات',                     'hr'),
  ('attendance.late_register', 'تسجيل يومية بعد الموعد المحدّد',     'hr'),
  ('loan.read',                'عرض طلبات السلف',                    'hr'),
  ('loan.approve',             'البتّ في طلبات السلف',               'hr'),
  ('payroll.import',           'ترحيل كشف البنك للرواتب',            'hr')
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
  'worker.read', 'worker.manage', 'worker.rate', 'worker.recommend',
  'attendance.read', 'attendance.register', 'attendance.late_register',
  'loan.read', 'loan.approve', 'payroll.import'
)
where r.key = 'program_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'worker.read', 'worker.manage', 'attendance.read', 'attendance.register',
  'loan.read'
)
where r.key = 'project_manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'worker.read', 'attendance.read', 'attendance.register'
)
where r.key = 'engineer'
on conflict do nothing;

-- ── تفعيل RLS ──────────────────────────────────────────────────────────
alter table public.employees              enable row level security;
alter table public.labor_pool             enable row level security;
alter table public.attendance             enable row level security;
alter table public.loans                  enable row level security;
alter table public.salary_changes         enable row level security;
alter table public.worker_recommendations enable row level security;
alter table public.production_ratings     enable row level security;

revoke all on public.employees, public.labor_pool, public.attendance,
  public.loans, public.salary_changes, public.worker_recommendations,
  public.production_ratings
  from anon;

revoke all on public.project_labor_days, public.project_labor_cost from anon;

-- ── ملفات العمالة — والعامل يرى ملفه ──────────────────────────────────
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select to authenticated
  using (id = (select auth.uid()) or public.has_permission('worker.read'));

drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees
  for all to authenticated
  using (public.has_permission('worker.manage'))
  with check (public.has_permission('worker.manage'));

drop policy if exists labor_pool_select on public.labor_pool;
create policy labor_pool_select on public.labor_pool
  for select to authenticated
  using (worker_id = (select auth.uid()) or public.has_permission('worker.read'));

-- الكتابة عبر set_worker_status وحدها لتبقى الحالة المفتوحة واحدة
drop policy if exists labor_pool_write on public.labor_pool;
create policy labor_pool_write on public.labor_pool
  for all to authenticated
  using (public.has_permission('worker.manage'))
  with check (public.has_permission('worker.manage'));

-- ── اليوميات — العامل يرى يومياته، والمشروع يحكم الباقي ───────────────
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select to authenticated
  using (
    worker_id = (select auth.uid())
    or (
      public.has_permission('attendance.read')
      and (public.has_permission('project.read_all')
           or public.is_assigned_to_project(project_id))
    )
  );

drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance
  for all to authenticated
  using (
    public.has_permission('attendance.register')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  )
  with check (
    public.has_permission('attendance.register')
    and (public.has_permission('project.read_all')
         or public.is_assigned_to_project(project_id))
  );

-- ── السلف — الخدمة الذاتية بالهويّة لا بالصلاحية [7] ──────────────────
drop policy if exists loans_select on public.loans;
create policy loans_select on public.loans
  for select to authenticated
  using (worker_id = (select auth.uid()) or public.has_permission('loan.read'));

-- العامل يطلب لنفسه فقط، وبحالة «مطلوبة» لا معتمدة
drop policy if exists loans_insert_self on public.loans;
create policy loans_insert_self on public.loans
  for insert to authenticated
  with check (
    (worker_id = (select auth.uid()) and status = 'requested')
    or public.has_permission('loan.approve')
  );

-- تعديل الطلب ما دام لم يُبتّ فيه، أو بصلاحية البتّ
drop policy if exists loans_update on public.loans;
create policy loans_update on public.loans
  for update to authenticated
  using (
    (worker_id = (select auth.uid()) and status = 'requested')
    or public.has_permission('loan.approve')
  )
  with check (
    (worker_id = (select auth.uid()) and status = 'requested')
    or public.has_permission('loan.approve')
  );

drop policy if exists loans_delete on public.loans;
create policy loans_delete on public.loans
  for delete to authenticated
  using (worker_id = (select auth.uid()) and status = 'requested');

-- ── تعديلات الأجر — سجل حسّاس كالأجر نفسه ─────────────────────────────
drop policy if exists salary_changes_select on public.salary_changes;
create policy salary_changes_select on public.salary_changes
  for select to authenticated
  using (
    worker_id = (select auth.uid())
    or public.has_permission('user.read_salary')
  );

-- لا سياسة كتابة: الأجر يتغيّر عبر change_worker_salary وحدها فيبقى له أثر.

-- ── التوصيات — شؤون الموظفين وحدهم، ولا يراها العامل ──────────────────
drop policy if exists worker_recommendations_select on public.worker_recommendations;
create policy worker_recommendations_select on public.worker_recommendations
  for select to authenticated
  using (public.has_permission('worker.recommend'));

drop policy if exists worker_recommendations_write on public.worker_recommendations;
create policy worker_recommendations_write on public.worker_recommendations
  for all to authenticated
  using (public.has_permission('worker.recommend'))
  with check (public.has_permission('worker.recommend'));

-- ── تقييم الإنتاج — العامل يرى درجته ──────────────────────────────────
drop policy if exists production_ratings_select on public.production_ratings;
create policy production_ratings_select on public.production_ratings
  for select to authenticated
  using (
    worker_id = (select auth.uid())
    or public.has_permission('worker.rate')
    or public.has_permission('worker.read')
  );

-- الكتابة عبر rate_worker_production وحدها لتُحسب التكلفة والدرجة آليًا
