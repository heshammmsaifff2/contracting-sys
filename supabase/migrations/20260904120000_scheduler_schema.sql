-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٤ — المجدوِل العام
--
-- المرجع: docs/decisions/0001-workflow-engine-v2.md — القرار ٣.
--
-- الخطاب ليس كيانًا خاصًّا: هو معاملة عادية على مسار عادي، والفرق الوحيد أن
-- مُنشئها النظام. فيرث العدّاد داخل الدوام والألوان وتقارير المتأخّر والتقييم
-- والأرشفة بلا سطر كود إضافي.
--
-- والمجدوِل عام لا خاص بالخطابات: يبدأ **أي** مسار، أو يرسل إشعارًا بلا معاملة.
-- ═══════════════════════════════════════════════════════════════════════

-- ── مشارك من نوع «الجمهور» ─────────────────────────────────────────────
-- هنا يلتقي القرار ٣ بالقرار ١: تعميم على ٥٠ موظفًا = مرحلة واحدة،
-- ٥٠ مشاركًا، سياسة «الكل» — و«تأكيد القراءة» إجراء forward عادي.
alter table public.transactions
  add column if not exists audience_ids uuid[] not null default '{}'::uuid[];

comment on column public.transactions.audience_ids is
  'من استهدفهم المجدوِل — يُحلّ إليهم المشارك من نوع audience.';

alter table public.workflow_stage_participants
  drop constraint if exists workflow_stage_participants_kind_check;
alter table public.workflow_stage_participants
  add constraint workflow_stage_participants_kind_check
  check (kind in ('user', 'role', 'department_role', 'requester', 'audience'));

alter table public.workflow_stage_participants
  drop constraint if exists participant_shape;
alter table public.workflow_stage_participants
  add constraint participant_shape check (
    (kind = 'user'
       and user_id is not null and role_id is null and department_id is null)
    or (kind = 'role'
       and role_id is not null and user_id is null and department_id is null)
    or (kind = 'department_role'
       and role_id is not null and department_id is not null and user_id is null)
    or (kind in ('requester', 'audience')
       and user_id is null and role_id is null and department_id is null)
  );

create unique index if not exists wsp_uniq_audience_idx
  on public.workflow_stage_participants (stage_id) where kind = 'audience';

-- ── وصف الجمهور ────────────────────────────────────────────────────────
/**
 * يتحقّق من شكل وصف الجمهور قبل الحفظ.
 * `company` وحدها لا تحتاج معرّفات؛ وما عداها يحتاج قائمة UUID غير فارغة.
 */
create or replace function public.validate_audience(p_audience jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $fn$
declare
  v_scope text;
  v_ids jsonb;
  v_e jsonb;
begin
  if p_audience is null or jsonb_typeof(p_audience) <> 'object' then
    return false;
  end if;

  v_scope := p_audience ->> 'scope';
  if v_scope is null
     or v_scope not in ('company', 'department', 'role', 'project', 'users') then
    return false;
  end if;

  if v_scope = 'company' then
    return true;
  end if;

  v_ids := p_audience -> 'ids';
  if v_ids is null or jsonb_typeof(v_ids) <> 'array'
     or jsonb_array_length(v_ids) = 0 then
    return false;
  end if;

  -- معرّف معطوب يُكتشف الآن لا وقت التشغيل حين لا أحد ينظر
  for v_e in select * from jsonb_array_elements(v_ids) loop
    if jsonb_typeof(v_e) <> 'string' then return false; end if;
    begin
      perform (v_e #>> '{}')::uuid;
    exception when others then
      return false;
    end;
  end loop;

  return true;
end;
$fn$;

-- ── المهام المجدولة ────────────────────────────────────────────────────
create table if not exists public.scheduled_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  is_active boolean not null default true,

  -- start_workflow يبدأ معاملة · notify يرسل إشعارًا بلا معاملة ولا عدّاد
  action text not null check (action in ('start_workflow', 'notify')),
  transaction_type text,
  project_id uuid references public.projects (id) on delete cascade,

  subject_template text not null default '',
  body_template text not null default '',
  -- يملأ قوالب {{...}} ويصير لقطة سياق المعاملة، فيُقاس عليه التفريع
  context jsonb not null default '{}'::jsonb,

  -- يُحلّ **وقت التشغيل**: تغيّر الموظفين لا يُبطل القاعدة
  audience jsonb not null default '{"scope":"company"}'::jsonb,

  schedule_kind text not null check (
    schedule_kind in ('once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')
  ),
  schedule_spec jsonb not null default '{}'::jsonb,
  -- الموعد الذي يقع في إجازة يُزاح لأول يوم عمل بعده
  shift_to_workday boolean not null default false,

  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_status text,
  last_error text not null default '',
  run_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,

  constraint scheduled_tasks_audience_shape
    check (public.validate_audience(audience)),
  constraint scheduled_tasks_workflow_needs_type
    check (action <> 'start_workflow'
           or coalesce(btrim(transaction_type), '') <> ''),
  constraint scheduled_tasks_notify_needs_subject
    check (action <> 'notify' or btrim(subject_template) <> '')
);

comment on table public.scheduled_tasks is
  'ما يفعله النظام بنفسه بجدول زمني: يبدأ مسارًا أو يرسل إشعارًا. '
  'يستبدل auto_letter_rules بالكامل.';
comment on column public.scheduled_tasks.audience is
  '{"scope":"company|department|role|project|users","ids":[...]} — يُحلّ وقت التشغيل';
comment on column public.scheduled_tasks.schedule_spec is
  'once:{at} · daily:{time,} · weekly:{time,days[]} · monthly:{time,day_of_month} '
  '· quarterly:{time,day_of_month} · yearly:{time,month,day}';

create index if not exists scheduled_tasks_due_idx
  on public.scheduled_tasks (next_run_at) where is_active;
create index if not exists scheduled_tasks_project_idx
  on public.scheduled_tasks (project_id);

drop trigger if exists scheduled_tasks_set_updated_at on public.scheduled_tasks;
create trigger scheduled_tasks_set_updated_at
  before update on public.scheduled_tasks
  for each row execute function public.set_updated_at();

drop trigger if exists scheduled_tasks_set_created_by on public.scheduled_tasks;
create trigger scheduled_tasks_set_created_by
  before insert on public.scheduled_tasks
  for each row execute function public.set_created_by();

-- ── سجلّ التشغيل ───────────────────────────────────────────────────────
-- المجدوِل يعمل بلا رقيب، فبغير سجلّ لا يُعرف أنه فشل صامتًا.
create table if not exists public.scheduled_task_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.scheduled_tasks (id) on delete cascade,
  fired_at timestamptz not null default now(),
  scheduled_for timestamptz,
  status text not null check (status in ('ok', 'skipped', 'error')),
  audience_count integer not null default 0,
  created_transaction_ids uuid[] not null default '{}'::uuid[],
  notified_count integer not null default 0,
  error text not null default ''
);

comment on table public.scheduled_task_runs is
  'سجلّ لا يُعدَّل لكل تشغيل: كم استُهدف، وماذا أُنشئ، وما الخطأ إن وقع.';

create index if not exists str_task_idx
  on public.scheduled_task_runs (task_id, fired_at desc);
create index if not exists str_failed_idx
  on public.scheduled_task_runs (fired_at desc) where status = 'error';

-- ── صلاحية الإدارة ─────────────────────────────────────────────────────
insert into public.permissions (key, description, module) values
  ('schedule.manage', 'إدارة المهام المجدولة والخطابات الآلية', 'workflow')
on conflict (key) do update
  set description = excluded.description, module = excluded.module;

-- من كان يملك إدارة الخطابات الآلية يرث إدارة المجدوِل
insert into public.role_permissions (role_id, permission_id)
select rp.role_id, p_new.id
from public.role_permissions rp
join public.permissions p_old on p_old.id = rp.permission_id
cross join public.permissions p_new
where p_old.key = 'auto_letter.manage' and p_new.key = 'schedule.manage'
on conflict do nothing;
