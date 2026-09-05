-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٥ — أدوات التشغيل اليومي
--
-- ما يحتاجه من يدير المعاملات كل يوم: تحويل لزميل، تنبيه وتحذير رسمي،
-- مدّ مهلة، إشارة إلى موظف، وإغلاق إجباري.
--
-- ومعها **تفكيك `transaction.override`**: كان مفتاحًا واحدًا يفتح كل شيء،
-- فصار لكل فعل صلاحيته المسمّاة — والتجاوز يبقى مظلّةً فوقها للتوافق.
-- ═══════════════════════════════════════════════════════════════════════

-- ── عدّاد التحذيرات على التكليف ────────────────────────────────────────
-- التحذير الرسمي يخصم من الدرجة، فلا بدّ أن يُحصى على التكليف نفسه.
alter table public.transaction_assignments
  add column if not exists warnings_count integer not null default 0
    check (warnings_count >= 0),
  -- ما أُضيف بمدّ المهلة — يُفصَل عن المدة الأصلية ليظهر في المراجعة
  add column if not exists extended_minutes integer not null default 0
    check (extended_minutes >= 0);

comment on column public.transaction_assignments.warnings_count is
  'عدد التحذيرات الرسمية — يُخصَم أثرها من الدرجة [إعداد warning_penalty_points]';
comment on column public.transaction_assignments.extended_minutes is
  'ما أُضيف بمدّ المهلة، منفصلًا عن المدة الأصلية';

-- ── الإغلاق الإجباري ───────────────────────────────────────────────────
alter table public.transactions
  add column if not exists force_closed boolean not null default false,
  add column if not exists force_close_reason text not null default '';

comment on column public.transactions.force_closed is
  'أُغلقت إداريًّا لا بإنجاز مراحلها — تُميَّز في التقارير ولا تُحتسب إنجازًا';

-- ── التنبيهات والتحذيرات ───────────────────────────────────────────────
create table if not exists public.transaction_alerts (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null
    references public.transactions (id) on delete cascade,
  assignment_id uuid not null
    references public.transaction_assignments (id) on delete cascade,
  -- تنبيه = تذكير لا أثر له · تحذير = رسمي يُخصَم من الدرجة
  kind text not null check (kind in ('reminder', 'warning')),
  reason text not null default '',
  sent_by uuid references public.profiles (id) on delete set null,
  sent_at timestamptz not null default now()
);

comment on table public.transaction_alerts is
  'ما أُرسل على تكليف متأخّر. التحذير رسمي يُخصَم من الدرجة، والتنبيه تذكير.';

create index if not exists alerts_assignment_idx
  on public.transaction_alerts (assignment_id, sent_at desc);
create index if not exists alerts_transaction_idx
  on public.transaction_alerts (transaction_id, sent_at desc);
create index if not exists alerts_sender_idx
  on public.transaction_alerts (sent_by);

-- ── الإشارة إلى موظف ───────────────────────────────────────────────────
create table if not exists public.transaction_mentions (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null
    references public.transactions (id) on delete cascade,
  action_log_id uuid
    references public.transaction_action_log (id) on delete cascade,
  mentioned_user_id uuid not null
    references public.profiles (id) on delete cascade,
  mentioned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (action_log_id, mentioned_user_id)
);

comment on table public.transaction_mentions is
  'من أُشير إليه في ملاحظة — يصله إشعار ولو لم يكن مكلَّفًا بالمرحلة.';

create index if not exists mentions_user_idx
  on public.transaction_mentions (mentioned_user_id, created_at desc);
create index if not exists mentions_transaction_idx
  on public.transaction_mentions (transaction_id);

-- ── إعدادات أثر التحذير ────────────────────────────────────────────────
insert into public.settings (key, value, description, category) values
  ('warning_penalty_points', '10'::jsonb,
   'ما يُخصَم من درجة التكليف عن كل تحذير رسمي', 'workflow'),
  ('warning_threshold_percent', '75'::jsonb,
   'النسبة التي يُقترح عندها إرسال تحذير — للعرض لا للفرض', 'workflow')
on conflict (key) do update set description = excluded.description;

-- ── الصلاحيات المسمّاة ─────────────────────────────────────────────────
-- `transaction.override` كان مفتاحًا واحدًا يفتح كل شيء. هذه تفكيكه.
insert into public.permissions (key, description, module) values
  ('transaction.transfer',    'تحويل المعاملة لزميل في القسم نفسه', 'workflow'),
  ('transaction.alert',       'إرسال تنبيه أو تحذير رسمي',          'workflow'),
  ('transaction.extend',      'مدّ مهلة مرحلة جارية',                'workflow'),
  ('transaction.force_close', 'الإغلاق الإجباري للمعاملة',           'workflow')
on conflict (key) do update
  set description = excluded.description, module = excluded.module;

-- من كان يملك التجاوز يرثها كلّها، فلا ينكسر تشغيل قائم
insert into public.role_permissions (role_id, permission_id)
select rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
join public.permissions p_new on p_new.key in (
  'transaction.transfer', 'transaction.alert',
  'transaction.extend', 'transaction.force_close'
)
where p_old.key = 'transaction.override'
on conflict do nothing;

-- والتحويل حقّ المكلَّف نفسه لا المدير وحده: يُمنح لكل من ينشئ معاملات
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where p.key = 'transaction.transfer'
  and r.key in ('employee', 'engineer', 'project_manager', 'site_engineer')
on conflict do nothing;
