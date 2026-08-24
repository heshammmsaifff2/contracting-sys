/**
 * تحقيق منفذ الترحيل: ينادي Edge Function التي تنادي دالة Postgres.
 * الواجهة لا تلمس دفتر اليومية إطلاقًا — القيد يُبنى على الخادم ذرّيًا.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { IAccountingPoster } from "@application/modules/accounting/ports/accounting-poster";
import type { EdgeFnClient } from "./EdgeFnClient";

export class EdgeAccountingPoster implements IAccountingPoster {
  private readonly edgeFn: EdgeFnClient;

  constructor(edgeFn: EdgeFnClient) {
    this.edgeFn = edgeFn;
  }

  async post(
    sourceType: string,
    sourceId: string,
  ): Promise<Result<{ entryId: string }, DomainError>> {
    return this.edgeFn.invoke<{ entryId: string }>("post-accounting-entry", {
      sourceType,
      sourceId,
    });
  }
}
