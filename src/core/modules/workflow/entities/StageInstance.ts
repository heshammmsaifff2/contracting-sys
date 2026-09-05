/**
 * StageInstance — مرحلة فعلية على معاملة.
 *
 * المرحلة حاوية لا مكلَّف: تحمل مشاركيها في `assignments`، وسياسةُ الإنجاز
 * هي التي تقرّر متى تُغلق. المنطق هنا نسخة مطابقة لما يطبّقه الخادم في
 * `complete_assignment`، للعرض الفوري لا للاعتماد عليه في القرار.
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import type { Assignment } from "./Assignment";

export type StageStatus = "pending" | "in_progress" | "done" | "cancelled" | "skipped";

/** متى تُغلق المرحلة وقد وقفت عند أكثر من مشارك. */
export type CompletionPolicy = "all" | "any" | "quorum";

export interface StageInstanceProps {
  id: EntityId;
  transactionId: EntityId;
  stageKey: string;
  name: string;
  /** ترتيب الدخول لا ترتيب التعريف — التفريع يجعل الثاني بلا معنى. */
  seq: number;
  status: StageStatus;
  completionPolicy: CompletionPolicy;
  quorumCount: number | null;
  isFinal: boolean;
  isArchive: boolean;
  requiresReceive: boolean;
  enteredAt: Date | null;
  completedAt: Date | null;
  assignments: readonly Assignment[];
}

export class StageInstance {
  readonly id: EntityId;
  readonly transactionId: EntityId;
  readonly stageKey: string;
  readonly name: string;
  readonly seq: number;
  readonly status: StageStatus;
  readonly completionPolicy: CompletionPolicy;
  readonly quorumCount: number | null;
  readonly isFinal: boolean;
  readonly isArchive: boolean;
  readonly requiresReceive: boolean;
  readonly enteredAt: Date | null;
  readonly completedAt: Date | null;
  readonly assignments: readonly Assignment[];

  private constructor(props: StageInstanceProps) {
    this.id = props.id;
    this.transactionId = props.transactionId;
    this.stageKey = props.stageKey;
    this.name = props.name;
    this.seq = props.seq;
    this.status = props.status;
    this.completionPolicy = props.completionPolicy;
    this.quorumCount = props.quorumCount;
    this.isFinal = props.isFinal;
    this.isArchive = props.isArchive;
    this.requiresReceive = props.requiresReceive;
    this.enteredAt = props.enteredAt;
    this.completedAt = props.completedAt;
    this.assignments = props.assignments;
    Object.freeze(this);
  }

  static restore(props: StageInstanceProps): StageInstance {
    return new StageInstance(props);
  }

  get isOpen(): boolean {
    return this.status === "pending" || this.status === "in_progress";
  }

  /** المرحلة بلا مشارك مؤهَّل — تنتظر تدخّلًا بشريًا، ولا تُغلق صامتة. */
  get isUnassigned(): boolean {
    return this.assignments.length === 0;
  }

  get participantsCount(): number {
    return this.assignments.length;
  }

  get doneCount(): number {
    return this.assignments.filter((a) => a.status === "done").length;
  }

  /** غير الملغى وغير الاختياري — قاعدة القياس تحت سياسة «الكل». */
  get requiredCount(): number {
    return this.assignments.filter((a) => a.status !== "cancelled" && !a.isOptional)
      .length;
  }

  get doneRequiredCount(): number {
    return this.assignments.filter((a) => a.status === "done" && !a.isOptional).length;
  }

  /**
   * هل تحقّقت سياسة الإنجاز؟ نسخة مطابقة لقرار الخادم:
   * الاختياري لا يمنع الإغلاق تحت `all`، ويُحتسب تحت `any` و`quorum`.
   */
  get isPolicySatisfied(): boolean {
    switch (this.completionPolicy) {
      case "any":
        return this.doneCount >= 1;
      case "quorum":
        return this.doneCount >= (this.quorumCount ?? 1);
      default:
        return this.doneRequiredCount >= this.requiredCount;
    }
  }

  /** كم بقي على إغلاق المرحلة — للعرض: «أنجز ١ من ٣». */
  get remainingToClose(): number {
    switch (this.completionPolicy) {
      case "any":
        return Math.max(0, 1 - this.doneCount);
      case "quorum":
        return Math.max(0, (this.quorumCount ?? 1) - this.doneCount);
      default:
        return Math.max(0, this.requiredCount - this.doneRequiredCount);
    }
  }

  get awaitingDurationCount(): number {
    return this.assignments.filter((a) => a.isAwaitingDuration).length;
  }

  /** متأخّرة إن تجاوز أي مكلَّف مدّته. */
  get isOverdue(): boolean {
    return this.assignments.some((a) => a.isOverdue);
  }

  /** متوسّط درجات من أنجز — التوازي يجعلها متوسّطًا لا درجة واحدة. */
  get averageScore(): number | null {
    const scored = this.assignments.filter((a) => a.score !== null);
    if (scored.length === 0) return null;
    const total = scored.reduce((sum, a) => sum + (a.score ?? 0), 0);
    return Math.round((total / scored.length) * 100) / 100;
  }

  assignmentFor(userId: EntityId): Assignment | null {
    return this.assignments.find((a) => a.assigneeId === userId) ?? null;
  }
}
