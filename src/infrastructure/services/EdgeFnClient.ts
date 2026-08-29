/**
 * عميل موحّد لاستدعاء Supabase Edge Functions.
 * يحوّل كل الأخطاء إلى DomainError عند الحدود، فلا تتسرّب أنواع Supabase للأعلى.
 */
import { FunctionsHttpError } from "@supabase/supabase-js";
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
        let serverMessage: string | null = null;
        if (error instanceof FunctionsHttpError && error.context) {
          try {
            const body = await error.context.json();
            serverMessage =
              body?.error?.message ??
              (typeof body?.error === "string" ? body.error : null) ??
              body?.message ??
              null;
          } catch {
            try {
              const text = await error.context.text();
              if (text && text.trim().length > 0) {
                serverMessage = text;
              }
            } catch {
              // ignore
            }
          }
        }

        const message =
          serverMessage || (error.message && error.message !== "Edge Function returned a non-2xx status code" ? error.message : `فشل استدعاء الدالة ${name}`);

        return err(
          new InfrastructureError(message, {
            fn: name,
            cause: error.message,
            serverMessage,
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
