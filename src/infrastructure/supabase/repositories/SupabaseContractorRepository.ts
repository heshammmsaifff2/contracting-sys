import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  ContractItemDto,
  ContractorBalanceDto,
  ContractorDto,
  SaveContractItemDto,
  SaveContractorDto,
} from "@application/modules/accounting/dtos/documents";
import type { IContractorRepository } from "@application/modules/accounting/ports/document-repositories";
import type { Json } from "../database.types";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

interface ContractorRow {
  id: string;
  code: string;
  name: string;
  contact: Json;
  bank: Json;
  is_active: boolean;
}

function readJsonField(source: Json, key: string): string | null {
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    return null;
  }
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value !== "" ? value : null;
}

function toDto(row: ContractorRow): ContractorDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: readJsonField(row.contact, "phone"),
    email: readJsonField(row.contact, "email"),
    bankName: readJsonField(row.bank, "bank_name"),
    accountNo: readJsonField(row.bank, "account_no"),
    iban: readJsonField(row.bank, "iban"),
    isActive: row.is_active,
  };
}

function toContactJson(input: SaveContractorDto): Json {
  return {
    ...(input.phone === null ? {} : { phone: input.phone }),
    ...(input.email === null ? {} : { email: input.email }),
  };
}

function toBankJson(input: SaveContractorDto): Json {
  return {
    ...(input.bankName === null ? {} : { bank_name: input.bankName }),
    ...(input.accountNo === null ? {} : { account_no: input.accountNo }),
    ...(input.iban === null ? {} : { iban: input.iban }),
  };
}

const COLUMNS = "id, code, name, contact, bank, is_active";

const CONTRACT_SELECT = `
  id, project_id, contractor_id, boq_item_id, unit_price, max_qty, notes,
  projects(name),
  boq_items(code, name, unit)
`;

interface ContractRow {
  id: string;
  project_id: string;
  contractor_id: string;
  boq_item_id: string;
  unit_price: number;
  max_qty: number;
  notes: string;
  projects: { name: string } | null;
  boq_items: { code: string; name: string; unit: string } | null;
}

export class SupabaseContractorRepository implements IContractorRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /** البحث بالتطبيع العربي نفسه المستخدم في الأصناف والموردين. */
  async search(query: string): Promise<Result<readonly ContractorDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .rpc("search_contractors", { p_query: query })
        .select(COLUMNS)
        .overrideTypes<ContractorRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "المقاولون" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر البحث في المقاولين"));
    }
  }

  async save(input: SaveContractorDto): Promise<Result<ContractorDto, DomainError>> {
    try {
      const payload = {
        code: input.code,
        name: input.name,
        contact: toContactJson(input),
        bank: toBankJson(input),
        is_active: input.isActive,
      };

      const request =
        input.id === null
          ? this.client.from("contractors").insert(payload)
          : this.client.from("contractors").update(payload).eq("id", input.id);

      const { data, error } = await request
        .select(COLUMNS)
        .single()
        .overrideTypes<ContractorRow>();

      if (error)
        return err(toDomainDbError(error, { entity: "المقاول", id: input.id ?? "" }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المقاول"));
    }
  }

  /**
   * بنود التعاقد مع المنفَّذ منها: المنفَّذ مجموع الكميات في المستخلصات
   * المعتمدة، فيظهر للمستخدم ما بقي قبل أن يفتح مستخلصًا جديدًا.
   */
  async listContractItems(
    contractorId: string,
    projectId: string | null,
  ): Promise<Result<readonly ContractItemDto[], DomainError>> {
    try {
      let query = this.client
        .from("contractor_boq_contracts")
        .select(CONTRACT_SELECT)
        .eq("contractor_id", contractorId);

      if (projectId !== null && projectId !== "") {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query.overrideTypes<ContractRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "بنود التعاقد" }));

      const rows = data ?? [];
      const executed = await this.executedQuantities(contractorId, projectId);
      if (!executed.ok) return executed;

      return ok(
        rows.map((row) => ({
          id: row.id,
          projectId: row.project_id,
          projectName: row.projects?.name ?? "",
          contractorId: row.contractor_id,
          boqItemId: row.boq_item_id,
          boqCode: row.boq_items?.code ?? "",
          boqName: row.boq_items?.name ?? "",
          boqUnit: row.boq_items?.unit ?? "",
          unitPrice: Number(row.unit_price),
          maxQty: Number(row.max_qty),
          executedQty: executed.value.get(`${row.project_id}:${row.boq_item_id}`) ?? 0,
          notes: row.notes,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة بنود التعاقد"));
    }
  }

  async saveContractItem(
    input: SaveContractItemDto,
  ): Promise<Result<ContractItemDto, DomainError>> {
    try {
      const payload = {
        project_id: input.projectId,
        contractor_id: input.contractorId,
        boq_item_id: input.boqItemId,
        unit_price: input.unitPrice,
        max_qty: input.maxQty,
        notes: input.notes,
      };

      const request =
        input.id === null
          ? this.client
              .from("contractor_boq_contracts")
              .upsert(payload, { onConflict: "project_id,contractor_id,boq_item_id" })
          : this.client
              .from("contractor_boq_contracts")
              .update(payload)
              .eq("id", input.id);

      const { data, error } = await request
        .select(CONTRACT_SELECT)
        .single()
        .overrideTypes<ContractRow>();

      if (error)
        return err(
          toDomainDbError(error, { entity: "بند التعاقد", id: input.id ?? "" }),
        );

      return ok({
        id: data.id,
        projectId: data.project_id,
        projectName: data.projects?.name ?? "",
        contractorId: data.contractor_id,
        boqItemId: data.boq_item_id,
        boqCode: data.boq_items?.code ?? "",
        boqName: data.boq_items?.name ?? "",
        boqUnit: data.boq_items?.unit ?? "",
        unitPrice: Number(data.unit_price),
        maxQty: Number(data.max_qty),
        executedQty: 0,
        notes: data.notes,
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ بند التعاقد"));
    }
  }

  async removeContractItem(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("contractor_boq_contracts")
        .delete()
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "بند التعاقد", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف بند التعاقد"));
    }
  }

  async balances(
    projectId: string | null,
  ): Promise<Result<readonly ContractorBalanceDto[], DomainError>> {
    try {
      let query = this.client
        .from("contractor_balances")
        .select("*")
        .order("contractor_name");

      if (projectId !== null && projectId !== "") {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "مديونية المقاولين" }));

      return ok(
        (data ?? []).map((row) => {
          const net = Number(row.net_total ?? 0);
          const paid = Number(row.paid_total ?? 0);
          return {
            contractorId: row.contractor_id ?? "",
            contractorCode: row.contractor_code ?? "",
            contractorName: row.contractor_name ?? "",
            projectId: row.project_id ?? "",
            projectName: row.project_name ?? "",
            extractsCount: Number(row.extracts_count ?? 0),
            grossTotal: Number(row.gross_total ?? 0),
            deductionsTotal: Number(row.deductions_total ?? 0),
            netTotal: net,
            paidTotal: paid,
            outstanding: Math.round((net - paid) * 100) / 100,
          };
        }),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة مديونية المقاولين"));
    }
  }

  /** مجموع المنفَّذ لكل بند في المستخلصات المعتمدة. */
  private async executedQuantities(
    contractorId: string,
    projectId: string | null,
  ): Promise<Result<Map<string, number>, DomainError>> {
    try {
      let query = this.client
        .from("extracts")
        .select("project_id, status, extract_lines(boq_item_id, current_qty)")
        .eq("contractor_id", contractorId)
        .in("status", ["approved", "paid"]);

      if (projectId !== null && projectId !== "") {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query.overrideTypes<
        {
          project_id: string;
          status: string;
          extract_lines: { boq_item_id: string; current_qty: number }[] | null;
        }[]
      >();

      if (error) return err(toDomainDbError(error, { entity: "المستخلصات" }));

      const totals = new Map<string, number>();
      for (const row of data ?? []) {
        for (const line of row.extract_lines ?? []) {
          const key = `${row.project_id}:${line.boq_item_id}`;
          totals.set(key, (totals.get(key) ?? 0) + Number(line.current_qty));
        }
      }
      return ok(totals);
    } catch (e) {
      return err(toDomainError(e, "تعذّر حساب المنفَّذ من بنود التعاقد"));
    }
  }
}
