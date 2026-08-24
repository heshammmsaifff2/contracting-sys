/**
 * عميل موحّد لاستدعاء Supabase Edge Functions.
 * يحوّل كل الأخطاء إلى DomainError عند الحدود، فلا تتسرّب أنواع Supabase للأعلى.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { InfrastructureError, toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { AppSupabaseClient } from "../supabase/client";

export class EdgeFnClient {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /** Invoke an edge function and normalize failures into DomainError. */
  async invoke<
    TResponse,
    TBody extends Record<string, unknown> = Record<string, unknown>,
  >(name: string, body?: TBody): Promise<Result<TResponse, DomainError>> {
    try {
      const options = body === undefined ? {} : { body };
      const { data, error } = await this.client.functions.invoke<TResponse>(
        name,
        options,
      );

      if (error) {
        return err(
          new InfrastructureError(`فشل استدعاء الدالة ${name}`, {
            fn: name,
            cause: error.message,
          }),
        );
      }
      if (data === null || data === undefined) {
        return err(
          new InfrastructureError(`الدالة ${name} لم تُعِد أي بيانات`, { fn: name }),
        );
      }
      return ok(data);
    } catch (e) {
      return err(toDomainError(e, `تعذّر الاتصال بالدالة ${name}`));
    }
  }
}
