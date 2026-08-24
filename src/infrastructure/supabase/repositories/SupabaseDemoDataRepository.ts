/**
 * النسخة الاختبارية — استدعاء دوال Postgres لا أكثر.
 * لا تحقّق من الصلاحية هنا: الدوال نفسها ترفض من لا يملك
 * `demo_data.manage`، فالمنع في الخادم لا في العميل.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { DemoDataStatusDto } from "@application/modules/platform/dtos/demo-data";
import type { IDemoDataRepository } from "@application/modules/platform/ports/demo-data-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

/** الدالّتان تعيدان jsonb — نقرأ منه بحذر بدل الوثوق بشكله. */
function numberField(payload: unknown, key: string): number {
  if (typeof payload !== "object" || payload === null) return 0;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" ? value : 0;
}

export class SupabaseDemoDataRepository implements IDemoDataRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async status(): Promise<Result<DemoDataStatusDto, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("demo_data_status");
      if (error) return err(toDomainDbError(error, { entity: "النسخة الاختبارية" }));

      const entries = (data ?? []).map((row) => ({
        entity: row.entity,
        rowsCount: Number(row.rows_count ?? 0),
      }));

      return ok({
        exists: entries.length > 0,
        totalRows: entries.reduce((sum, e) => sum + e.rowsCount, 0),
        entries,
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة حالة النسخة الاختبارية"));
    }
  }

  async seed(): Promise<Result<{ trackedRows: number }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("seed_demo_data");
      if (error) return err(toDomainDbError(error, { entity: "النسخة الاختبارية" }));
      return ok({ trackedRows: numberField(data, "tracked_rows") });
    } catch (e) {
      return err(toDomainError(e, "تعذّر توليد النسخة الاختبارية"));
    }
  }

  async clear(): Promise<Result<{ removedRows: number }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("clear_demo_data");
      if (error) return err(toDomainDbError(error, { entity: "النسخة الاختبارية" }));
      return ok({ removedRows: numberField(data, "tracked_rows_removed") });
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف النسخة الاختبارية"));
    }
  }
}
