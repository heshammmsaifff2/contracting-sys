-- دورا شؤون الموظفين.
--
-- الأدوار الخمسة المبدئية كانت عامّة (مدير نظام، مدير برنامج، مدير مشروع،
-- مهندس، موظف) ولم يكن فيها من يخدم وحدة شؤون الموظفين تحديدًا، فكان
-- تشغيلها يستلزم إعطاء صلاحيات كاملة لمن يسجّل اليوميات.
--
-- الفصل بين الدورين مقصود، ومداره الاطّلاع على الأجور:
--   hr_officer — العمل اليومي: يسجّل اليوميات ويتابع العمالة، **بلا رواتب**.
--   hr_manager — القرار: يعتمد السلف ويعدّل الأجور ويرحّل كشف البنك.
--
-- كلاهما دور نظام (`is_system`) كالخمسة السابقة، وصلاحياتهما تبقى قابلة
-- للتعديل من شاشة الأدوار كأي دور آخر — هذه بداية لا قيد.

insert into public.roles (key, name, description, is_system) values
  ('hr_officer', 'موظف شؤون الموظفين',
   'تسجيل اليوميات ومتابعة العمالة وملفّاتها — بلا اطّلاع على الأجور', true),
  ('hr_manager', 'مدير شؤون الموظفين',
   'صلاحية كاملة على شؤون الموظفين: الأجور والسلف والتقييم وترحيل الرواتب', true)
on conflict (key) do update
  set name        = excluded.name,
      description = excluded.description;

-- ── موظف شؤون الموظفين ────────────────────────────────────────────────
-- يرى الموظفين ويسجّل اليوميات ويتابع حالة العمالة ويكتب التوصيات.
-- لا يعتمد سلفة ولا يرى راتبًا ولا يسجّل بعد وقت الإقفال.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'user.read',
  'worker.read', 'worker.manage', 'worker.recommend',
  'attendance.read', 'attendance.register',
  'loan.read'
)
where r.key = 'hr_officer'
on conflict do nothing;

-- ── مدير شؤون الموظفين ────────────────────────────────────────────────
-- كل ما سبق، ومعه ما يحمل قرارًا أو مالًا: الأجور، اعتماد السلف،
-- التقييم، التسجيل المتأخّر، وترحيل كشف البنك. ومعها التقارير التشغيلية
-- ليتابع أداء فريقه.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.key in (
  'user.read', 'user.create', 'user.update', 'user.deactivate',
  'user.read_salary', 'user.manage_salary',
  'worker.read', 'worker.manage', 'worker.recommend', 'worker.rate',
  'attendance.read', 'attendance.register', 'attendance.late_register',
  'loan.read', 'loan.approve',
  'payroll.import',
  'report.read'
)
where r.key = 'hr_manager'
on conflict do nothing;
