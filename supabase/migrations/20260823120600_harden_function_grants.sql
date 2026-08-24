-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1 — تشديد صلاحيات تنفيذ الدوال
-- Postgres يمنح EXECUTE لـ PUBLIC افتراضيًا، وSupabase يعرض دوال schema public
-- كنقاط RPC. لذا:
--   • دوال المُشغِّلات (triggers) لا تُستدعى مباشرة أبدًا ⇒ سحب EXECUTE من الجميع.
--   • دوال الصلاحيات تُستدعى داخل سياسات RLS بصلاحيات المستخدم السائل،
--     فتبقى متاحة لـ authenticated فقط ولا تصل إلى anon إطلاقًا.
-- ═══════════════════════════════════════════════════════════════════════

revoke execute on function public.set_updated_at()           from public, anon, authenticated;
revoke execute on function public.set_created_by()           from public, anon, authenticated;
revoke execute on function public.guard_profile_update()     from public, anon, authenticated;
revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

revoke execute on function public.is_active_user()             from public, anon;
revoke execute on function public.has_permission(text)         from public, anon;
revoke execute on function public.is_assigned_to_project(uuid) from public, anon;
revoke execute on function public.can_sign_project(uuid)       from public, anon;
revoke execute on function public.current_permissions()        from public, anon;
revoke execute on function public.current_project_ids()        from public, anon;

grant execute on function public.is_active_user()             to authenticated;
grant execute on function public.has_permission(text)         to authenticated;
grant execute on function public.is_assigned_to_project(uuid) to authenticated;
grant execute on function public.can_sign_project(uuid)       to authenticated;
grant execute on function public.current_permissions()        to authenticated;
grant execute on function public.current_project_ids()        to authenticated;
