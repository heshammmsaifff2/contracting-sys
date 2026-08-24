/**
 * PaymentRequest — طلب الدفع.
 * ضغط «تم التحويل» يُطلق قيد الصرف وذمم المورّد آليًا [المشتريات 4].
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import type { Money } from "../../../shared/value-objects/money";

export type PaymentPartyType = "supplier" | "contractor" | "worker" | "employee";
export type PaymentStatus = "pending" | "approved" | "transferred" | "cancelled";
export type PaymentBatchKind = "grouped" | "deferred" | "cheque" | "single";

export interface PaymentRequestProps {
  id: EntityId;
  no: number;
  sourceType: string;
  sourceId: EntityId;
  partyType: PaymentPartyType;
  partyId: EntityId;
  partyName: string;
  bankAccountId: EntityId | null;
  bankName: string | null;
  accountNo: string | null;
  projectId: EntityId | null;
  projectName: string | null;
  amount: Money;
  bankFeeCompany: Money;
  bankFeeClient: Money;
  status: PaymentStatus;
  transferredAt: Date | null;
  notes: string;
}

export class PaymentRequest {
  readonly id: EntityId;
  readonly no: number;
  readonly sourceType: string;
  readonly sourceId: EntityId;
  readonly partyType: PaymentPartyType;
  readonly partyId: EntityId;
  readonly partyName: string;
  readonly bankAccountId: EntityId | null;
  readonly bankName: string | null;
  readonly accountNo: string | null;
  readonly projectId: EntityId | null;
  readonly projectName: string | null;
  readonly amount: Money;
  readonly bankFeeCompany: Money;
  readonly bankFeeClient: Money;
  readonly status: PaymentStatus;
  readonly transferredAt: Date | null;
  readonly notes: string;

  private constructor(props: PaymentRequestProps) {
    this.id = props.id;
    this.no = props.no;
    this.sourceType = props.sourceType;
    this.sourceId = props.sourceId;
    this.partyType = props.partyType;
    this.partyId = props.partyId;
    this.partyName = props.partyName;
    this.bankAccountId = props.bankAccountId;
    this.bankName = props.bankName;
    this.accountNo = props.accountNo;
    this.projectId = props.projectId;
    this.projectName = props.projectName;
    this.amount = props.amount;
    this.bankFeeCompany = props.bankFeeCompany;
    this.bankFeeClient = props.bankFeeClient;
    this.status = props.status;
    this.transferredAt = props.transferredAt;
    this.notes = props.notes;
    Object.freeze(this);
  }

  static restore(props: PaymentRequestProps): PaymentRequest {
    return new PaymentRequest(props);
  }

  /** لا يُحوَّل بلا حساب بنكي مستدعى، ولا يُحوَّل مرتين. */
  get canBeTransferred(): boolean {
    return this.status === "pending" || this.status === "approved";
  }

  get isMissingBankAccount(): boolean {
    return this.bankAccountId === null;
  }

  /** ما يُخصم من البنك فعلًا: المبلغ + ما تتحمّله الشركة من مصاريف. */
  get bankOutflow(): Money {
    const total = this.amount.add(this.bankFeeCompany);
    return total.ok ? total.value : this.amount;
  }

  /** ما يصل المستفيد: المبلغ ناقص ما يتحمّله من مصاريف. */
  get beneficiaryNet(): Money {
    const net = this.amount.subtract(this.bankFeeClient);
    return net.ok ? net.value : this.amount;
  }
}
