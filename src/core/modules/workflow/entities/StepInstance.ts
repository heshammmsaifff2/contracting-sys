/**
 * StepInstance — مرحلة فعلية من معاملة.
 * قاعدة الألوان [المراسلات 25] وقاعدة الدرجات [المراسلات 11] محسوبتان على
 * الخادم داخل مواعيد العمل؛ ما هنا نسخة مطابقة للعرض الفوري والتحقّق المسبق.
 */
import type { EntityId } from "../../../shared/entities/base-entity";

export type StepStatus = "pending" | "in_progress" | "done" | "cancelled";

/** ألوان صندوق الوارد الأربعة + الحياد قبل نصف المدة. */
export type InboxColor = "neutral" | "info" | "warning" | "danger" | "success";

export interface StepInstanceProps {
  id: EntityId;
  transactionId: EntityId;
  orderNo: number;
  name: string;
  assigneeId: EntityId | null;
  assigneeName: string;
  /** null = بانتظار مدير البرنامج ليحدّد المدة — العدّاد لا يبدأ قبلها. */
  allocatedMinutes: number | null;
  arrivedAt: Date | null;
  completedAt: Date | null;
  status: StepStatus;
  score: number | null;
  notes: string;
  managerNote: string;
  /** دقائق العمل المستهلكة — محسوبة على الخادم داخل الدوام. */
  elapsedMinutes: number;
  dueAt: Date | null;
}

export class StepInstance {
  readonly id: EntityId;
  readonly transactionId: EntityId;
  readonly orderNo: number;
  readonly name: string;
  readonly assigneeId: EntityId | null;
  readonly assigneeName: string;
  readonly allocatedMinutes: number | null;
  readonly arrivedAt: Date | null;
  readonly completedAt: Date | null;
  readonly status: StepStatus;
  readonly score: number | null;
  readonly notes: string;
  readonly managerNote: string;
  readonly elapsedMinutes: number;
  readonly dueAt: Date | null;

  private constructor(props: StepInstanceProps) {
    this.id = props.id;
    this.transactionId = props.transactionId;
    this.orderNo = props.orderNo;
    this.name = props.name;
    this.assigneeId = props.assigneeId;
    this.assigneeName = props.assigneeName;
    this.allocatedMinutes = props.allocatedMinutes;
    this.arrivedAt = props.arrivedAt;
    this.completedAt = props.completedAt;
    this.status = props.status;
    this.score = props.score;
    this.notes = props.notes;
    this.managerNote = props.managerNote;
    this.elapsedMinutes = props.elapsedMinutes;
    this.dueAt = props.dueAt;
    Object.freeze(this);
  }

  static restore(props: StepInstanceProps): StepInstance {
    return new StepInstance(props);
  }

  /** المدة لم تُحدَّد بعد ⇒ المعاملة واقفة عند مدير البرنامج [المراسلات 3]. */
  get isAwaitingDuration(): boolean {
    return this.allocatedMinutes === null && this.status === "in_progress";
  }

  /** نسبة الزمن المستهلك إلى المدة المخصّصة. */
  get elapsedRatio(): number | null {
    if (this.allocatedMinutes === null || this.allocatedMinutes === 0) return null;
    return this.elapsedMinutes / this.allocatedMinutes;
  }

  get remainingMinutes(): number | null {
    if (this.allocatedMinutes === null) return null;
    return this.allocatedMinutes - this.elapsedMinutes;
  }

  get isOverdue(): boolean {
    const ratio = this.elapsedRatio;
    return this.status !== "done" && ratio !== null && ratio >= 1;
  }

  /**
   * لون الحالة [المراسلات 25]:
   * أخضر = منجَزة · أحمر = انتهت المدة · أصفر = مرّ 75٪ · أزرق = مرّ نصف المدة
   */
  static colorFor(status: StepStatus, elapsedRatio: number | null): InboxColor {
    if (status === "done") return "success";
    if (elapsedRatio === null) return "neutral";
    if (elapsedRatio >= 1) return "danger";
    if (elapsedRatio >= 0.75) return "warning";
    if (elapsedRatio >= 0.5) return "info";
    return "neutral";
  }

  get color(): InboxColor {
    return StepInstance.colorFor(this.status, this.elapsedRatio);
  }

  /** صاحب المرحلة وحده يُنجزها، ما لم يملك المستخدم صلاحية التجاوز. */
  canBeCompletedBy(userId: EntityId, canOverride: boolean): boolean {
    if (this.status !== "in_progress") return false;
    if (this.allocatedMinutes === null) return false;
    return this.assigneeId === userId || canOverride;
  }
}
