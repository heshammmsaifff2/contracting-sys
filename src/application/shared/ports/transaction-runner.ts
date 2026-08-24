/**
 * تنفيذ عدّة عمليات ضمن معاملة Postgres واحدة (atomic).
 * التحقيق الفعلي يستدعي RPC/Edge Function — لأن Supabase JS لا يدعم المعاملات مباشرة.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";

export interface ITransactionRunner {
  run<T>(work: () => Promise<Result<T, DomainError>>): Promise<Result<T, DomainError>>;
}
