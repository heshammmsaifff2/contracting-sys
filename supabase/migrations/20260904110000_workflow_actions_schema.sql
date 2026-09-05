-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٢ — الإجراءات والتفريع الشرطي
--
-- المرجع: docs/decisions/0001-workflow-engine-v2.md — القرار ٢.
--
-- التسلسل كان خطًّا واحدًا عبر `default_next_stage_id`. الآن لكل مرحلة أزرار،
-- ولكل زرّ قائمة مسارات مرتَّبة بالأولوية لكلٍّ شرطه — فأول أولوية يتحقّق
-- شرطها تفوز، وكل مساراتها المتحقّقة تُفتح معًا (تفريع متوازٍ).
-- ═══════════════════════════════════════════════════════════════════════

-- ── سياق المعاملة: ما تُقاس عليه الشروط ────────────────────────────────
-- لقطة تُمرَّر عند بدء المعاملة من المستند المصدر (قيمة المستخلص، المقاول…)،
-- وتُحدَّث لاحقًا بالحقول المخصّصة. لقطةٌ لا استعلامٌ متعدّد الأشكال: المحرّك
-- لا يعرف جداول المستخلصات والعهد، ولا يُعاد حساب الشرط بأثر رجعي إن تغيّر
-- المستند بعد اتخاذ القرار.
alter table public.transactions
  add column if not exists context jsonb not null default '{}'::jsonb;

comment on column public.transactions.context is
  'لقطة حقول المستند المصدر والحقول المخصّصة — ما تُقاس عليه شروط التفريع.';

-- ── سياسات المرحلة الجديدة ─────────────────────────────────────────────
alter table public.workflow_stages
  add column if not exists join_policy text not null default 'none'
    check (join_policy in ('none', 'wait_all')),
  -- تحت سياسة «الكل»: ماذا لو اختار المشاركون إجراءات مختلفة؟
  add column if not exists conflict_policy text not null default 'backward_wins'
    check (conflict_policy in ('backward_wins', 'first_wins', 'last_wins'));

comment on column public.workflow_stages.join_policy is
  'wait_all = مرحلة التقاء: لا تبدأ قبل أن تهدأ كل الفروع الجارية';
comment on column public.workflow_stages.conflict_policy is
  'أي إجراء يقرّر الوجهة حين يختلف المشاركون [الافتراضي: الإرجاع يغلب]';

alter table public.transaction_stage_instances
  add column if not exists join_policy text not null default 'none'
    check (join_policy in ('none', 'wait_all')),
  add column if not exists conflict_policy text not null default 'backward_wins'
    check (conflict_policy in ('backward_wins', 'first_wins', 'last_wins')),
  -- مؤجَّلة بانتظار هدوء الفروع — تُميَّز عن `pending` بسبب غياب المؤهّلين
  add column if not exists is_deferred_join boolean not null default false,
  add column if not exists resolved_by_action_id uuid;

alter table public.transaction_assignments
  add column if not exists acted_action_id uuid;

-- ── الأزرار ────────────────────────────────────────────────────────────
create table if not exists public.workflow_actions (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.workflow_stages (id) on delete cascade,
  action_key text not null check (action_key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (btrim(label) <> ''),
  -- forward أخضر · backward أحمر · note رمادي · closure بنّي · final كحلي
  kind text not null
    check (kind in ('forward', 'backward', 'note', 'closure', 'final')),
  sort_order smallint not null default 1,
  requires_note boolean not null default false,
  -- يُفرَض فعليًا مع المرفقات في المرحلة ٠٣؛ يُحفَظ الآن ولا يمنع شيئًا
  requires_attachment boolean not null default false,
  -- يُفرَض مع توسعة التقييم في المرحلة ٠٨
  requires_evaluation boolean not null default false,
  -- الإرجاع قد يُمنح مدّة مستقلّة عن مدّة المرحلة الأصلية
  return_minutes integer check (return_minutes is null or return_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  unique (stage_id, action_key),
  constraint actions_return_minutes_backward_only
    check (return_minutes is null or kind = 'backward')
);

comment on table public.workflow_actions is
  'أزرار المرحلة. النوع يحدّد اللون والسلوك؛ note لا يحرّك المرحلة و final يغلق المسار.';

create index if not exists workflow_actions_stage_idx
  on public.workflow_actions (stage_id, sort_order);

drop trigger if exists workflow_actions_set_updated_at on public.workflow_actions;
create trigger workflow_actions_set_updated_at
  before update on public.workflow_actions
  for each row execute function public.set_updated_at();

drop trigger if exists workflow_actions_set_created_by on public.workflow_actions;
create trigger workflow_actions_set_created_by
  before insert on public.workflow_actions
  for each row execute function public.set_created_by();

-- ربط ما استُهلك من إجراءات بالتكليف والمرحلة
alter table public.transaction_assignments
  drop constraint if exists transaction_assignments_acted_action_fkey;
alter table public.transaction_assignments
  add constraint transaction_assignments_acted_action_fkey
  foreign key (acted_action_id)
  references public.workflow_actions (id) on delete set null;

alter table public.transaction_stage_instances
  drop constraint if exists tsi_resolved_by_action_fkey;
alter table public.transaction_stage_instances
  add constraint tsi_resolved_by_action_fkey
  foreign key (resolved_by_action_id)
  references public.workflow_actions (id) on delete set null;

create index if not exists ta_acted_action_idx
  on public.transaction_assignments (acted_action_id);
create index if not exists tsi_resolved_action_idx
  on public.transaction_stage_instances (resolved_by_action_id);

-- ── المسارات الشرطية ───────────────────────────────────────────────────
-- عدّة صفوف بنفس `priority` ⇒ تفريع متوازٍ: تُفتح كلّها معًا.
-- `condition = null` ⇒ المسار الافتراضي، يمرّ دائمًا.
create table if not exists public.workflow_action_routes (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.workflow_actions (id) on delete cascade,
  priority smallint not null default 10 check (priority > 0),
  condition jsonb,
  target_stage_id uuid not null
    references public.workflow_stages (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.workflow_action_routes is
  'وجهات الزرّ الواحد بشروطها. أول أولوية يتحقّق شرطها تفوز، وكل مساراتها المتحقّقة تُفتح معًا.';
comment on column public.workflow_action_routes.condition is
  'شرط بلغة مغلقة — راجع docs/decisions/0001-workflow-engine-v2.md. NULL = افتراضي.';

create index if not exists war_action_idx
  on public.workflow_action_routes (action_id, priority);
create index if not exists war_target_idx
  on public.workflow_action_routes (target_stage_id);

drop trigger if exists war_set_updated_at on public.workflow_action_routes;
create trigger war_set_updated_at
  before update on public.workflow_action_routes
  for each row execute function public.set_updated_at();

drop trigger if exists war_set_created_by on public.workflow_action_routes;
create trigger war_set_created_by
  before insert on public.workflow_action_routes
  for each row execute function public.set_created_by();

-- ── سجلّ الإجراءات: الخطّ الزمني ───────────────────────────────────────
-- يسجّل كل ضغطة زرّ بما فيها الملاحظات التي لا تحرّك المرحلة.
create table if not exists public.transaction_action_log (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null
    references public.transactions (id) on delete cascade,
  stage_instance_id uuid
    references public.transaction_stage_instances (id) on delete set null,
  assignment_id uuid
    references public.transaction_assignments (id) on delete set null,
  action_id uuid references public.workflow_actions (id) on delete set null,
  action_key text not null default '',
  action_label text not null default '',
  kind text not null default 'forward',
  notes text not null default '',
  acted_by uuid references public.profiles (id) on delete set null,
  acted_at timestamptz not null default now()
);

comment on table public.transaction_action_log is
  'الخطّ الزمني للمعاملة — سجلّ لا يُعدَّل لكل إجراء اتُّخذ عليها.';

create index if not exists tal_transaction_idx
  on public.transaction_action_log (transaction_id, acted_at);
create index if not exists tal_assignment_idx
  on public.transaction_action_log (assignment_id);
create index if not exists tal_actor_idx
  on public.transaction_action_log (acted_by);
