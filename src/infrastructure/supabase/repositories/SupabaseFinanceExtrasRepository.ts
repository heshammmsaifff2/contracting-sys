/**
 * الدفعات المقدّمة وخطابات الضمان وإعداد الاستقطاعات.
 * ثلاثة منافذ صغيرة في ملف واحد لأنها تشترك في الجداول المرافقة نفسها.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  GuaranteeKind,
  GuaranteeStatus,
} from "@core/modules/accounting/entities/Guarantee";
import { daysUntil } from "@core/modules/accounting/entities/Guarantee";
import type {
  AdvancePaymentDto,
  AdvanceStatus,
  DeductionTypeDto,
  GuaranteeDto,
  SaveAdvanceDto,
  SaveDeductionTypeDto,
  SaveGuaranteeDto,
} from "@application/modules/accounting/dtos/documents";
import type {
  IAdvanceRepository,
  IDeductionRepository,
  IGuaranteeRepository,
} from "@application/modules/accounting/ports/document-repositories";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const ADVANCE_SELECT = `
  id, no, contractor_id, project_id, boq_item_id, amount, status, notes, approved_at,
  contractors(name), projects(name), boq_items(name)
`;

interface AdvanceRow {
  id: string;
  no: number;
  contractor_id: string;
  project_id: string;
  boq_item_id: string | null;
  amount: number;
  status: string;
  notes: string;
  approved_at: string | null;
  contractors: { name: string } | null;
  projects: { name: string } | null;
  boq_items: { name: string } | null;
}

const ADVANCE_STATUSES: readonly AdvanceStatus[] = [
  "draft",
  "approved",
  "paid",
  "cancelled",
];

function toAdvanceDto(row: AdvanceRow): AdvancePaymentDto {
  return {
    id: row.id,
    no: row.no,
    contractorId: row.contractor_id,
    contractorName: row.contractors?.name ?? "",
    projectId: row.project_id,
    projectName: row.projects?.name ?? "",
    boqItemId: row.boq_item_id,
    boqName: row.boq_items?.name ?? "",
    amount: Number(row.amount),
    status: ADVANCE_STATUSES.find((s) => s === row.status) ?? "draft",
    notes: row.notes,
    approvedAt: row.approved_at,
  };
}

export class SupabaseAdvanceRepository implements IAdvanceRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(
    projectId: string | null,
  ): Promise<Result<readonly AdvancePaymentDto[], DomainError>> {
    try {
      let query = this.client
        .from("advance_payments")
        .select(ADVANCE_SELECT)
        .order("no", { ascending: false });

      if (projectId !== null && projectId !== "") {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query.overrideTypes<AdvanceRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "الدفعات المقدّمة" }));
      return ok((data ?? []).map(toAdvanceDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الدفعات المقدّمة"));
    }
  }

  async save(input: SaveAdvanceDto): Promise<Result<AdvancePaymentDto, DomainError>> {
    try {
      const payload = {
        contractor_id: input.contractorId,
        project_id: input.projectId,
        boq_item_id: input.boqItemId,
        amount: input.amount,
        notes: input.notes,
      };

      const request =
        input.id === null
          ? this.client.from("advance_payments").insert(payload)
          : this.client.from("advance_payments").update(payload).eq("id", input.id);

      const { data, error } = await request
        .select(ADVANCE_SELECT)
        .single()
        .overrideTypes<AdvanceRow>();

      if (error)
        return err(toDomainDbError(error, { entity: "الدفعة", id: input.id ?? "" }));
      return ok(toAdvanceDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ الدفعة"));
    }
  }

  async approve(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("approve_advance_payment", {
        p_advance_id: id,
      });

      if (error) return err(toDomainDbError(error, { entity: "الدفعة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر اعتماد الدفعة"));
    }
  }
}

// ── الضمانات ────────────────────────────────────────────────────────────
const GUARANTEE_SELECT = `
  id, project_id, contractor_id, kind, reference_no, bank_name, amount,
  issued_at, expires_at, status, note,
  projects(name), contractors(name)
`;

interface GuaranteeRow {
  id: string;
  project_id: string;
  contractor_id: string | null;
  kind: string;
  reference_no: string;
  bank_name: string;
  amount: number;
  issued_at: string;
  expires_at: string;
  status: string;
  note: string;
  projects: { name: string } | null;
  contractors: { name: string } | null;
}

const KINDS: readonly GuaranteeKind[] = ["initial", "final", "maintenance", "advance"];
const GUARANTEE_STATUSES: readonly GuaranteeStatus[] = [
  "active",
  "released",
  "expired",
];

function toGuaranteeDto(row: GuaranteeRow): GuaranteeDto {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.projects?.name ?? "",
    contractorId: row.contractor_id,
    contractorName: row.contractors?.name ?? "",
    kind: KINDS.find((k) => k === row.kind) ?? "final",
    referenceNo: row.reference_no,
    bankName: row.bank_name,
    amount: Number(row.amount),
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    status: GUARANTEE_STATUSES.find((s) => s === row.status) ?? "active",
    note: row.note,
    daysLeft: daysUntil(row.expires_at),
  };
}

export class SupabaseGuaranteeRepository implements IGuaranteeRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(
    projectId: string | null,
  ): Promise<Result<readonly GuaranteeDto[], DomainError>> {
    try {
      let query = this.client
        .from("guarantees")
        .select(GUARANTEE_SELECT)
        .order("expires_at");

      if (projectId !== null && projectId !== "") {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query.overrideTypes<GuaranteeRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "خطابات الضمان" }));
      return ok((data ?? []).map(toGuaranteeDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة خطابات الضمان"));
    }
  }

  async save(input: SaveGuaranteeDto): Promise<Result<GuaranteeDto, DomainError>> {
    try {
      const payload = {
        project_id: input.projectId,
        contractor_id: input.contractorId,
        kind: input.kind,
        reference_no: input.referenceNo,
        bank_name: input.bankName,
        amount: input.amount,
        issued_at: input.issuedAt,
        expires_at: input.expiresAt,
        status: input.status,
        note: input.note,
      };

      const request =
        input.id === null
          ? this.client.from("guarantees").insert(payload)
          : this.client.from("guarantees").update(payload).eq("id", input.id);

      const { data, error } = await request
        .select(GUARANTEE_SELECT)
        .single()
        .overrideTypes<GuaranteeRow>();

      if (error)
        return err(
          toDomainDbError(error, { entity: "خطاب الضمان", id: input.id ?? "" }),
        );
      return ok(toGuaranteeDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ خطاب الضمان"));
    }
  }

  async remove(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("guarantees").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "خطاب الضمان", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف خطاب الضمان"));
    }
  }
}

// ── الاستقطاعات ─────────────────────────────────────────────────────────
interface DeductionRow {
  id: string;
  key: string;
  name: string;
  rate: number;
  applies_to: string;
  account_code: string;
  is_active: boolean;
  sort_order: number;
  description: string;
  accounts: { name: string } | null;
}

const DEDUCTION_SELECT = `
  id, key, name, rate, applies_to, account_code, is_active, sort_order, description,
  accounts(name)
`;

function toDeductionDto(row: DeductionRow): DeductionTypeDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    rate: Number(row.rate),
    appliesTo: row.applies_to === "advance" ? "advance" : "extract",
    accountCode: row.account_code,
    accountName: row.accounts?.name ?? "",
    isActive: row.is_active,
    sortOrder: row.sort_order,
    description: row.description,
  };
}

export class SupabaseDeductionRepository implements IDeductionRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(): Promise<Result<readonly DeductionTypeDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("deduction_types")
        .select(DEDUCTION_SELECT)
        .order("sort_order")
        .overrideTypes<DeductionRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "الاستقطاعات" }));
      return ok((data ?? []).map(toDeductionDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الاستقطاعات"));
    }
  }

  async save(
    input: SaveDeductionTypeDto,
  ): Promise<Result<DeductionTypeDto, DomainError>> {
    try {
      const payload = {
        key: input.key,
        name: input.name,
        rate: input.rate,
        applies_to: input.appliesTo,
        account_code: input.accountCode,
        is_active: input.isActive,
        sort_order: input.sortOrder,
        description: input.description,
      };

      const request =
        input.id === null
          ? this.client.from("deduction_types").upsert(payload, { onConflict: "key" })
          : this.client.from("deduction_types").update(payload).eq("id", input.id);

      const { data, error } = await request
        .select(DEDUCTION_SELECT)
        .single()
        .overrideTypes<DeductionRow>();

      if (error)
        return err(toDomainDbError(error, { entity: "الاستقطاع", id: input.id ?? "" }));
      return ok(toDeductionDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ الاستقطاع"));
    }
  }
}
