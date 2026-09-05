-- ═══════════════════════════════════════════════════════════════════════
-- المرحلة ٠٨ — سحب صلاحية استدعاء دوالّ المُشغّلات
--
-- `log_evaluation_change` كانت `security definer` — ومنطقيّ أن تكون، فهي
-- تكتب في سجلٍّ لا يملك `authenticated` الكتابةَ فيه. لكنّ PostgREST يعرض كل
-- دالّة في `public` على `/rpc/…`، فصارت قابلةً للاستدعاء **بلا تسجيل دخول**.
-- والمُشغّل يستدعيها داخل القاعدة بلا حاجة إلى `execute` ممنوحة لأحد.
--
-- رصده مستشار الأمان بعد المرحلة ٠٨؛ والاصطلاح نفسه المتَّبع في
-- `20260823170700_revoke_trigger_functions`.
-- ═══════════════════════════════════════════════════════════════════════

revoke execute on function
  public.log_evaluation_change(),
  public.guard_evaluation_rule(),
  public.guard_stage_requirement(),
  public.guard_definition_frozen(),
  public.set_definition_lineage()
  from public, anon, authenticated;
