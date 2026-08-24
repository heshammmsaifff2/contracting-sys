-- ═══════════════════════════════════════════════════════════════════════
-- Phase 2 — تشديد: إخراج الامتداد من schema public
-- أسماء دوال الامتداد تصير جزءًا من واجهة REST المكشوفة ويمكن أن تتعارض
-- مع دوال التطبيق، لذا ننقلها إلى extensions حيث تضعها Supabase عادة.
-- الفهارس تحتفظ بمرجع opclass بالـ OID فلا تتأثّر بالنقل.
-- ═══════════════════════════════════════════════════════════════════════

create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

grant usage on schema extensions to authenticated, service_role;
