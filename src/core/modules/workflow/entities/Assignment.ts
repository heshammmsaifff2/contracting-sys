/**
 * Assignment — تكليف موظف واحد بمرحلة.
 *
 * المرحلة قد تقف عند أكثر من موظف، فالمدة والعدّاد والدرجة تخصّ التكليف لا
 * المرحلة: خمسة مشاركين على مرحلة واحدة يعطون خمس درجات مستقلة
 * [المراسلات 11-18].
 *
 * قاعدة الألوان [المراسلات 25] وقاعدة الدرجات [المراسلات 11] محسوبتان على
 * الخادم داخل مواعيد العمل؛ ما هنا نسخة مطابقة للعرض الفوري والتحقّق المسبق.
 */
import type { EntityId } from "../../../shared/entities/base-entity";

/**
 * `on_hold` = مؤهَّل لكنّ زميلًا حجز المرحلة [المرحلة ٠٧].
 * يُميَّز عن `cancelled` لأن الملغى لا يعود، والمعلَّق ينتظر إطلاق الحجز.
 */
export type AssignmentStatus =
  "pending" | "in_progress" | "on_hold" | "done" | "cancelled";

/** ألوان صندوق الوارد الأربعة + الحياد قبل نصف المدة. */
export type InboxColor = "neutral" | "info" | "warning" | "danger" | "success";

export interface AssignmentProps {
  id: EntityId;
  stageInstanceId: EntityId;
  transactionId: EntityId;
  assigneeId: EntityId | null;
  assigneeName: string;
  /** مشارك اختياري لا يمنع إغلاق المرحلة تحت سياسة «الكل». */
  isOptional: boolean;
  /** null = بانتظار مدير البرنامج ليحدّد المدة — العدّاد لا يبدأ قبلها. */
  allocatedMinutes: number | null;
  arrivedAt: Date | null;
  /** متى ضغط «استلام» — يلزم قبل الإنجاز إن كانت المرحلة تشترطه. */
  receivedAt: Date | null;
  /** متى حجزها على نفسه تحت سياسة الحجز الحصريّ. */
  claimedAt: Date | null;
  completedAt: Date | null;
  status: AssignmentStatus;
  score: number | null;
  notes: string;
  managerNote: string;
  /** دقائق العمل المستهلكة — محسوبة على الخادم داخل الدوام. */
  elapsedMinutes: number;
  dueAt: Date | null;
}

export class Assignment {
  readonly id: EntityId;
  readonly stageInstanceId: EntityId;
  readonly transactionId: EntityId;
  readonly assigneeId: EntityId | null;
  readonly assigneeName: string;
  readonly isOptional: boolean;
  readonly allocatedMinutes: number | null;
  readonly arrivedAt: Date | null;
  readonly receivedAt: Date | null;
  readonly claimedAt: Date | null;
  readonly completedAt: Date | null;
  readonly status: AssignmentStatus;
  readonly score: number | null;
  readonly notes: string;
  readonly managerNote: string;
  readonly elapsedMinutes: number;
  readonly dueAt: Date | null;

  private constructor(props: AssignmentProps) {
    this.id = props.id;
    this.stageInstanceId = props.stageInstanceId;
    this.transactionId = props.transactionId;
    this.assigneeId = props.assigneeId;
    this.assigneeName = props.assigneeName;
    this.isOptional = props.isOptional;
    this.allocatedMinutes = props.allocatedMinutes;
    this.arrivedAt = props.arrivedAt;
    this.receivedAt = props.receivedAt;
    this.claimedAt = props.claimedAt;
    this.completedAt = props.completedAt;
    this.status = props.status;
    this.score = props.score;
    this.notes = props.notes;
    this.managerNote = props.managerNote;
    this.elapsedMinutes = props.elapsedMinutes;
    this.dueAt = props.dueAt;
    Object.freeze(this);
  }

  static restore(props: AssignmentProps): Assignment {
    return new Assignment(props);
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
  static colorFor(status: AssignmentStatus, elapsedRatio: number | null): InboxColor {
    if (status === "done") return "success";
    if (elapsedRatio === null) return "neutral";
    if (elapsedRatio >= 1) return "danger";
    if (elapsedRatio >= 0.75) return "warning";
    if (elapsedRatio >= 0.5) return "info";
    return "neutral";
  }

  get color(): InboxColor {
    return Assignment.colorFor(this.status, this.elapsedRatio);
  }

  /**
   * صاحب التكليف وحده يُنجزه، ما لم يملك المستخدم صلاحية التجاوز.
   * `requiresReceive` يأتي من المرحلة الحاوية.
   */
  canBeCompletedBy(
    userId: EntityId,
    canOverride: boolean,
    requiresReceive = false,
    requiresClaim = false,
  ): boolean {
    // المعلَّق بحجز زميل ليس «قيد التنفيذ»، فيسقط هنا بلا شرط إضافي
    if (this.status !== "in_progress") return false;
    if (this.allocatedMinutes === null) return false;
    if (requiresReceive && this.receivedAt === null) return false;
    if (requiresClaim && this.claimedAt === null) return false;
    return this.assigneeId === userId || canOverride;
  }
}
