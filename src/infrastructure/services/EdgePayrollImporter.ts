/**
 * ترحيل كشف البنك يمرّ عبر Edge Function لأن post_accounting_entry
 * ممنوحة لـ service_role وحده — فلا مسار للترحيل من المتصفّح.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  ImportStatementDto,
  ImportStatementResultDto,
} from "@application/modules/hr/dtos";
import type { IPayrollImporter } from "@application/modules/hr/ports";
import type { EdgeFnClient } from "./EdgeFnClient";

export class EdgePayrollImporter implements IPayrollImporter {
  private readonly edgeFn: EdgeFnClient;

  constructor(edgeFn: EdgeFnClient) {
    this.edgeFn = edgeFn;
  }

  async importStatement(
    input: ImportStatementDto,
  ): Promise<Result<ImportStatementResultDto, DomainError>> {
    return this.edgeFn.invoke<ImportStatementResultDto>("import-bank-statement", {
      rows: input.rows.map((row) => ({
        reference: row.reference,
        amount: row.amount,
        transferredAt: row.transferredAt,
      })),
      dryRun: input.dryRun,
    });
  }
}
