-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٨ — توسيع التقييم
--
-- التقييم اليوم قائمةٌ مسطّحة من البنود وأوزانها. أربع فجوات:
--   ١) البنود تكبر فتصير قائمةً لا تُقرأ — تحتاج **فئات** تُجمَع فيها.
--   ٢) «خصم درجتين لكل تحذير» يُطبَّق بيد إنسان في جدول — يحتاج **قواعد**.
--   ٣) القاعدة الجديدة تُطبَّق فيُفاجَأ الجميع — تحتاج **مُختبِرًا تجريبيًّا**.
--   ٤) درجة الشهر الماضي تتغيّر اليوم لأن مدّةً عُدِّلت — تحتاج **لقطة**.
-- وفوقها **سجلّ تدقيق**: الدرجة قرار في ملفّ موظف، ولا قرار بلا أثر.
-- ═══════════════════════════════════════════════════════════════════════

-- ── ١) فئات التقييم ────────────────────────────────────────────────────
-- الفئة تجمع بنودًا متقاربة (الإنجاز · السلوك · الالتزام)، فيُقرأ التقرير
-- بثلاثة أرقام لا بخمسة عشر. ولا تحمل وزنًا: الوزن يبقى على البند حتى
-- لا يصير للدرجة الواحدة مصدران يتنازعان.
create table if not exists public.evaluation_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null check (btrim(name) <> ''),
  description text not null default '',
  sort_order smallint not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.evaluation_categories is
  'فئة تجمع بنود تقييم متقاربة. لا تحمل وزنًا — الوزن على البند وحده.';

drop trigger if exists evaluation_categories_set_updated_at
  on public.evaluation_categories;
create trigger evaluation_categories_set_updated_at
  before update on public.evaluation_categories
  for each row execute function public.set_updated_at();

alter table public.evaluation_criteria
  add column if not exists category_id uuid
    references public.evaluation_categories (id) on delete set null,
  add column if not exists sort_order smallint not null default 1,
  add column if not exists description text not null default '';

create index if not exists evaluation_criteria_category_idx
  on public.evaluation_criteria (category_id, sort_order);

insert into public.evaluation_categories (key, name, description, sort_order) values
  ('delivery', 'الإنجاز',  'ما يُقاس آليًّا من زمن العمل داخل الدوام', 1),
  ('conduct',  'السلوك',   'ما يُقيّمه المشرفون مباشرةً',             2),
  ('skill',    'الكفاءة',  'الأداء الفنّي في تخصّص الموظف',            3)
on conflict (key) do update
  set name = excluded.name, description = excluded.description;

-- البنود القائمة تُنسَب لفئاتها بلا تغيير أوزانها
update public.evaluation_criteria c
   set category_id = cat.id
  from public.evaluation_categories cat
 where c.category_id is null
   and cat.key = case c.key
     when 'completion' then 'delivery'
     when 'behavior'   then 'conduct'
     when 'discipline' then 'conduct'
     when 'efficiency' then 'skill'
     else null
   end;

-- ── ٢) القواعد الإدارية ────────────────────────────────────────────────
/**
 * قاعدة تُضيف أو تخصم نقاطًا بشرطٍ يُقاس على **مقاييس الموظف في الفترة**.
 *
 * لغتها لغة التفريع المجمَّدة نفسها — لا لغة ثالثة تُتعلَّم ولا مفسّر ثالث
 * يُصان. وحقولها هي ما يُرجعه `employee_period_metrics`.
 */
create table if not exists public.evaluation_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null check (btrim(name) <> ''),
  -- ما يُقال للموظف في كشفه: «خُصمت نقطتان لتحذيرين» لا «قاعدة رقم ٣»
  reason_template text not null default '',
  condition jsonb not null,
  effect text not null check (effect in ('bonus', 'penalty')),
  points numeric(6, 2) not null check (points > 0),
  /**
   * `per_unit` يضرب النقاط في حقلٍ من المقاييس — «نقطتان لكل تحذير».
   * فارغًا: النقاط ثابتة تُطبَّق مرّة.
   */
  per_unit_field text,
  -- سقفٌ للأثر مهما بلغ العدّاد: قاعدةٌ بلا سقف تمحو الدرجة كلّها
  max_points numeric(6, 2) check (max_points is null or max_points > 0),
  employee_type text
    check (employee_type is null
           or employee_type in ('admin', 'engineer', 'supervisor')),
  is_active boolean not null default true,
  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint rules_unit_needs_cap
    check (per_unit_field is null or max_points is not null)
);

comment on table public.evaluation_rules is
  'قواعد إدارية تعدّل الدرجة بشرط محسوب على مقاييس الموظف في الفترة.';
comment on column public.evaluation_rules.per_unit_field is
  'حقل من المقاييس تُضرَب فيه النقاط — «نقطتان لكل تحذير». يلزمه سقف.';

create index if not exists evaluation_rules_active_idx
  on public.evaluation_rules (sort_order) where is_active;

drop trigger if exists evaluation_rules_set_updated_at on public.evaluation_rules;
create trigger evaluation_rules_set_updated_at
  before update on public.evaluation_rules
  for each row execute function public.set_updated_at();

drop trigger if exists evaluation_rules_set_created_by on public.evaluation_rules;
create trigger evaluation_rules_set_created_by
  before insert on public.evaluation_rules
  for each row execute function public.set_created_by();

-- الشرط المعطوب يُرفض عند الحفظ لا عند أول تطبيق
create or replace function public.guard_evaluation_rule()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  perform public.validate_workflow_condition(new.condition);
  return new;
end;
$fn$;

drop trigger if exists evaluation_rules_guard on public.evaluation_rules;
create trigger evaluation_rules_guard
  before insert or update on public.evaluation_rules
  for each row execute function public.guard_evaluation_rule();

/**
 * أثر قاعدة على موظف في فترة.
 *
 * صفٌّ لا تعديلٌ على الدرجة: الدرجة تبقى ما حسبه المحرّك، والتعديل يُقرأ
 * إلى جانبها بسببه. الجمع بينهما يُخفي أيّهما غيّر الترتيب.
 */
create table if not exists public.evaluation_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  rule_id uuid references public.evaluation_rules (id) on delete set null,
  rule_key text not null default '',
  effect text not null check (effect in ('bonus', 'penalty')),
  points numeric(6, 2) not null check (points >= 0),
  reason text not null default '',
  -- ما قِيس عليه القرار وقتها — فلا يُعاد تفسير القرار بمقاييس اليوم
  metrics jsonb not null default '{}'::jsonb,
  applied_by uuid references public.profiles (id) on delete set null,
  applied_at timestamptz not null default now(),
  -- القاعدة الواحدة لا تُطبَّق مرّتين على الفترة نفسها
  unique (user_id, period, rule_id)
);

comment on table public.evaluation_adjustments is
  'أثر القواعد الإدارية على الدرجة — صفٌّ بسببه ومقاييسه، لا تعديل صامت.';

create index if not exists evaluation_adjustments_period_idx
  on public.evaluation_adjustments (period, user_id);

-- ── ٣) اللقطة الشهرية ──────────────────────────────────────────────────
/**
 * الدرجة تُحسَب من بيانات حيّة: مدّة تُعدَّل اليوم تغيّر درجة الشهر الماضي،
 * ومعاملة تُفتح من جديد تغيّر الترتيب بعد أن أُعلن. اللقطة تُثبّت الفترة
 * كما أُقرّت، والحيّ يبقى للفترة الجارية.
 */
create table if not exists public.evaluation_snapshots (
  id uuid primary key default gen_random_uuid(),
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  employee_type text not null default '',
  base_score numeric(6, 2),
  adjustment_points numeric(6, 2) not null default 0,
  final_score numeric(6, 2),
  completed_steps integer not null default 0,
  rank_in_period integer,
  -- تفصيل البنود والفئات وقت الأخذ — التقرير لا يُعاد حسابه ليُقرأ
  breakdown jsonb not null default '{}'::jsonb,
  taken_by uuid references public.profiles (id) on delete set null,
  taken_at timestamptz not null default now(),
  unique (period, user_id)
);

comment on table public.evaluation_snapshots is
  'تجميد فترة تقييم كما أُقرّت — فلا يعيد تعديلُ مدّةٍ كتابةَ ترتيب مُعلَن.';

create index if not exists evaluation_snapshots_period_idx
  on public.evaluation_snapshots (period, rank_in_period);

-- ── ٤) سجلّ التدقيق ────────────────────────────────────────────────────
/**
 * الدرجة قرار في ملفّ موظف. سجلّ **لا يُعدَّل ولا يُحذف**: لا سياسة تسمح
 * بغير القراءة والإدراج، والإدراج من المُشغّلات وحدها.
 */
create table if not exists public.evaluation_audit_log (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  user_id uuid references public.profiles (id) on delete set null,
  period text,
  before_data jsonb,
  after_data jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  acted_at timestamptz not null default now()
);

comment on table public.evaluation_audit_log is
  'أثر كل تغيير على التقييم: ماذا ولمن ومن ومتى. يُقرأ ولا يُعدَّل.';

create index if not exists evaluation_audit_period_idx
  on public.evaluation_audit_log (period, acted_at desc);
create index if not exists evaluation_audit_user_idx
  on public.evaluation_audit_log (user_id, acted_at desc);
create index if not exists evaluation_audit_entity_idx
  on public.evaluation_audit_log (entity, entity_id);

-- ── الصلاحيات الجديدة ──────────────────────────────────────────────────
insert into public.permissions (key, description, module) values
  ('evaluation.rules',    'تعريف القواعد الإدارية للتقييم وتطبيقها', 'workflow'),
  ('evaluation.snapshot', 'أخذ لقطة شهرية للتقييم وتجميدها',          'workflow'),
  ('evaluation.audit',    'قراءة سجلّ تدقيق التقييم',                 'workflow')
on conflict (key) do update
  set description = excluded.description, module = excluded.module;

-- من يقيّم اليوم يرث الثلاث، فلا ينكسر تشغيل قائم بانتظار منح جديد
insert into public.role_permissions (role_id, permission_id)
select rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
join public.permissions p_new on p_new.key in (
  'evaluation.rules', 'evaluation.snapshot', 'evaluation.audit'
)
where p_old.key = 'evaluation.manage'
on conflict do nothing;
