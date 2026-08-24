/**
 * MaterialRequest — طلب الاحتياج.
 * القاعدة المحورية [المشتريات 2]: النظام يجمع المطلوب سابقًا مع الحالي
 * ثم يطرحه من الحد الأقصى ليُخرج المتبقّي — بلا إدخال يدوي.
 * الحساب النهائي يقع في Postgres؛ هذه النسخة تسمح للواجهة بالتحقّق فورًا
 * قبل إرسال الطلب، وتكشف تجاوز الحد قبل أن يرفضه الخادم.
 */
import {
  AuditableEntity,
  type AuditableEntityProps,
  type EntityId,
} from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";

export type MaterialRequestStatus =
  "draft" | "submitted" | "approved" | "rejected" | "converted" | "cancelled";

export const MATERIAL_REQUEST_STATUSES: readonly MaterialRequestStatus[] = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "converted",
  "cancelled",
];

export interface MaterialRequestLine {
  id: EntityId;
  itemId: EntityId;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  requestedQty: number;
  /** null = المكتب الفني لم يضع حدًّا لهذا الصنف في هذا المشروع. */
  maxQty: number | null;
  prevRequestedQty: number;
  remainingBalance: number | null;
}

export interface MaterialRequestProps extends AuditableEntityProps {
  no: number;
  projectId: EntityId;
  projectName: string;
  status: MaterialRequestStatus;
  notes: string;
  mergedGroupId: EntityId | null;
  lines: readonly MaterialRequestLine[];
}

export class MaterialRequest extends AuditableEntity {
  readonly no: number;
  readonly projectId: EntityId;
  readonly projectName: string;
  readonly status: MaterialRequestStatus;
  readonly notes: string;
  readonly mergedGroupId: EntityId | null;
  readonly lines: readonly MaterialRequestLine[];

  private constructor(props: MaterialRequestProps) {
    super(props);
    this.no = props.no;
    this.projectId = props.projectId;
    this.projectName = props.projectName;
    this.status = props.status;
    this.notes = props.notes;
    this.mergedGroupId = props.mergedGroupId;
    this.lines = props.lines;
  }

  static restore(props: MaterialRequestProps): MaterialRequest {
    return new MaterialRequest(props);
  }

  /**
   * يحسب المتبقّي لسطر واحد: الحد الأقصى − (السابق + الحالي).
   * null إذا لم يضع المكتب الفني حدًّا لهذا الصنف.
   */
  static computeRemaining(
    maxQty: number | null,
    prevRequestedQty: number,
    requestedQty: number,
  ): number | null {
    if (maxQty === null) return null;
    return maxQty - (prevRequestedQty + requestedQty);
  }

  /** التحقّق من كمية مطلوبة قبل إرسالها للخادم. */
  static validateLineQuantity(
    requestedQty: number,
    maxQty: number | null,
    prevRequestedQty: number,
  ): Result<number, ValidationError> {
    if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
      return err(
        new ValidationError("الكمية المطلوبة يجب أن تكون أكبر من صفر", {
          requestedQty: "invalid",
        }),
      );
    }

    const remaining = MaterialRequest.computeRemaining(
      maxQty,
      prevRequestedQty,
      requestedQty,
    );

    if (remaining !== null && remaining < 0) {
      return err(
        new ValidationError(
          "الكمية تتجاوز الحد الأقصى المعتمد من المكتب الفني لهذا الصنف",
          { requestedQty: "exceeds_max" },
        ),
      );
    }

    return ok(requestedQty);
  }

  /** هل يمكن اعتماده؟ لا يُعتمد إلا المسودّة أو المُرسَل. */
  get canBeApproved(): boolean {
    return this.status === "draft" || this.status === "submitted";
  }

  /** لا يُحوَّل لطلب شراء إلا المعتمد. */
  get canBeConverted(): boolean {
    return this.status === "approved";
  }

  /** أسطر تجاوزت الحد — تُبرز في الواجهة قبل الإرسال. */
  get overLimitLines(): readonly MaterialRequestLine[] {
    return this.lines.filter(
      (line) => line.remainingBalance !== null && line.remainingBalance < 0,
    );
  }

  get hasOverLimitLines(): boolean {
    return this.overLimitLines.length > 0;
  }
}
