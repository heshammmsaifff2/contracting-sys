-- إصلاح: تعذّر تغيير بيانات الحساب من لوحة Supabase، بلا رسالة خطأ.
--
-- السبب: `guard_profile_update` كان يستدعي `has_permission('user.update')`،
-- وهي تقرأ `auth.uid()`. ولوحة Supabase (ومحرّر SQL، وأي عمل خادمي) تعمل
-- بدور `service_role` بلا `auth.uid()`، فتعود الدالة بـ false ويعيد الحارس
-- الأعمدة المحميّة إلى قيمها القديمة **صامتًا**: تحفظ التعديل، فيبدو أنه
-- نجح، ثم تجد الصف كما كان.
--
-- علاجان في هذه الهجرة:
--
-- ١) سياق الخادم الموثوق (`service_role` / `postgres`) يمرّ كما هو. هذا لا
--    يفتح ثغرة: هذا الدور يتجاوز RLS أصلًا، وليس متاحًا للمتصفّح إطلاقًا.
--
-- ٢) المستخدم الذي **يحاول فعلًا** تغيير عمود محميّ يتلقّى خطأً صريحًا بدل
--    التجاهل الصامت. أمّا من يعدّل اسمه وحده فيمرّ كما كان — وهي الحالة
--    التي صُمّم لها التطهير الصامت أصلًا.

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- سياق خادمي موثوق: لوحة Supabase، محرّر SQL، الدوال الخلفية
  if (select auth.uid()) is null
     or current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if public.has_permission('user.update') then
    return new;
  end if;

  -- محاولة صريحة لتغيير عمود محميّ ⇒ خطأ صريح لا تجاهل صامت
  if new.code           is distinct from old.code
     or new.email          is distinct from old.email
     or new.employee_type  is distinct from old.employee_type
     or new.is_active      is distinct from old.is_active then
    raise exception
      'لا تملك صلاحية تعديل الكود أو التصنيف أو حالة التفعيل — المسموح لك اسمك فقط'
      using errcode = 'insufficient_privilege';
  end if;

  -- تعديل الاسم وحده: يمرّ، مع تثبيت بقيّة الأعمدة احتياطًا
  new.created_by := old.created_by;
  return new;
end;
$$;

comment on function public.guard_profile_update is
  'يحمي الكود والتصنيف والتفعيل من التعديل بلا صلاحية، ويمرّر سياق الخادم '
  'الموثوق، ويرفض صراحةً بدل أن يتجاهل صامتًا.';

-- ── مساعد إسناد الدور من محرّر SQL ────────────────────────────────────
-- لوحة Supabase تُظهر `user_roles.role_id` معرّفًا خامًا (uuid)، فإسناد دور
-- من هناك يعني نسخ معرّف من جدول إلى جدول. هذه الدالة تقبل البريد ومفتاح
-- الدور المقروء، وتتكفّل بالباقي:
--
--   select public.set_user_role('someone@example.com', 'admin');
--
-- تستبدل أدوار المستخدم بالدور المطلوب. ولمعرفة المفاتيح المتاحة:
--   select key, name from public.roles order by key;
create or replace function public.set_user_role(
  p_email text,
  p_role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
begin
  -- من الواجهة: تلزم صلاحية الإسناد. من الخادم (بلا auth.uid): مسموح.
  if (select auth.uid()) is not null
     and not public.has_permission('user.assign_role') then
    raise exception 'لا تملك صلاحية إسناد الأدوار'
      using errcode = 'insufficient_privilege';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then
    raise exception 'لا يوجد مستخدم بالبريد %', p_email
      using errcode = 'no_data_found';
  end if;

  select id into v_role_id from public.roles where key = p_role_key;
  if v_role_id is null then
    raise exception 'لا يوجد دور بالمفتاح % — المتاح: %',
      p_role_key,
      (select string_agg(key, ', ' order by key) from public.roles)
      using errcode = 'no_data_found';
  end if;

  delete from public.user_roles where user_id = v_user_id;
  insert into public.user_roles (user_id, role_id) values (v_user_id, v_role_id);

  return jsonb_build_object(
    'email', p_email,
    'role', p_role_key,
    'permissions', (
      select count(*) from public.role_permissions where role_id = v_role_id
    )
  );
end;
$$;

comment on function public.set_user_role is
  'إسناد دور لمستخدم بالبريد ومفتاح الدور بدل نسخ المعرّفات — للاستعمال من محرّر SQL.';

revoke all on function public.set_user_role(text, text) from public, anon;
grant execute on function public.set_user_role(text, text) to authenticated;
