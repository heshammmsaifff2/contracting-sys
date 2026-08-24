import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { SettingDto } from "@application/modules/settings/dtos";
import type { ISettingsRepository } from "@application/modules/settings/ports/settings-repository";
import type { Json } from "../database.types";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

export class SupabaseSettingsRepository implements ISettingsRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(): Promise<Result<readonly SettingDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("settings")
        .select("key, value, description, category")
        .order("category", { ascending: true })
        .order("key", { ascending: true });

      if (error) return err(toDomainDbError(error, { entity: "الإعدادات" }));

      return ok(
        (data ?? []).map((row) => ({
          key: row.key,
          value: row.value,
          description: row.description,
          category: row.category,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الإعدادات"));
    }
  }

  async update(key: string, value: unknown): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("settings")
        .update({ value: value as Json })
        .eq("key", key);

      if (error) return err(toDomainDbError(error, { entity: "الإعداد", id: key }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ الإعداد"));
    }
  }
}
