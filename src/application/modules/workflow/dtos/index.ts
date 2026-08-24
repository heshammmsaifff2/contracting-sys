import type {
  InboxColor,
  StepStatus,
} from "@core/modules/workflow/entities/StepInstance";
import type { TransactionStatus } from "@core/modules/workflow/entities/Transaction";
import type { WeekDay } from "@core/modules/workflow/entities/WorkSchedule";

// ── صندوق الوارد ────────────────────────────────────────────────────────
export interface InboxItemDto {
  stepInstanceId: string;
  transactionId: string;
  transactionNo: number;
  transactionType: string;
  subject: string;
  transactionStatus: TransactionStatus;
  projectId: string | null;
  projectName: string | null;
  orderNo: number;
  stepName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  allocatedMinutes: number | null;
  arrivedAt: string | null;
  completedAt: string | null;
  stepStatus: StepStatus;
  score: number | null;
  managerNote: string;
  /** دقائق العمل المستهلكة — محسوبة على الخادم داخل الدوام. */
  elapsedMinutes: number;
  remainingMinutes: number | null;
  elapsedRatio: number | null;
  dueAt: string | null;
  color: InboxColor;
  awaitingDuration: boolean;
}

export interface InboxFilter {
  /** بريدي أنا فقط، أم كل ما أستطيع رؤيته. */
  mineOnly?: boolean;
  /** إخفاء المنجَز. */
  openOnly?: boolean;
}

// ── المعاملات ───────────────────────────────────────────────────────────
export interface TransactionDto {
  id: string;
  no: number;
  type: string;
  subject: string;
  entityType: string | null;
  entityId: string | null;
  projectId: string | null;
  projectName: string | null;
  status: TransactionStatus;
  requestedBy: string | null;
  requesterName: string;
  isClosed: boolean;
  closedAt: string | null;
  createdAt: string;
  steps: readonly InboxItemDto[];
}

export interface StartTransactionDto {
  type: string;
  subject: string;
  projectId: string | null;
}

export interface CompleteStepDto {
  stepInstanceId: string;
  notes: string;
}

export interface SetStepDurationDto {
  stepInstanceId: string;
  minutes: number;
  scope: "all_occurrences" | "single";
  reason: string;
}

/** نتيجة البحث المختصر — بلا تفاصيل لغير الموقّعين [المراسلات 19]. */
export interface TransactionBriefDto {
  transactionNo: number;
  transactionType: string;
  status: string;
  createdAt: string;
  isParticipant: boolean;
}

// ── تعريفات سير العمل ───────────────────────────────────────────────────
export interface WorkflowStepDto {
  id: string;
  definitionId: string;
  orderNo: number;
  name: string;
  roleId: string | null;
  roleName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  defaultAssigneeId: string | null;
  defaultAssigneeName: string | null;
  isProgramManager: boolean;
  isArchive: boolean;
}

export interface WorkflowDefinitionDto {
  id: string;
  transactionType: string;
  name: string;
  isActive: boolean;
  steps: readonly WorkflowStepDto[];
}

export interface SaveWorkflowDefinitionDto {
  id: string | null;
  transactionType: string;
  name: string;
  isActive: boolean;
}

export interface SaveWorkflowStepDto {
  id: string | null;
  definitionId: string;
  orderNo: number;
  name: string;
  roleId: string | null;
  defaultAssigneeId: string | null;
  isProgramManager: boolean;
  isArchive: boolean;
}

// ── تقويم العمل ─────────────────────────────────────────────────────────
export interface WorkScheduleDto {
  id: string;
  scope: "global" | "user";
  userId: string | null;
  userName: string | null;
  dayOfWeek: WeekDay;
  startTime: string;
  endTime: string;
}

export interface SaveWorkScheduleDto {
  id: string | null;
  scope: "global" | "user";
  userId: string | null;
  dayOfWeek: WeekDay;
  startTime: string;
  endTime: string;
}

export interface HolidayDto {
  id: string;
  holidayDate: string;
  description: string;
  scope: "global" | "user";
  userId: string | null;
  userName: string | null;
}

export interface SaveHolidayDto {
  holidayDate: string;
  description: string;
  scope: "global" | "user";
  userId: string | null;
}

// ── المدد وتقريرها ──────────────────────────────────────────────────────
export interface DurationChangeDto {
  id: string;
  stepInstanceId: string;
  transactionNo: number;
  stepName: string;
  assigneeName: string;
  oldMinutes: number | null;
  newMinutes: number;
  reason: string;
  changedByName: string;
  changedAt: string;
}

// ── التقييم ─────────────────────────────────────────────────────────────
export interface EvaluationSummaryDto {
  userId: string;
  fullName: string;
  employeeType: string;
  period: string;
  weightedScore: number;
  completedSteps: number;
  rankInPeriod: number;
}

export interface EvaluationCriterionDto {
  id: string;
  key: string;
  name: string;
  kind: "completion" | "manual";
  isActive: boolean;
  /** الوزن لكل فئة موظف. */
  weights: Readonly<Record<string, number>>;
}

export interface SaveEvaluationScoreDto {
  userId: string;
  criteriaId: string;
  period: string;
  score: number;
  note: string;
}
