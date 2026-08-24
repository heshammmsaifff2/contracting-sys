-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1 — البذور: الصلاحيات والأدوار والإعدادات الافتراضية
-- idempotent: إعادة التطبيق تُحدِّث الوصف ولا تُكرّر الصفوف.
-- ═══════════════════════════════════════════════════════════════════════

-- ── الصلاحيات ──────────────────────────────────────────────────────────
insert into public.permissions (key, description, module) values
  ('user.read',           'عرض بيانات الموظفين',                'identity'),
  ('user.create',         'إنشاء مستخدم جديد',                  'identity'),
  ('user.update',         'تعديل بيانات الموظفين',              'identity'),
  ('user.deactivate',     'تعطيل أو تفعيل موظف',                'identity'),
  ('user.assign_role',    'إسناد الأدوار للموظفين',             'identity'),
  ('user.read_salary',    'الاطّلاع على الرواتب',                'identity'),
  ('user.manage_salary',  'تعديل الرواتب',                      'identity'),
  ('role.read',           'عرض الأدوار والصلاحيات',             'identity'),
  ('role.manage',         'إنشاء وتعديل الأدوار وصلاحياتها',    'identity'),
  ('project.read_all',    'عرض كل المشاريع بلا استثناء',        'projects'),
  ('project.create',      'إنشاء مشروع',                        'projects'),
  ('project.update',      'تعديل بيانات مشروع',                 'projects'),
  ('project.delete',      'حذف مشروع',                          'projects'),
  ('project.assign',      'اعتماد الموظفين على المشاريع',       'projects'),
  ('settings.manage',     'تعديل إعدادات النظام',               'core')
on conflict (key) do update
  set description = excluded.description,
      module      = excluded.module;

-- ── الأدوار ────────────────────────────────────────────────────────────
insert into public.roles (key, name, description, is_system) values
  ('admin',           'مدير النظام',   'صلاحية كاملة على كل الوحدات',                true),
  ('program_manager', 'مدير البرنامج', 'إدارة المشاريع والموظفين ومتابعة سير العمل', true),
  ('project_manager', 'مدير مشروع',    'إدارة المشاريع المعتمد عليها',                true),
  ('engineer',        'مهندس',         'العمل على المشاريع المعتمد عليها',            true),
  ('employee',        'موظف',          'صلاحيات أساسية بلا إدارة',                    true)
on conflict (key) do update
  set name        = excluded.name,
      description = excluded.description;

-- ── ربط الأدوار بالصلاحيات ─────────────────────────────────────────────
-- مدير النظام: كل شيء
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

-- مدير البرنامج: كل ما يخص الموظفين والمشاريع والإعدادات، عدا الرواتب
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'user.read', 'user.create', 'user.update', 'user.deactivate', 'user.assign_role',
  'role.read',
  'project.read_all', 'project.create', 'project.update', 'project.assign',
  'settings.manage'
)
where r.key = 'program_manager'
on conflict do nothing;

-- مدير المشروع: يرى موظفيه ويعدّل مشاريعه المعتمدة فقط (لا project.read_all)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'user.read', 'project.update', 'project.assign'
)
where r.key = 'project_manager'
on conflict do nothing;

-- المهندس: يرى الموظفين فقط؛ مشاريعه تأتي من project_assignments
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('user.read')
where r.key = 'engineer'
on conflict do nothing;

-- الموظف: بلا صلاحيات إدارية — يرى ملفه ومشاريعه المعتمدة فقط.

-- ── الإعدادات الافتراضية ───────────────────────────────────────────────
-- كل رقم هنا قابل للتعديل من الواجهة ولا يُكتب في الكود.
insert into public.settings (key, value, description, category) values
  ('company_name',            '""'::jsonb,        'اسم الشركة كما يظهر في المستندات', 'general'),
  ('default_currency',        '"EGP"'::jsonb,     'عملة النظام الافتراضية',            'finance'),
  ('vat_rate',                '14'::jsonb,        'نسبة ضريبة القيمة المضافة ٪',       'finance'),
  ('fiscal_year_start_month', '1'::jsonb,         'شهر بداية السنة المالية (1-12)',    'finance')
on conflict (key) do update
  set description = excluded.description,
      category    = excluded.category;
