-- Phase 8 — صلاحيات التقارير الشاملة
--
-- التقارير العابرة للوحدات تكشف صورة أوسع ممّا تكشفه شاشة واحدة: تكلفة كل
-- المشاريع، أرصدة كل الأطراف، القيود اليدوية. لذلك لها مفاتيحها الخاصة بدل
-- إعادة استخدام صلاحيات الشاشات — من يُدخل عهدة ليس بالضرورة من يرى تكلفة
-- الشركة كلها.
--
-- الفصل بين المفتاحين مقصود:
--   report.read      — تقارير تشغيلية: التأخّر، الأصول، المدد، تردّد الأقسام.
--   report.financial — تقارير مالية: تكلفة المشاريع، أرصدة الأطراف، القيود اليدوية.

insert into public.permissions (key, description, module) values
  ('report.read',      'عرض التقارير التشغيلية الشاملة', 'reports'),
  ('report.financial', 'عرض التقارير المالية الشاملة',   'reports'),
  ('demo_data.manage', 'تحميل وحذف بيانات النسخة الاختبارية', 'core')
on conflict (key) do update
  set description = excluded.description,
      module      = excluded.module;

-- مدير النظام يأخذ كل جديد تلقائيًا (نفس منطق البذرة الأولى)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'admin'
on conflict do nothing;

-- مدير البرنامج: يتابع الأداء والمال معًا — هذه وظيفته في المواصفات
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in ('report.read', 'report.financial')
where r.key = 'program_manager'
on conflict do nothing;

-- مدير المشروع: التقارير التشغيلية فقط، ومحتواها محدود بمشاريعه عبر RLS
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key = 'report.read'
where r.key = 'project_manager'
on conflict do nothing;

-- ── حراسة الوصول على مستوى الخادم ──────────────────────────────────────
-- العروض `security_invoker` ترث سياسات جداولها، لكنها لا تعرف بمفتاح التقارير.
-- الدالتان التاليتان تُستدعيان **داخل شرط `where` في العروض نفسها** لا من
-- الواجهة: عميل يقرأ العرض مباشرةً بلا الصلاحية يحصل على صفر صفوف، فالمنع
-- في الخادم لا في الشاشة. لهذا تسبق هذه الهجرةُ هجرةَ العروض.
create or replace function public.can_read_financial_reports()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user() and public.has_permission('report.financial');
$$;

comment on function public.can_read_financial_reports is
  'بوّابة التقارير المالية الشاملة — تُستدعى قبل قراءة تكلفة المشاريع وأرصدة الأطراف.';

create or replace function public.can_read_operational_reports()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user() and public.has_permission('report.read');
$$;

comment on function public.can_read_operational_reports is
  'بوّابة التقارير التشغيلية الشاملة (التأخّر، الأصول، المدد، تردّد الأقسام).';

revoke all on function public.can_read_financial_reports() from public, anon;
revoke all on function public.can_read_operational_reports() from public, anon;
grant execute on function public.can_read_financial_reports() to authenticated;
grant execute on function public.can_read_operational_reports() to authenticated;
