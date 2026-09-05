-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٣ — مرفقات المعاملات
--
-- لا ملفّ في قاعدة البيانات ولا في Supabase Storage: العمود يحمل **مرجع
-- Cloudinary** وحده `{public_id, url}` — وهو اصطلاح المشروع في كل وحداته.
--
-- والمرفق ليس حرًّا: يُربَط بالتكليف الذي رُفع عنده، فيُعرَف من أرفقه وفي أي
-- مرحلة ومع أي إجراء. وبعض المرفقات لا يراها كل الموقّعين.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null
    references public.transactions (id) on delete cascade,
  -- التكليف الذي رُفع عنده: من أرفقه وفي أي مرحلة
  assignment_id uuid
    references public.transaction_assignments (id) on delete set null,
  stage_instance_id uuid
    references public.transaction_stage_instances (id) on delete set null,
  -- يُختَم عند اتخاذ الإجراء، فيظهر المرفق في مكانه من الخطّ الزمني
  action_log_id uuid
    references public.transaction_action_log (id) on delete set null,

  name text not null check (btrim(name) <> ''),
  -- {public_id, url} — لا الملفّ نفسه
  file jsonb not null,
  content_type text not null default '',
  size_bytes bigint not null default 0 check (size_bytes >= 0),

  -- من يراه: الموقّعون · قسم بعينه · صاحب صلاحية مسمّاة
  visibility text not null default 'participants'
    check (visibility in ('participants', 'department', 'permission')),
  department_id uuid references public.departments (id) on delete set null,
  required_permission text,

  -- الأصل الخاص يحتاج رابطًا موقّعًا قصير العمر لا رابطًا عامًّا
  is_authenticated boolean not null default false,

  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint attachment_file_shape
    check (jsonb_typeof(file) = 'object'
           and file ? 'public_id' and file ? 'url'),
  constraint attachment_visibility_shape check (
    (visibility = 'participants'
       and department_id is null and required_permission is null)
    or (visibility = 'department'
       and department_id is not null and required_permission is null)
    or (visibility = 'permission'
       and coalesce(btrim(required_permission), '') <> '' and department_id is null)
  )
);

comment on table public.transaction_attachments is
  'مرفقات المعاملة — مرجع Cloudinary فقط. مربوطة بالتكليف الذي رُفعت عنده.';
comment on column public.transaction_attachments.visibility is
  'participants = كل الموقّعين · department = قسم بعينه · permission = صلاحية مسمّاة';

create index if not exists ta_attach_transaction_idx
  on public.transaction_attachments (transaction_id, created_at);
create index if not exists ta_attach_assignment_idx
  on public.transaction_attachments (assignment_id);
create index if not exists ta_attach_stage_idx
  on public.transaction_attachments (stage_instance_id);
create index if not exists ta_attach_action_log_idx
  on public.transaction_attachments (action_log_id);
create index if not exists ta_attach_uploader_idx
  on public.transaction_attachments (uploaded_by);
create index if not exists ta_attach_department_idx
  on public.transaction_attachments (department_id);

-- ── صلاحية رؤية المقيَّد ───────────────────────────────────────────────
insert into public.permissions (key, description, module) values
  ('attachment.read_restricted',
   'عرض مرفقات المعاملات المقيَّدة بالأقسام', 'workflow')
on conflict (key) do update
  set description = excluded.description, module = excluded.module;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key in ('admin', 'program_manager')
  and p.key = 'attachment.read_restricted'
on conflict do nothing;
