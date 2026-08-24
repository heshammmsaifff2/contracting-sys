/**
 * Transaction — المعاملة التي تسير في المحرّك.
 * ترقيمها آلي [المراسلات 20]، وتُقفل بتأكيد طالبها [المراسلات 9].
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import type { StepInstance } from "./StepInstance";

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
  steps: readonly StepInstance[];
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
  readonly steps: readonly StepInstance[];

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
    this.steps = props.steps;
    Object.freeze(this);
  }

  static restore(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  /** المرحلة الجارية حاليًا. */
  get currentStep(): StepInstance | null {
    return this.steps.find((step) => step.status === "in_progress") ?? null;
  }

  get completedSteps(): readonly StepInstance[] {
    return this.steps.filter((step) => step.status === "done");
  }

  /** «تمام الإنجاز» من حقّ طالب المعاملة وحده [المراسلات 9]. */
  canBeClosedBy(userId: EntityId, canOverride: boolean): boolean {
    if (this.status !== "awaiting_confirmation") return false;
    return this.requestedBy === userId || canOverride;
  }

  /** متأخّرة إن تجاوزت أي مرحلة جارية مدّتها. */
  get isOverdue(): boolean {
    return this.currentStep?.isOverdue ?? false;
  }

  /** متوسّط درجات المراحل المنجزة. */
  get averageScore(): number | null {
    const scored = this.completedSteps.filter((step) => step.score !== null);
    if (scored.length === 0) return null;
    const total = scored.reduce((sum, step) => sum + (step.score ?? 0), 0);
    return Math.round((total / scored.length) * 100) / 100;
  }

  get progressRatio(): number {
    if (this.steps.length === 0) return 0;
    return this.completedSteps.length / this.steps.length;
  }
}
