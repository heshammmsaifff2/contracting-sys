-- ═══════════════════════════════════════════════════════════════════════
-- وصل توجيه سير العمل بإسناد المشاريع
--
-- كان `project_assignments` يحكم **الرؤية** وحدها، و`workflow_stage_participants`
-- يحكم **التوجيه** وحده، ولا يعرف أحدهما الآخر. فمرحلةٌ مشاركها
-- `role: project_manager` كانت تُكلّف **كل** مديري المشاريع في الشركة —
-- بمن لا صلة له بمشروع المعاملة، فيقرأ مستخلصه ويعتمده.
--
-- `project_role` يقول: «صاحب هذه الوظيفة **في مشروع هذه المعاملة**».
-- و`requires_sign` يضيّقها إلى من له حقّ التوقيع على مستندات ذلك المشروع.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.workflow_stage_participants
  add column if not exists requires_sign boolean not null default false;

comment on column public.workflow_stage_participants.requires_sign is
  'يقصر التكليف على من له can_sign على مشروع المعاملة — لـ project_role وحده.';

alter table public.workflow_stage_participants
  drop constraint if exists workflow_stage_participants_kind_check;
alter table public.workflow_stage_participants
  add constraint workflow_stage_participants_kind_check
  check (kind in ('user', 'role', 'project_role', 'department_role',
                  'requester', 'audience'));

alter table public.workflow_stage_participants
  drop constraint if exists participant_shape;
alter table public.workflow_stage_participants
  add constraint participant_shape check (
    (kind = 'user'
       and user_id is not null and role_id is null and department_id is null)
    or (kind in ('role', 'project_role')
       and role_id is not null and user_id is null and department_id is null)
    or (kind = 'department_role'
       and role_id is not null and department_id is not null and user_id is null)
    or (kind in ('requester', 'audience')
       and user_id is null and role_id is null and department_id is null)
  );

-- `requires_sign` بلا معنى خارج `project_role`: التوقيع صفةٌ على المشروع،
-- ومن لا يُحلّ عبر المشروع لا مشروع له يُسأل عنه.
alter table public.workflow_stage_participants
  drop constraint if exists participant_sign_scope;
alter table public.workflow_stage_participants
  add constraint participant_sign_scope check (
    requires_sign = false or kind = 'project_role'
  );
