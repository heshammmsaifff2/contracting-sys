import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type {
  PaymentPartyType,
  PaymentStatus,
} from "@core/modules/procurement/entities/PaymentRequest";
import type {
  PaymentRequestDto,
  TransferPaymentDto,
} from "@application/modules/procurement/dtos";
import type { IPaymentRepository } from "@application/modules/procurement/ports/payment-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

/**
 * القراءة من العرض `payment_request_details` لا من الجدول.
 *
 * السبب أن `party_id` عمود متعدّد الأنواع بلا مفتاح أجنبي — قد يكون مورّدًا
 * أو مقاولًا أو عاملًا — وPostgREST لا يستطيع تضمين جدول بلا علاقة معرَّفة.
 * العرض يحلّ الاسم في SQL بشرط على `party_type`، فيصحّ لكل الأطراف لا
 * للمورّدين وحدهم.
 */
const SELECT = `
  id, no, source_type, source_id, party_type, party_id,
  party_name, party_code,
  supplier_bank_account_id, bank_name, account_no,
  project_id, project_name, amount,
  bank_fee_company, bank_fee_client, status, transferred_at
`;

interface PaymentRow {
  id: string;
  no: number;
  source_type: string;
  source_id: string;
  party_type: string;
  party_id: string;
  party_name: string | null;
  party_code: string | null;
  supplier_bank_account_id: string | null;
  bank_name: string | null;
  account_no: string | null;
  project_id: string | null;
  project_name: string | null;
  amount: number;
  bank_fee_company: number;
  bank_fee_client: number;
  status: string;
  transferred_at: string | null;
}

const PARTY_TYPES: readonly PaymentPartyType[] = [
  "supplier",
  "contractor",
  "worker",
  "employee",
];
const STATUSES: readonly PaymentStatus[] = [
  "pending",
  "approved",
  "transferred",
  "cancelled",
];

function toDto(row: PaymentRow): PaymentRequestDto {
  return {
    id: row.id,
    no: row.no,
    sourceType: row.source_type,
    sourceId: row.source_id,
    partyType: PARTY_TYPES.includes(row.party_type as PaymentPartyType)
      ? (row.party_type as PaymentPartyType)
      : "supplier",
    partyId: row.party_id,
    partyName: row.party_name ?? "",
    bankAccountId: row.supplier_bank_account_id,
    bankName: row.bank_name,
    accountNo: row.account_no,
    projectId: row.project_id,
    projectName: row.project_name,
    amount: Number(row.amount),
    bankFeeCompany: Number(row.bank_fee_company),
    bankFeeClient: Number(row.bank_fee_client),
    status: STATUSES.includes(row.status as PaymentStatus)
      ? (row.status as PaymentStatus)
      : "pending",
    transferredAt: row.transferred_at,
  };
}

export class SupabasePaymentRepository implements IPaymentRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(): Promise<Result<readonly PaymentRequestDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("payment_request_details")
        .select(SELECT)
        .order("no", { ascending: false })
        .overrideTypes<PaymentRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "طلبات الدفع" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة طلبات الدفع"));
    }
  }

  async findById(id: string): Promise<Result<PaymentRequestDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("payment_request_details")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<PaymentRow>();

      if (error) return err(toDomainDbError(error, { entity: "طلب الدفع", id }));
      if (data === null) return ok(null);
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة طلب الدفع"));
    }
  }

  /**
   * يُسجّل التحويل. الشرط `.neq("status", ...)` يمنع التحويل المزدوج
   * حتى لو ضُغط الزر مرتين في آن واحد.
   *
   * الكتابة على الجدول ثم القراءة من العرض: أعمدة الأسماء ليست في الجدول،
   * فلا يصحّ طلبها في `select` الخاص بالتحديث.
   */
  async markTransferred(
    input: TransferPaymentDto,
  ): Promise<Result<PaymentRequestDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("payment_requests")
        .update({
          status: "transferred",
          transferred_at: new Date().toISOString(),
          bank_fee_company: input.bankFeeCompany,
          bank_fee_client: input.bankFeeClient,
        })
        .eq("id", input.id)
        .neq("status", "transferred")
        .select("id")
        .single();

      if (error)
        return err(toDomainDbError(error, { entity: "طلب الدفع", id: input.id }));

      const reloaded = await this.findById(data.id);
      if (!reloaded.ok) return reloaded;
      if (reloaded.value === null) {
        return err(
          toDomainError(
            new Error("payment request vanished after update"),
            "تعذّر قراءة طلب الدفع بعد تسجيل التحويل",
          ),
        );
      }
      return ok(reloaded.value);
    } catch (e) {
      return err(toDomainError(e, "تعذّر تسجيل التحويل"));
    }
  }
}
