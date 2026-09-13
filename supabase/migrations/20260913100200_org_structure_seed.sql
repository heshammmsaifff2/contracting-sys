-- ═══════════════════════════════════════════════════════════════════════
-- الهيكل التنظيمي — البذرة
--
-- الأقسام الثلاثة القائمة تُصنَّف، وتُنشأ لكل دور وظيفةٌ تحمله، ثم يُسنَد
-- لكل موظف أقوى وظيفةٍ تطابق أدواره الحالية (أكثرها صلاحيات)، ويُعلَّم
-- دورها بأنه «من الوظيفة» فلا يُسحب منه ما أُسند يدويًّا.
-- ═══════════════════════════════════════════════════════════════════════

update public.departments
   set classification = 'administrative', sort_order = 1,
       description = 'الإدارة التنفيذية وإدارة النظام'
 where name = 'الإدارة العليا';
update public.departments
   set classification = 'administrative', sort_order = 2,
       description = 'التوظيف والرواتب وملفات الموظفين'
 where name = 'شؤون الموظفين';
update public.departments
   set classification = 'operational', sort_order = 1,
       description = 'تنفيذ المشاريع والإشراف الفني'
 where name = 'الإدارة الهندسية';

insert into public.jobs (department_id, name, role_id, description, sort_order)
select d.id, v.job_name, r.id, v.descr, v.ord
from (values
  ('الإدارة العليا',   'مدير النظام',          'admin',           'إدارة النظام والصلاحيات',            1),
  ('الإدارة العليا',   'مدير البرنامج',        'program_manager', 'متابعة المشاريع والاعتمادات العليا', 2),
  ('شؤون الموظفين',    'مدير شؤون الموظفين',   'hr_manager',      'إدارة شؤون الموظفين',                1),
  ('شؤون الموظفين',    'موظف شؤون الموظفين',   'hr_officer',      'تنفيذ معاملات الموظفين',             2),
  ('شؤون الموظفين',    'موظف إداري',           'employee',        'الأعمال الإدارية العامّة',           3),
  ('الإدارة الهندسية', 'مدير مشروع',           'project_manager', 'إدارة المشروع واعتماد مستخلصاته',    1),
  ('الإدارة الهندسية', 'مهندس',                'engineer',        'الإعداد والمراجعة الفنية',           2)
) as v(dept, job_name, role_key, descr, ord)
join public.departments d on d.name = v.dept
join public.roles r on r.key = v.role_key
on conflict (department_id, name) do nothing;

with ranked as (
  select ur.user_id, j.id as job_id,
         row_number() over (
           partition by ur.user_id
           order by (select count(*) from public.role_permissions rp where rp.role_id = ur.role_id) desc
         ) as rn
  from public.user_roles ur
  join public.jobs j on j.role_id = ur.role_id
)
update public.profiles p
   set job_id = r.job_id
  from ranked r
 where r.user_id = p.id and r.rn = 1 and p.job_id is null;

update public.user_roles ur
   set source = 'job'
  from public.profiles p
  join public.jobs j on j.id = p.job_id
 where ur.user_id = p.id and ur.role_id = j.role_id;
