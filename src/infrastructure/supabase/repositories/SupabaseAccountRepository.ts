import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { AccountType } from "@core/modules/accounting/entities/Account";
import { ACCOUNT_TYPES } from "@core/modules/accounting/entities/Account";
import type { AccountDto, PostingRuleDto } from "@application/modules/accounting/dtos";
import type { IAccountRepository } from "@application/modules/accounting/ports/account-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_id: string | null;
  is_postable: boolean;
  is_active: boolean;
}

function toAccountType(raw: string): AccountType {
  return ACCOUNT_TYPES.includes(raw as AccountType) ? (raw as AccountType) : "asset";
}

/**
 * يرتّب الحسابات هرميًا (أب ثم أبناؤه) ويحسب عمق كل حساب للعرض المتدرّج.
 * الترتيب بالكود يكفي لأن الأكواد رقمية متداخلة (1 ← 11 ← 1101).
 */
function toTree(rows: readonly AccountRow[]): AccountDto[] {
  const byParent = new Map<string | null, AccountRow[]>();
  for (const row of rows) {
    const siblings = byParent.get(row.parent_id) ?? [];
    siblings.push(row);
    byParent.set(row.parent_id, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.code.localeCompare(b.code));
  }

  const ordered: AccountDto[] = [];
  const walk = (parentId: string | null, depth: number): void => {
    for (const row of byParent.get(parentId) ?? []) {
      ordered.push({
        id: row.id,
        code: row.code,
        name: row.name,
        type: toAccountType(row.type),
        parentId: row.parent_id,
        isPostable: row.is_postable,
        isActive: row.is_active,
        depth,
      });
      walk(row.id, depth + 1);
    }
  };
  walk(null, 0);

  return ordered;
}

export class SupabaseAccountRepository implements IAccountRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async listTree(): Promise<Result<readonly AccountDto[], DomainError>> {
    const rows = await this.fetchRows();
    if (!rows.ok) return rows;
    return ok(toTree(rows.value));
  }

  async listPostable(): Promise<Result<readonly AccountDto[], DomainError>> {
    const rows = await this.fetchRows();
    if (!rows.ok) return rows;
    return ok(toTree(rows.value).filter((a) => a.isPostable && a.isActive));
  }

  async listPostingRules(): Promise<Result<readonly PostingRuleDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("posting_rules")
        .select(
          "id, source_type, debit_account_code, credit_account_code, description, is_active",
        )
        .order("source_type", { ascending: true });

      if (error) return err(toDomainDbError(error, { entity: "قواعد الترحيل" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          sourceType: row.source_type,
          debitAccountCode: row.debit_account_code,
          creditAccountCode: row.credit_account_code,
          description: row.description,
          isActive: row.is_active,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة قواعد الترحيل"));
    }
  }

  private async fetchRows(): Promise<Result<readonly AccountRow[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("accounts")
        .select("id, code, name, type, parent_id, is_postable, is_active")
        .order("code", { ascending: true });

      if (error) return err(toDomainDbError(error, { entity: "شجرة الحسابات" }));
      return ok(data ?? []);
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة شجرة الحسابات"));
    }
  }
}
