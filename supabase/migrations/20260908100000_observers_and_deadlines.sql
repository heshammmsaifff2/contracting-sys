-- ═══════════════════════════════════════════════════════════════════════
-- المراقب · والموعد النهائي في التقويم
--
-- جوابان من صاحب الشركة استلزما بناءً، لا إعدادًا:
--
--  ٧) «فيه اللي بيشوف كل حاجة، والشركة تحدّده وهي بتبني المسار.»
--     المشارك اليوم يُكلَّف عملًا لِيَرى. والمراقب يرى ولا يُكلَّف —
--     فيلزم تمييزٌ بينهما.
--
--  ٦) «مسار ١ السبت ١٢ · مسار ٢ الثلاثاء ١٢» — مواعيد ثابتة في التقويم،
--     لا مُدَدٌ تبدأ من وصول المعاملة. والمدّة تقول «أمامك أربع ساعات»،
--     والموعد يقول «قبل الثلاثاء ظهرًا» — ولا يُغني أحدهما عن الآخر.
-- ═══════════════════════════════════════════════════════════════════════

-- ── ١) المراقب ─────────────────────────────────────────────────────────
alter table public.workflow_stage_participants
  add column if not exists is_observer boolean not null default false;

comment on column public.workflow_stage_participants.is_observer is
  'يرى المعاملة كلها ولا يُكلَّف بعمل ولا يمنع إغلاق المرحلة.';

-- المراقب لا يُنتظَر، فوصفه بالاختياريّ لغوٌ يُربك من يقرأ اللوحة
alter table public.workflow_stage_participants
  drop constraint if exists participant_observer_shape;
alter table public.workflow_stage_participants
  add constraint participant_observer_shape check (
    is_observer = false or is_optional = false
  );

-- ── ٢) الموعد النهائي ──────────────────────────────────────────────────
alter table public.workflow_stages
  add column if not exists deadline_spec jsonb,
  add column if not exists deadline_action text not null default 'notify';

alter table public.workflow_stages
  drop constraint if exists stages_deadline_action_check;
alter table public.workflow_stages
  add constraint stages_deadline_action_check
  check (deadline_action in ('notify', 'escalate'));

/**
 * الشكل: `{"time":"12:00","days":[6,2]}` — أيام الأسبوع بترقيم Postgres
 * (٠ الأحد … ٦ السبت). فـ «مسار ١ السبت ١٢ ومسار ٢ الثلاثاء ١٢» موعدان
 * في وصفٍ واحد: `days:[6,2]`. والمعاملة تلحق أقربهما بعد دخولها المرحلة.
 */
alter table public.workflow_stages
  drop constraint if exists stages_deadline_spec_shape;
alter table public.workflow_stages
  add constraint stages_deadline_spec_shape check (
    deadline_spec is null or (
      jsonb_typeof(deadline_spec) = 'object'
      and deadline_spec ? 'time'
      and jsonb_typeof(deadline_spec -> 'days') = 'array'
      and jsonb_array_length(deadline_spec -> 'days') between 1 and 7
    )
  );

comment on column public.workflow_stages.deadline_spec is
  'موعد أسبوعيّ ثابت: {"time":"HH:MM","days":[0..6]} — ٠ الأحد. فارغ = بلا موعد.';
comment on column public.workflow_stages.deadline_action is
  'عند التجاوز: notify = تنبيه المكلَّف · escalate = تنبيهه وتنبيه الإدارة.';

-- ── ٣) أثر الموعد على المعاملة ─────────────────────────────────────────
alter table public.transaction_stage_instances
  add column if not exists deadline_at timestamptz,
  add column if not exists deadline_action text,
  add column if not exists deadline_notified_at timestamptz;

comment on column public.transaction_stage_instances.deadline_at is
  'الموعد المحسوب لهذه المعاملة عند فتح المرحلة — يُثبَّت ولا يتغيّر بتعديل المسار.';

-- فهرس ما لم يُنبَّه عليه بعد: هو وحده ما يمسحه المشغِّل الدوريّ
create index if not exists tsi_deadline_due_idx
  on public.transaction_stage_instances (deadline_at)
  where deadline_at is not null
    and deadline_notified_at is null
    and status = 'in_progress';
