import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { OpeningBalanceStatus } from "@core/modules/accounting/entities/OpeningBalance";
import type {
  CreateOpeningBalanceDto,
  OpeningBalanceDto,
} from "@application/modules/accounting/dtos";
import type { IOpeningBalanceRepository } from "@application/modules/accounting/ports/opening-balance-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT_WITH_RELATIONS = `
  id, account_id, project_id, amount, as_of, status, notes,
  accounts(code, name), projects(name)
`;

interface OpeningBalanceRow {
  id: string;
  account_id: string;
  project_id: string | null;
  amount: number;
  as_of: string;
  status: string;
  notes: string;
  accounts: { code: string; name: string } | null;
  projects: { name: string } | null;
}

function toDto(row: OpeningBalanceRow): OpeningBalanceDto {
  return {
    id: row.id,
    accountId: row.account_id,
    accountCode: row.accounts?.code ?? "",
    accountName: row.accounts?.name ?? "",
    projectId: row.project_id,
    projectName: row.projects?.name ?? null,
    amount: Number(row.amount),
    asOf: row.as_of,
    status: row.status === "approved" ? "approved" : ("draft" as OpeningBalanceStatus),
    notes: row.notes,
  };
}

export class SupabaseOpeningBalanceRepository implements IOpeningBalanceRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(): Promise<Result<readonly OpeningBalanceDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("opening_balances")
        .select(SELECT_WITH_RELATIONS)
        .order("as_of", { ascending: false })
        .overrideTypes<OpeningBalanceRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "الأرصدة الافتتاحية" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الأرصدة الافتتاحية"));
    }
  }

  async findById(id: string): Promise<Result<OpeningBalanceDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("opening_balances")
        .select(SELECT_WITH_RELATIONS)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<OpeningBalanceRow>();

      if (error) return err(toDomainDbError(error, { entity: "الرصيد الافتتاحي", id }));
      if (data === null) return ok(null);
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الرصيد الافتتاحي"));
    }
  }

  async create(
    input: CreateOpeningBalanceDto,
  ): Promise<Result<OpeningBalanceDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("opening_balances")
        .insert({
          account_id: input.accountId,
          project_id: input.projectId,
          amount: input.amount,
          as_of: input.asOf,
          notes: input.notes,
        })
        .select(SELECT_WITH_RELATIONS)
        .single()
        .overrideTypes<OpeningBalanceRow>();

      if (error) return err(toDomainDbError(error, { entity: "الرصيد الافتتاحي" }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنشاء الرصيد الافتتاحي"));
    }
  }

  /** الاعتماد شرط لازم للترحيل — الدالة في Postgres ترفض غير المعتمَد. */
  async approve(id: string): Promise<Result<OpeningBalanceDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("opening_balances")
        .update({ status: "approved" })
        .eq("id", id)
        .eq("status", "draft")
        .select(SELECT_WITH_RELATIONS)
        .single()
        .overrideTypes<OpeningBalanceRow>();

      if (error) return err(toDomainDbError(error, { entity: "الرصيد الافتتاحي", id }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر اعتماد الرصيد الافتتاحي"));
    }
  }

  async remove(id: string): Promise<Result<void, DomainError>> {
    try {
      // المعتمَد له قيد مرحَّل، فلا يُحذف
      const { error } = await this.client
        .from("opening_balances")
        .delete()
        .eq("id", id)
        .eq("status", "draft");

      if (error) return err(toDomainDbError(error, { entity: "الرصيد الافتتاحي", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف الرصيد الافتتاحي"));
    }
  }
}
