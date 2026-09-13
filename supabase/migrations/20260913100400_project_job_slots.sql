-- ═══════════════════════════════════════════════════════════════════════
-- المشروع يُبنى بالوظائف
--
-- الاعتماد على المشروع صار «خانة وظيفة»: تُضاف الوظيفة (مدير مشروع · مهندس)،
-- ويملؤها أحد **شاغليها** — لا أيّ موظف. والخانة قد تبقى شاغرة.
--
-- لماذا لا تدخل الوظيفة بكل شاغليها؟ لأن الشركة فيها أكثر من مدير مشروع،
-- ولا يرى مديرُ مشروعٍ معاملاتِ مشروعٍ آخر.
--
-- كل ما يقرأ الاعتماد (الرؤية · التوقيع · التوجيه · الأعضاء) يقرأ `user_id`
-- كما كان، فالخانة الشاغرة لا تفتح شيئًا لأحد.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.project_assignments
  add column if not exists job_id uuid references public.jobs (id) on delete restrict;

update public.project_assignments pa
   set job_id = p.job_id
  from public.profiles p
 where p.id = pa.user_id and pa.job_id is null;

-- اعتمادٌ لموظف بلا وظيفة لا خانة له في النظام الجديد
delete from public.project_assignments where job_id is null;

alter table public.project_assignments alter column job_id set not null;
alter table public.project_assignments alter column user_id drop not null;
create index if not exists project_assignments_job_idx on public.project_assignments (job_id);

-- ── ١) الخانة تُملأ بشاغل وظيفتها فقط ────────────────────────────────
-- وحين تُدرَج بموظف بلا وظيفة محدَّدة (كما تفعل البذرة التجريبية) تُشتقّ
-- الوظيفة منه — فلا ينكسر ما كُتب قبل هذا التغيير.
create or replace function public.project_assignment_check_holder()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_holder_job uuid;
  v_holder text;
  v_job text;
begin
  if new.user_id is null then
    return new;
  end if;

  select job_id, full_name into v_holder_job, v_holder
  from public.profiles where id = new.user_id;

  if new.job_id is null then
    new.job_id := v_holder_job;
  end if;
  if new.job_id is null then
    raise exception 'الموظف «%» بلا وظيفة — أسند له وظيفة أوّلًا', v_holder
      using errcode = 'check_violation';
  end if;

  if v_holder_job is distinct from new.job_id then
    select name into v_job from public.jobs where id = new.job_id;
    raise exception 'الموظف «%» لا يشغل وظيفة «%» — الخانة تُملأ بأحد شاغليها فقط', v_holder, v_job
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists project_assignments_check_holder on public.project_assignments;
create trigger project_assignments_check_holder
  before insert or update of user_id, job_id on public.project_assignments
  for each row execute function public.project_assignment_check_holder();

-- ── ٢) من ترك الوظيفة تفرغ خاناته ────────────────────────────────────
-- بغيره يبقى مهندسٌ نُقل للمحاسبة معتمَدًا على المشروع بصفته مهندسًا.
create or replace function public.profile_vacate_project_slots()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.project_assignments
     set user_id = null
   where user_id = new.id
     and job_id is distinct from new.job_id;
  return null;
end;
$$;

drop trigger if exists profiles_vacate_project_slots on public.profiles;
create trigger profiles_vacate_project_slots
  after update of job_id on public.profiles
  for each row
  when (old.job_id is distinct from new.job_id)
  execute function public.profile_vacate_project_slots();

-- ── ٣) الوظيفة المستعملة على مشروع لا تُحذف ──────────────────────────
create or replace function public.guard_job_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.profiles where job_id = old.id;
  if v_n > 0 then
    raise exception 'لا تُحذف الوظيفة «%»: يشغلها % موظف — انقلهم إلى وظيفة أخرى أوّلًا',
      old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_n from public.workflow_stage_participants where job_id = old.id;
  if v_n > 0 then
    raise exception 'لا تُحذف الوظيفة «%»: مستعملة في % موضع من مسارات سير العمل',
      old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  select count(*) into v_n from public.project_assignments where job_id = old.id;
  if v_n > 0 then
    raise exception 'لا تُحذف الوظيفة «%»: مستعملة في % خانة على المشاريع — أزِلها من المشاريع أوّلًا',
      old.name, v_n
      using errcode = 'foreign_key_violation';
  end if;

  return old;
end;
$$;

revoke all on function public.project_assignment_check_holder() from public, anon, authenticated;
revoke all on function public.profile_vacate_project_slots() from public, anon, authenticated;
