-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6 — سحب صلاحية استدعاء دوال المُشغِّلات عبر REST
-- دوال المُشغِّل تعمل بصلاحية مالك الجدول عند إطلاق المُشغِّل، فلا تحتاج
-- منحًا لأحد. تركها ممنوحة يجعلها ظاهرة في /rest/v1/rpc بلا داعٍ.
-- ═══════════════════════════════════════════════════════════════════════

revoke execute on function public.detect_invoice_duplicate()
  from public, anon, authenticated;
revoke execute on function public.notify_invoice_duplicate()
  from public, anon, authenticated;
revoke execute on function public.guard_extract_line()
  from public, anon, authenticated;
