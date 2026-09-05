-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٧ — الحوكمة: من يملك ماذا، ومتى يجوز أن يتغيّر
--
-- المراحل الستّ السابقة بنت محرّكًا يعمل. هذه تسأل أسئلة الحوكمة عنه:
--   ١) هل المعاملة **جاهزة** لتتقدّم أصلًا؟
--   ٢) حين يؤهَّل عشرة لمرحلة واحدة، من **يحسمها** فلا يعمل عشرة العمل نفسه؟
--   ٣) تعديل مسارٍ تسير عليه معاملات — هل يغيّر قواعدها في منتصف الطريق؟
--   ٤) هل «أُغلقت» يعني أن **الأصل الورقيّ** وصل الأرشيف؟
-- ═══════════════════════════════════════════════════════════════════════

-- ── ١) قواعد الجاهزية ──────────────────────────────────────────────────
-- شرط يُقاس **قبل** أن تتقدّم المعاملة، لا بعدها. ولغته هي لغة التفريع
-- المجمَّدة نفسها: من عرف كيف يكتب شرط وجهة يعرف كيف يكتب شرط جاهزية،
-- ولا لغة ثانية تُتعلَّم ولا مفسّر ثانٍ يُصان.
create table if not exists public.workflow_stage_requirements (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.workflow_stages (id) on delete cascade,
  kind text not null check (kind in ('condition', 'attachment')),
  condition jsonb,
  min_attachments smallint check (min_attachments is null or min_attachments > 0),
  -- ما يُقال للموظف حين لا تتحقّق. الرسالة جزء من القاعدة لا زينة:
  -- «غير جاهزة» بلا سبب تُرجع الموظف إلى المدير ليسأل.
  message text not null check (btrim(message) <> ''),

  /**
   * `advancing` = التقدّم وحده (forward · closure · final).
   * الإرجاع لا يُقاس بالجاهزية: أن تكون المعاملة ناقصة هو **سبب** ردّها،
   * فحبس الردّ حتى تكتمل يحبسها عند من لا يملك إكمالها.
   */
  applies_to text not null default 'advancing'
    check (applies_to in ('advancing', 'any_action')),

  sort_order smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint requirement_shape check (
    (kind = 'condition' and condition is not null and min_attachments is null)
    or (kind = 'attachment' and min_attachments is not null and condition is null)
  )
);

comment on table public.workflow_stage_requirements is
  'شروط جاهزية المرحلة — تُقاس قبل التقدّم، بلغة التفريع المجمَّدة نفسها.';

create index if not exists wsr_stage_idx
  on public.workflow_stage_requirements (stage_id, sort_order);

drop trigger if exists wsr_set_updated_at on public.workflow_stage_requirements;
create trigger wsr_set_updated_at
  before update on public.workflow_stage_requirements
  for each row execute function public.set_updated_at();

drop trigger if exists wsr_set_created_by on public.workflow_stage_requirements;
create trigger wsr_set_created_by
  before insert on public.workflow_stage_requirements
  for each row execute function public.set_created_by();

-- الشرط المعطوب يُرفض عند الحفظ لا عند أول معاملة تصطدم به
create or replace function public.guard_stage_requirement()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.kind = 'condition' then
    perform public.validate_workflow_condition(new.condition);
  end if;
  return new;
end;
$fn$;

drop trigger if exists wsr_guard on public.workflow_stage_requirements;
create trigger wsr_guard
  before insert or update on public.workflow_stage_requirements
  for each row execute function public.guard_stage_requirement();

-- ── ٢) حسم التكليف عند تعدّد المؤهَّلين ─────────────────────────────────
-- دور فيه عشرة يفتح عشرة تكليفات. تحت سياسة «أوّلهم» يكفي أن ينجز واحد —
-- لكن العشرة لا يعرفون ذلك إلا بعد أن يكون تسعة منهم قد قرأوا وبحثوا.
-- الحجز يجعل الأول **يعلن** أنه أخذها، فتخرج من صناديق الباقين.
alter table public.workflow_stages
  add column if not exists claim_policy text not null default 'none'
    check (claim_policy in ('none', 'exclusive'));

comment on column public.workflow_stages.claim_policy is
  'exclusive = أول من يحجز يقفلها على نفسه، وتخرج من صناديق بقيّة المؤهَّلين';

alter table public.transaction_stage_instances
  add column if not exists claim_policy text not null default 'none'
    check (claim_policy in ('none', 'exclusive'));

-- `on_hold` = مؤهَّل لكنها محجوزة عند غيره؛ تعود `in_progress` إن أُطلقت.
-- تمييزها عن `cancelled` ضروريّ: الملغى لا يعود، والمعلَّق ينتظر.
alter table public.transaction_assignments
  drop constraint if exists transaction_assignments_status_check;
alter table public.transaction_assignments
  add constraint transaction_assignments_status_check
  check (status in ('pending', 'in_progress', 'on_hold', 'done', 'cancelled'));

alter table public.transaction_assignments
  add column if not exists claimed_at timestamptz;

comment on column public.transaction_assignments.claimed_at is
  'لحظة الحجز تحت سياسة exclusive — تُميَّز عن received_at الذي هو إقرار استلام';

create index if not exists ta_claimed_idx
  on public.transaction_assignments (stage_instance_id)
  where claimed_at is not null;

-- ── ٣) إصدارات المسار ──────────────────────────────────────────────────
-- تعديل مسارٍ تسير عليه معاملات يغيّر قواعدها في منتصف الطريق: مرحلة
-- المعاملة تحمل لقطتها، لكن **التوجيه** يُقرأ من التعريف لحظة الإنجاز.
-- فالمعاملة التي بدأت بمسار قد تنتهي بمسار آخر لم يوافق عليه أحد.
--
-- الحلّ: الإصدار المنشور **لا يُعدَّل**. يُنسَخ مسودّةً، وتُعدَّل المسودّة،
-- ثم تُنشر فيُحال سابقها إلى التقاعد. ومعاملات السابق تبقى على صفوفه
-- كما هي — ولذلك لا تُحذف الإصدارات المتقاعدة أبدًا.
alter table public.workflow_definitions
  add column if not exists version smallint not null default 1
    check (version > 0),
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published', 'retired')),
  -- يجمع إصدارات المسار الواحد؛ الجذر يشير إلى نفسه
  add column if not exists lineage_id uuid,
  add column if not exists published_at timestamptz,
  add column if not exists retired_at timestamptz;

update public.workflow_definitions
   set lineage_id = coalesce(lineage_id, id),
       published_at = coalesce(published_at, created_at)
 where lineage_id is null;

/**
 * جذر السلالة يشير إلى نفسه.
 *
 * بلا مُشغّل يضطرّ كل من ينشئ مسارًا إلى معرفة `lineage_id` قبل أن يُخلَق
 * الصفّ — وهو ما لا يعرفه أحد. والمسودّة المنسوخة تمرّر سلالة أصلها صراحةً
 * فلا يمسّها.
 */
create or replace function public.set_definition_lineage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if new.lineage_id is null then
    new.lineage_id := new.id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists workflow_definitions_set_lineage on public.workflow_definitions;
create trigger workflow_definitions_set_lineage
  before insert on public.workflow_definitions
  for each row execute function public.set_definition_lineage();

-- `lineage_id` مفتاح تجميع لا مفتاح أجنبيّ عمدًا: أيّ سلوك حذفٍ يُختار له
-- خاطئ — `cascade` يمحو كل إصدارات المسار بحذف جذره، و`restrict` يستحيل
-- على صفٍّ يشير إلى نفسه. والحماية الحقيقية قائمة أصلًا:
-- `transactions_definition_id_fkey` بـ `on delete restrict`.

-- النوع لم يعد فريدًا وحده: لكل نوع إصدارات
alter table public.workflow_definitions
  drop constraint if exists workflow_definitions_transaction_type_key;

create unique index if not exists workflow_definitions_type_version_idx
  on public.workflow_definitions (transaction_type, version);

-- منشور واحد لكل نوع — القيد الذي يمنع مسارين حيَّين يتنازعان المعاملات
create unique index if not exists workflow_definitions_one_published_idx
  on public.workflow_definitions (transaction_type) where status = 'published';

create index if not exists workflow_definitions_lineage_idx
  on public.workflow_definitions (lineage_id, version);

comment on column public.workflow_definitions.status is
  'draft = يُحرَّر · published = تسير عليه المعاملات الجديدة · retired = يُقرأ ولا يُبدأ';
-- **الثابت الذي يحمي الكود القائم:** لا يكون نشطًا إلا المنشور.
-- كل استعلام سابق يرشّح بـ `is_active` وحده — والمجدوِل منها — يبقى صحيحًا
-- بلا تعديل، ولا تُلتقط مسودّةٌ على أنها المسار الحيّ.
alter table public.workflow_definitions
  drop constraint if exists workflow_definitions_active_only_published;
alter table public.workflow_definitions
  add constraint workflow_definitions_active_only_published
  check (not is_active or status = 'published');

comment on column public.workflow_definitions.is_active is
  'نشط = منشور ويقبل معاملات جديدة. تعليقه يوقف البدايات بلا إحالة للتقاعد.';

-- ── ٤) الأرشفة على مرحلتين ─────────────────────────────────────────────
-- «أُغلقت» لا تعني أن الورقة وصلت الأرشيف. والمرحلة الواحدة تُخفي الخلاف
-- المعروف: «سلّمتُه» في مقابل «لم يصلني». فمرحلتان بفاعلَين وختمَين:
-- صاحب المعاملة **يودِع**، وأمين الأرشيف **يقبل ويفهرس** أو **يردّ بسبب**.
alter table public.transactions
  add column if not exists archive_state text not null default 'none'
    check (archive_state in ('none', 'submitted', 'archived')),
  add column if not exists archive_submitted_at timestamptz,
  add column if not exists archive_submitted_by uuid
    references public.profiles (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid
    references public.profiles (id) on delete set null,
  -- رقم الملفّ أو الرفّ — بلا موضع، الأرشفة إقرارٌ لا أثر
  add column if not exists archive_location text not null default '';

comment on column public.transactions.archive_state is
  'none = لم يُودَع · submitted = أُودع الأصل وينتظر القبول · archived = قُبل وفُهرس';

create index if not exists transactions_archive_state_idx
  on public.transactions (archive_state)
  where archive_state <> 'archived';

-- ── الصلاحيات الجديدة ──────────────────────────────────────────────────
insert into public.permissions (key, description, module) values
  ('transaction.archive', 'قبول الأصل الورقيّ وفهرسته في الأرشيف', 'workflow'),
  ('workflow.publish',    'نشر إصدار مسار وإحالة سابقه للتقاعد',   'workflow')
on conflict (key) do update
  set description = excluded.description, module = excluded.module;

-- من يعرّف المسارات ينشرها، فلا ينكسر تشغيل قائم بانتظار منح جديد
insert into public.role_permissions (role_id, permission_id)
select rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
join public.permissions p_new on p_new.key = 'workflow.publish'
where p_old.key = 'workflow.manage'
on conflict do nothing;

-- والأرشفة عمل أمين الأرشيف، ويرثها صاحب التجاوز
insert into public.role_permissions (role_id, permission_id)
select rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
join public.permissions p_new on p_new.key = 'transaction.archive'
where p_old.key = 'transaction.override'
on conflict do nothing;
