/**
 * SupplyOrder — أمر التوريد.
 * الضريبة بند منفصل قبل السداد [المشتريات 12]، ونسبتها تأتي من جدول
 * الإعدادات لا من ثابت في الكود.
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Money, type CurrencyCode } from "../../../shared/value-objects/money";

export type SupplyOrderStatus = "draft" | "approved" | "received" | "cancelled";

export interface SupplyOrderLine {
  id: EntityId;
  itemId: EntityId;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  projectId: EntityId;
  projectName: string;
  qty: number;
  unitPrice: number;
}

export interface SupplyOrderProps {
  id: EntityId;
  no: number;
  purchaseRequestId: EntityId;
  supplierId: EntityId;
  supplierCode: string;
  supplierName: string;
  subtotal: Money;
  vatRate: number;
  vatAmount: Money;
  total: Money;
  status: SupplyOrderStatus;
  notes: string;
  lines: readonly SupplyOrderLine[];
}

export class SupplyOrder {
  readonly id: EntityId;
  readonly no: number;
  readonly purchaseRequestId: EntityId;
  readonly supplierId: EntityId;
  readonly supplierCode: string;
  readonly supplierName: string;
  readonly subtotal: Money;
  readonly vatRate: number;
  readonly vatAmount: Money;
  readonly total: Money;
  readonly status: SupplyOrderStatus;
  readonly notes: string;
  readonly lines: readonly SupplyOrderLine[];

  private constructor(props: SupplyOrderProps) {
    this.id = props.id;
    this.no = props.no;
    this.purchaseRequestId = props.purchaseRequestId;
    this.supplierId = props.supplierId;
    this.supplierCode = props.supplierCode;
    this.supplierName = props.supplierName;
    this.subtotal = props.subtotal;
    this.vatRate = props.vatRate;
    this.vatAmount = props.vatAmount;
    this.total = props.total;
    this.status = props.status;
    this.notes = props.notes;
    this.lines = props.lines;
    Object.freeze(this);
  }

  static restore(props: SupplyOrderProps): SupplyOrder {
    return new SupplyOrder(props);
  }

  /**
   * يحسب الصافي والضريبة والإجمالي من الأسطر ونسبة الضريبة.
   * نسخة مطابقة لما يفعله الخادم — تُستخدم للعرض الفوري قبل الحفظ.
   */
  static computeTotals(
    lines: readonly { qty: number; unitPrice: number }[],
    vatRate: number,
    currency: CurrencyCode,
  ): Result<{ subtotal: Money; vat: Money; total: Money }, ValidationError> {
    if (!Number.isFinite(vatRate) || vatRate < 0) {
      return err(new ValidationError("نسبة الضريبة غير صالحة", { vatRate: "invalid" }));
    }

    const rawSubtotal = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);

    const subtotal = Money.create(rawSubtotal, currency);
    if (!subtotal.ok) return subtotal;

    const vat = subtotal.value.percentage(vatRate);
    if (!vat.ok) return vat;

    const total = subtotal.value.add(vat.value);
    if (!total.ok) return total;

    return ok({ subtotal: subtotal.value, vat: vat.value, total: total.value });
  }

  /** لا يُستلَم ولا يُدفع إلا المعتمَد. */
  get canBeApproved(): boolean {
    return this.status === "draft";
  }

  get canGenerateReceipts(): boolean {
    return this.status === "approved";
  }

  get canGeneratePayment(): boolean {
    return this.status === "approved" || this.status === "received";
  }

  /** المشاريع المستفيدة — أمر التوريد قد يخدم عدّة مشاريع بعد الدمج. */
  get projectIds(): readonly EntityId[] {
    return [...new Set(this.lines.map((line) => line.projectId))];
  }

  get isMultiProject(): boolean {
    return this.projectIds.length > 1;
  }
}
