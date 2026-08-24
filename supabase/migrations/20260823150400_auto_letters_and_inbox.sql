-- ═══════════════════════════════════════════════════════════════════════
-- Phase 4 — الخطابات الآلية، وخصوصية المعاملات، وصندوق الوارد.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.auto_letter_rules (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body_template text not null default '',
  -- نص التوقيت للعرض؛ التنفيذ يعتمد next_run_at و interval_days
  schedule_cron text not null default '',
  interval_days integer check (interval_days is null or interval_days > 0),
  repeat boolean not null default false,
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  transaction_type text not null default 'letter',
  project_id uuid references public.projects (id) on delete cascade,
  recipients uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.auto_letter_rules is
  'خطابات يحرّرها النظام تلقائيًا وتصل الوارد كخطاب رسمي له مدة [المراسلات 10].';

drop trigger if exists auto_letter_rules_set_updated_at on public.auto_letter_rules;
create trigger auto_letter_rules_set_updated_at
  before update on public.auto_letter_rules
  for each row execute function public.set_updated_at();

drop trigger if exists auto_letter_rules_set_created_by on public.auto_letter_rules;
create trigger auto_letter_rules_set_created_by
  before insert on public.auto_letter_rules
  for each row execute function public.set_created_by();

/**
 * تُشغَّل بجدول زمني من Edge Function. تنشئ معاملة خطاب لكل قاعدة مستحقّة،
 * فيصل الخطاب صندوق الوارد بمدة وعدّاد ويظهر في تقارير المتأخّر.
 */
create or replace function public.run_auto_letters()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule public.auto_letter_rules%rowtype;
  v_definition public.workflow_definitions%rowtype;
  v_first_step public.workflow_steps%rowtype;
  v_transaction_id uuid;
  v_created int := 0;
begin
  for v_rule in
    select * from public.auto_letter_rules
    where is_active and next_run_at <= now()
  loop
    select * into v_definition
      from public.workflow_definitions
     where transaction_type = v_rule.transaction_type and is_active;

    if found then
      select * into v_first_step
        from public.workflow_steps
       where definition_id = v_definition.id
       order by order_no limit 1;

      if found then
        insert into public.transactions
          (type, subject, project_id, entity_type, entity_id, definition_id,
           status, requested_by)
        values
          (v_rule.transaction_type, v_rule.subject, v_rule.project_id,
           'auto_letter_rule', v_rule.id, v_definition.id, 'in_progress', null)
        returning id into v_transaction_id;

        perform public.open_step_instance(
          v_transaction_id, v_first_step.id, v_first_step.order_no);

        v_created := v_created + 1;
      end if;
    end if;

    update public.auto_letter_rules
       set last_run_at = now(),
           next_run_at = case
             when repeat and interval_days is not null
               then now() + make_interval(days => interval_days)
             else next_run_at
           end,
           is_active = case
             when repeat and interval_days is not null then is_active
             else false
           end
     where id = v_rule.id;
  end loop;

  return v_created;
end;
$$;

revoke execute on function public.run_auto_letters() from public, anon, authenticated;
grant execute on function public.run_auto_letters() to service_role;

-- ── الخصوصية: من يرى المعاملة؟ [المراسلات 19] ──────────────────────────
create or replace function public.is_transaction_participant(p_transaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.transactions t
    where t.id = p_transaction_id and t.requested_by = (select auth.uid())
  ) or exists (
    select 1 from public.transaction_step_instances s
    where s.transaction_id = p_transaction_id and s.assignee_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_transaction_participant(uuid) from public, anon;
grant execute on function public.is_transaction_participant(uuid) to authenticated;

/**
 * البحث عن معاملة: يُظهرها بلا تفاصيل لغير الموقّعين [المراسلات 19].
 * الرقم والنوع والحالة فقط — لا موضوع ولا مراحل ولا ملاحظات.
 */
create or replace function public.search_transactions_brief(p_query text)
returns table (
  transaction_no bigint,
  transaction_type text,
  status text,
  created_at timestamptz,
  is_participant boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.no, t.type, t.status, t.created_at,
         public.is_transaction_participant(t.id)
  from public.transactions t
  where public.has_permission('transaction.read')
    and (
      coalesce(btrim(p_query), '') = ''
      or t.no::text = btrim(p_query)
      or public.normalize_ar(t.subject) like '%' || public.normalize_ar(p_query) || '%'
    )
  order by t.no desc
  limit 50;
$$;

revoke execute on function public.search_transactions_brief(text) from public, anon;
grant execute on function public.search_transactions_brief(text) to authenticated;

/**
 * صندوق الوارد: العدّاد التنازلي محسوب داخل مواعيد العمل، واللون يتبع
 * القاعدة الملزَمة [المراسلات 25]:
 *   أخضر = منجَزة · أزرق = مرّ نصف المدة · أصفر = مرّ 75٪ · أحمر = انتهت المدة
 * security_invoker: تسري سياسات RLS على من يقرأ العرض.
 */
drop view if exists public.transaction_inbox;

create view public.transaction_inbox
with (security_invoker = true) as
select
  tsi.id                       as step_instance_id,
  t.id                         as transaction_id,
  t.no                         as transaction_no,
  t.type                       as transaction_type,
  t.subject,
  t.status                     as transaction_status,
  t.requested_by,
  t.project_id,
  pr.name                      as project_name,
  tsi.order_no,
  tsi.name                     as step_name,
  tsi.assignee_id,
  pf.full_name                 as assignee_name,
  tsi.allocated_minutes,
  tsi.arrived_at,
  tsi.completed_at,
  tsi.status                   as step_status,
  tsi.score,
  -- ملاحظة المدير: للجميع إن لم تُخصَّص، وإلا لصاحبها وحده [المراسلات 19]
  case
    when tsi.manager_note_visible_to is null
      or tsi.manager_note_visible_to = (select auth.uid())
    then tsi.manager_note
    else ''
  end                          as manager_note,
  public.business_minutes_between(
    tsi.arrived_at, coalesce(tsi.completed_at, now()), tsi.assignee_id
  )                            as elapsed_minutes,
  case
    when tsi.allocated_minutes is null then null
    else tsi.allocated_minutes - public.business_minutes_between(
      tsi.arrived_at, coalesce(tsi.completed_at, now()), tsi.assignee_id)
  end                          as remaining_minutes,
  case
    when tsi.allocated_minutes is null or tsi.allocated_minutes = 0 then null
    else round(
      public.business_minutes_between(
        tsi.arrived_at, coalesce(tsi.completed_at, now()), tsi.assignee_id
      )::numeric / tsi.allocated_minutes, 4)
  end                          as elapsed_ratio,
  case
    when tsi.allocated_minutes is null then null
    else public.add_business_minutes(
      tsi.arrived_at, tsi.allocated_minutes, tsi.assignee_id)
  end                          as due_at,
  case
    when tsi.status = 'done' then 'success'
    when tsi.allocated_minutes is null then 'neutral'
    when public.business_minutes_between(
           tsi.arrived_at, now(), tsi.assignee_id
         )::numeric / tsi.allocated_minutes >= 1 then 'danger'
    when public.business_minutes_between(
           tsi.arrived_at, now(), tsi.assignee_id
         )::numeric / tsi.allocated_minutes >= 0.75 then 'warning'
    when public.business_minutes_between(
           tsi.arrived_at, now(), tsi.assignee_id
         )::numeric / tsi.allocated_minutes >= 0.5 then 'info'
    else 'neutral'
  end                          as color,
  (tsi.allocated_minutes is null and tsi.status = 'in_progress') as awaiting_duration
from public.transaction_step_instances tsi
join public.transactions t on t.id = tsi.transaction_id
left join public.projects pr on pr.id = t.project_id
left join public.profiles pf on pf.id = tsi.assignee_id;

comment on view public.transaction_inbox is
  'صندوق الوارد: عدّاد داخل الدوام وألوان الحالة [المراسلات 25].';
