/**
 * Transaction — المعاملة التي تسير في المحرّك.
 * ترقيمها آلي [المراسلات 20]، وتُقفل بتأكيد طالبها [المراسلات 9].
 *
 * منذ محرّك v2 قد تكون **أكثر من مرحلة نشطة في آن**، فلا مؤشّر مفرد
 * لـ«المرحلة الحالية» — بل `openStages`.
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import type { StageInstance } from "./StageInstance";

export type TransactionStatus =
  "in_progress" | "awaiting_confirmation" | "completed" | "cancelled";

export interface TransactionProps {
  id: EntityId;
  no: number;
  type: string;
  subject: string;
  entityType: string | null;
  entityId: EntityId | null;
  projectId: EntityId | null;
  projectName: string | null;
  status: TransactionStatus;
  requestedBy: EntityId | null;
  requesterName: string;
  isClosed: boolean;
  closedAt: Date | null;
  createdAt: Date;
  stages: readonly StageInstance[];
}

export class Transaction {
  readonly id: EntityId;
  readonly no: number;
  readonly type: string;
  readonly subject: string;
  readonly entityType: string | null;
  readonly entityId: EntityId | null;
  readonly projectId: EntityId | null;
  readonly projectName: string | null;
  readonly status: TransactionStatus;
  readonly requestedBy: EntityId | null;
  readonly requesterName: string;
  readonly isClosed: boolean;
  readonly closedAt: Date | null;
  readonly createdAt: Date;
  readonly stages: readonly StageInstance[];

  private constructor(props: TransactionProps) {
    this.id = props.id;
    this.no = props.no;
    this.type = props.type;
    this.subject = props.subject;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.projectId = props.projectId;
    this.projectName = props.projectName;
    this.status = props.status;
    this.requestedBy = props.requestedBy;
    this.requesterName = props.requesterName;
    this.isClosed = props.isClosed;
    this.closedAt = props.closedAt;
    this.createdAt = props.createdAt;
    this.stages = props.stages;
    Object.freeze(this);
  }

  static restore(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  /** المراحل الجارية — قد تكون أكثر من واحدة بعد التفريع المتوازي. */
  get openStages(): readonly StageInstance[] {
    return this.stages.filter((stage) => stage.isOpen);
  }

  get completedStages(): readonly StageInstance[] {
    return this.stages.filter((stage) => stage.status === "done");
  }

  /** «تمام الإنجاز» من حقّ طالب المعاملة وحده [المراسلات 9]. */
  canBeClosedBy(userId: EntityId, canOverride: boolean): boolean {
    if (this.status !== "awaiting_confirmation") return false;
    return this.requestedBy === userId || canOverride;
  }

  /** متأخّرة إن تجاوز أي مكلَّف على أي مرحلة جارية مدّته. */
  get isOverdue(): boolean {
    return this.openStages.some((stage) => stage.isOverdue);
  }

  /** ما ينتظر تصرّف هذا المستخدم الآن عبر كل المراحل الجارية. */
  openAssignmentsFor(userId: EntityId) {
    return this.openStages
      .flatMap((stage) => stage.assignments)
      .filter((a) => a.assigneeId === userId && a.status === "in_progress");
  }

  /** متوسّط درجات كل التكليفات المنجزة في المعاملة. */
  get averageScore(): number | null {
    const scored = this.stages
      .flatMap((stage) => stage.assignments)
      .filter((a) => a.score !== null);
    if (scored.length === 0) return null;
    const total = scored.reduce((sum, a) => sum + (a.score ?? 0), 0);
    return Math.round((total / scored.length) * 100) / 100;
  }

  get progressRatio(): number {
    if (this.stages.length === 0) return 0;
    return this.completedStages.length / this.stages.length;
  }
}
