import type {
  AssignmentStatus,
  InboxColor,
} from "@core/modules/workflow/entities/Assignment";
import type { ActionKind } from "@core/modules/workflow/entities/WorkflowAction";
import type { RuleEffect } from "@core/modules/workflow/entities/EvaluationRule";
import type {
  ArchiveState,
  ClaimPolicy,
  DefinitionStatus,
  RequirementKind,
  RequirementScope,
} from "@core/modules/workflow/entities/WorkflowGovernance";
import type { WorkflowCondition } from "@core/modules/workflow/entities/WorkflowCondition";
import type {
  CompletionPolicy,
  StageStatus,
} from "@core/modules/workflow/entities/StageInstance";
import type { TransactionStatus } from "@core/modules/workflow/entities/Transaction";
import type {
  Audience,
  ScheduleKind,
  ScheduleSpec,
  TaskAction,
} from "@core/modules/workflow/entities/ScheduledTask";
import type { WeekDay } from "@core/modules/workflow/entities/WorkSchedule";
import type { StoredFile } from "@application/shared/ports/file-storage";

// ── صندوق الوارد ────────────────────────────────────────────────────────
/**
 * صفّ واحد = **تكليف** واحد، لا مرحلة.
 * المرحلة قد تقف عند أكثر من موظف، ولكلٍّ عدّاده ولونه ودرجته.
 */
export interface InboxItemDto {
  assignmentId: string;
  stageInstanceId: string;
  transactionId: string;
  transactionNo: number;
  transactionType: string;
  subject: string;
  transactionStatus: TransactionStatus;
  requestedBy: string | null;
  requesterName: string | null;
  projectId: string | null;
  projectName: string | null;
  /** ترتيب دخول المرحلة، لا ترتيبها في التعريف. */
  seq: number;
  stageKey: string;
  stageName: string;
  stageStatus: StageStatus;
  completionPolicy: CompletionPolicy;
  quorumCount: number | null;
  isArchive: boolean;
  isFinal: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  isOptional: boolean;
  allocatedMinutes: number | null;
  arrivedAt: string | null;
  receivedAt: string | null;
  /** متى حُجزت على صاحبها تحت السياسة الحصريّة [المرحلة ٠٧]. */
  claimedAt: string | null;
  claimPolicy: ClaimPolicy;
  completedAt: string | null;
  assignmentStatus: AssignmentStatus;
  score: number | null;
  notes: string;
  managerNote: string;
  /** دقائق العمل المستهلكة — محسوبة على الخادم داخل الدوام. */
  elapsedMinutes: number;
  remainingMinutes: number | null;
  elapsedRatio: number | null;
  dueAt: string | null;
  color: InboxColor;
  awaitingDuration: boolean;
  awaitingReceive: boolean;
  /** كم مشاركًا على هذه المرحلة وكم أنجز — «أنجز ١ من ٣». */
  participantsCount: number;
  stageDoneCount: number;
  /** التحذيرات الرسمية — يُخصَم أثرها من الدرجة. */
  warningsCount: number;
  /** ما أُضيف بمدّ المهلة، منفصلًا عن المدة الأصلية. */
  extendedMinutes: number;
}

export interface InboxFilter {
  /** بريدي أنا فقط، أم كل ما أستطيع رؤيته. */
  mineOnly?: boolean;
  /** إخفاء المنجَز. */
  openOnly?: boolean;
}

// ── المراحل ─────────────────────────────────────────────────────────────
/** المرحلة ومشاركوها — أساس عرض «٣ مشاركين، أنجز ١». */
export interface StageDto {
  stageInstanceId: string;
  transactionId: string;
  seq: number;
  stageKey: string;
  stageName: string;
  stageStatus: StageStatus;
  completionPolicy: CompletionPolicy;
  quorumCount: number | null;
  isFinal: boolean;
  isArchive: boolean;
  requiresReceive: boolean;
  claimPolicy: ClaimPolicy;
  enteredAt: string | null;
  completedAt: string | null;
  participantsCount: number;
  doneCount: number;
  requiredCount: number;
  pendingCount: number;
  awaitingDurationCount: number;
  avgScore: number | null;
  assignments: readonly InboxItemDto[];
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
  /** الأرشفة على مرحلتين: إيداع الأصل ثم قبوله وفهرسته [المرحلة ٠٧]. */
  archiveState: ArchiveState;
  archiveSubmittedAt: string | null;
  archiveSubmittedByName: string | null;
  archivedAt: string | null;
  archivedByName: string | null;
  archiveLocation: string;
  stages: readonly StageDto[];
}

export interface StartTransactionDto {
  type: string;
  subject: string;
  projectId: string | null;
  /**
   * لقطة المستند المصدر — ما تُقاس عليه شروط التفريع.
   * تمرّرها الوحدة التي تبدأ المعاملة (مستخلص، عهدة…)، وتُحدَّث لاحقًا
   * عبر `setTransactionContext`.
   */
  context?: Readonly<Record<string, unknown>>;
}

export interface CompleteAssignmentDto {
  assignmentId: string;
  /** مفتاح الزرّ المضغوط. مطلوب متى عُرِّفت للمرحلة إجراءات. */
  actionKey: string | null;
  notes: string;
}

/** زرّ كما يظهر للمكلَّف الآن. */
export interface AvailableActionDto {
  assignmentId: string;
  actionId: string;
  actionKey: string;
  label: string;
  kind: ActionKind;
  sortOrder: number;
  requiresNote: boolean;
  requiresAttachment: boolean;
  requiresEvaluation: boolean;
  returnMinutes: number | null;
  /** صفر يعني زرًّا لا يقود إلى شيء — تحذير في المحرِّر. */
  routesCount: number;
  /** ما أرفقه المكلَّف على تكليفه — يعطّل زرًّا يشترط مرفقًا. */
  attachmentCount: number;
  /**
   * شروط الجاهزية غير المتحقّقة لهذا الزرّ [المرحلة ٠٧].
   * تُعرَض قبل الضغط: «غير جاهزة» بلا سبب تُرجع الموظف إلى المدير ليسأل.
   */
  unmetRequirements: readonly string[];
}

/** سطر من الخطّ الزمني — يشمل الملاحظات التي لا تحرّك المرحلة. */
export interface TimelineEntryDto {
  id: string;
  transactionId: string;
  stageInstanceId: string | null;
  seq: number | null;
  stageName: string | null;
  actionKey: string;
  actionLabel: string;
  kind: ActionKind;
  notes: string;
  actedBy: string | null;
  actedByName: string | null;
  actedAt: string;
}

export interface SetAssignmentDurationDto {
  assignmentId: string;
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
/** wait_all = مرحلة التقاء لا تبدأ قبل أن تهدأ الفروع الجارية. */
export type JoinPolicy = "none" | "wait_all";

/** أي إجراء يقرّر الوجهة حين يختلف المشاركون تحت سياسة «الكل». */
export type ConflictPolicy = "backward_wins" | "first_wins" | "last_wins";

export type ParticipantKind = "user" | "role" | "department_role" | "requester";

/**
 * مشارك في تعريف المرحلة.
 * `role` يتمدّد وقت التشغيل إلى **كل** حاملي الدور النشطين — وهو ما يجعل
 * المرحلة تقف عند أكثر من موظف.
 */
export interface StageParticipantDto {
  id: string;
  stageId: string;
  kind: ParticipantKind;
  userId: string | null;
  userName: string | null;
  roleId: string | null;
  roleName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isOptional: boolean;
  sortOrder: number;
}

export interface SaveStageParticipantDto {
  id: string | null;
  stageId: string;
  kind: ParticipantKind;
  userId: string | null;
  roleId: string | null;
  departmentId: string | null;
  isOptional: boolean;
  sortOrder: number;
}

export interface ActionRouteDto {
  id: string;
  actionId: string;
  priority: number;
  /** null = المسار الافتراضي، يمرّ دائمًا. */
  condition: WorkflowCondition | null;
  targetStageId: string;
  targetStageName: string | null;
}

export interface SaveActionRouteDto {
  id: string | null;
  actionId: string;
  priority: number;
  condition: WorkflowCondition | null;
  targetStageId: string;
}

export interface WorkflowActionDto {
  id: string;
  stageId: string;
  actionKey: string;
  label: string;
  kind: ActionKind;
  sortOrder: number;
  requiresNote: boolean;
  requiresAttachment: boolean;
  requiresEvaluation: boolean;
  returnMinutes: number | null;
  routes: readonly ActionRouteDto[];
}

export interface SaveWorkflowActionDto {
  id: string | null;
  stageId: string;
  actionKey: string;
  label: string;
  kind: ActionKind;
  sortOrder: number;
  requiresNote: boolean;
  requiresAttachment: boolean;
  requiresEvaluation: boolean;
  returnMinutes: number | null;
}

export interface StageRequirementDto {
  id: string;
  stageId: string;
  kind: RequirementKind;
  condition: WorkflowCondition | null;
  minAttachments: number | null;
  /** ما يُقال للموظف حين لا يتحقّق — جزء من القاعدة لا زينة. */
  message: string;
  appliesTo: RequirementScope;
  sortOrder: number;
}

export interface SaveStageRequirementDto {
  id: string | null;
  stageId: string;
  kind: RequirementKind;
  condition: WorkflowCondition | null;
  minAttachments: number | null;
  message: string;
  appliesTo: RequirementScope;
  sortOrder: number;
}

export interface WorkflowStageDto {
  id: string;
  definitionId: string;
  stageKey: string;
  name: string;
  sortOrder: number;
  completionPolicy: CompletionPolicy;
  quorumCount: number | null;
  isStart: boolean;
  isFinal: boolean;
  isArchive: boolean;
  isProgramManager: boolean;
  requiresReceive: boolean;
  slaMinutes: number | null;
  defaultNextStageId: string | null;
  defaultNextStageName: string | null;
  joinPolicy: JoinPolicy;
  conflictPolicy: ConflictPolicy;
  /** exclusive = أوّل من يحجز يقفلها على نفسه [المرحلة ٠٧]. */
  claimPolicy: ClaimPolicy;
  /** موضع العقدة في محرّر الخريطة — عرضٌ محض، لا يمسّ التوجيه. */
  posX: number;
  posY: number;
  participants: readonly StageParticipantDto[];
  actions: readonly WorkflowActionDto[];
  requirements: readonly StageRequirementDto[];
}

export interface SaveWorkflowStageDto {
  id: string | null;
  definitionId: string;
  stageKey: string;
  name: string;
  sortOrder: number;
  completionPolicy: CompletionPolicy;
  quorumCount: number | null;
  isStart: boolean;
  isFinal: boolean;
  isArchive: boolean;
  isProgramManager: boolean;
  requiresReceive: boolean;
  slaMinutes: number | null;
  defaultNextStageId: string | null;
  joinPolicy: JoinPolicy;
  conflictPolicy: ConflictPolicy;
  claimPolicy: ClaimPolicy;
}

/**
 * موضع عقدة على اللوحة. يُحفَظ مستقلًّا عن بقيّة حقول المرحلة: السحب حدثٌ
 * متكرّر، ولا يصحّ أن تمرّ معه `is_final` و`sla_minutes` في كل مرة.
 */
export interface StagePositionDto {
  id: string;
  x: number;
  y: number;
}

export interface SaveStagePositionsDto {
  definitionId: string;
  positions: readonly StagePositionDto[];
}

export interface WorkflowDefinitionDto {
  id: string;
  transactionType: string;
  name: string;
  isActive: boolean;
  /** إصدارات المسار: المسودّة تُعدَّل، والمنشور يسير، والمتقاعد يُقرأ. */
  version: number;
  status: DefinitionStatus;
  lineageId: string;
  publishedAt: string | null;
  retiredAt: string | null;
  stages: readonly WorkflowStageDto[];
}

export interface SaveWorkflowDefinitionDto {
  id: string | null;
  transactionType: string;
  name: string;
  isActive: boolean;
}

// ── طابور الأرشيف ───────────────────────────────────────────────────────
/** معاملة أُغلقت ولم يصل أصلها الورقيّ الأرشيف بعد. */
export interface ArchiveQueueItemDto {
  transactionId: string;
  transactionNo: number;
  transactionType: string;
  subject: string;
  projectId: string | null;
  projectName: string | null;
  closedAt: string | null;
  archiveState: ArchiveState;
  archiveSubmittedAt: string | null;
  submittedByName: string | null;
  archivedAt: string | null;
  archivedByName: string | null;
  archiveLocation: string;
  /** كم مضى على الإغلاق بلا فهرسة — ما يُرتَّب عليه الطابور. */
  daysSinceClosed: number;
}

export interface ArchiveDecisionDto {
  transactionId: string;
  /** موضع الحفظ عند القبول، أو سبب الردّ. إلزاميّ في الحالتين. */
  text: string;
  notes?: string;
}

// ── أدوات التشغيل ───────────────────────────────────────────────────────
/** تنبيه تذكيري، أو تحذير رسمي يُخصَم من الدرجة. */
export type AlertKind = "reminder" | "warning";

export interface TransferTargetDto {
  userId: string;
  fullName: string;
}

export interface TransferAssignmentDto {
  assignmentId: string;
  toUserId: string;
  reason: string;
}

export interface SendAlertDto {
  assignmentId: string;
  kind: AlertKind;
  reason: string;
}

export interface ExtendDeadlineDto {
  assignmentId: string;
  extraMinutes: number;
  reason: string;
}

export interface ForceCloseDto {
  transactionId: string;
  reason: string;
}

export interface MentionDto {
  actionLogId: string;
  userIds: readonly string[];
}

// ── المرفقات ────────────────────────────────────────────────────────────
/** من يرى المرفق: كل الموقّعين · قسم بعينه · صاحب صلاحية مسمّاة. */
export type AttachmentVisibility = "participants" | "department" | "permission";

export interface TransactionAttachmentDto {
  id: string;
  transactionId: string;
  assignmentId: string | null;
  stageInstanceId: string | null;
  /** مختوم بإجراء ⇒ صار جزءًا من الخطّ الزمني ولا يُحذف. */
  actionLogId: string | null;
  name: string;
  /** مرجع Cloudinary — لا الملفّ نفسه. */
  file: StoredFile;
  contentType: string;
  sizeBytes: number;
  visibility: AttachmentVisibility;
  departmentId: string | null;
  departmentName: string | null;
  requiredPermission: string | null;
  isAuthenticated: boolean;
  uploadedBy: string | null;
  uploadedByName: string | null;
  createdAt: string;
  seq: number | null;
  stageName: string | null;
}

export interface AddAttachmentDto {
  transactionId: string;
  /** التكليف الذي رُفع عنده — يربطه بالمرحلة ويسمح بفرض «يتطلّب مرفقًا». */
  assignmentId: string | null;
  name: string;
  file: StoredFile;
  contentType: string;
  sizeBytes: number;
  visibility: AttachmentVisibility;
  departmentId: string | null;
  requiredPermission: string | null;
  isAuthenticated: boolean;
}

// ── المهام المجدولة ─────────────────────────────────────────────────────
export interface ScheduledTaskDto {
  id: string;
  name: string;
  isActive: boolean;
  action: TaskAction;
  transactionType: string | null;
  projectId: string | null;
  projectName: string | null;
  subjectTemplate: string;
  bodyTemplate: string;
  context: Readonly<Record<string, unknown>>;
  audience: Audience;
  scheduleKind: ScheduleKind;
  scheduleSpec: ScheduleSpec;
  shiftToWorkday: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string;
  runCount: number;
  /** كم سيصل هذا التعميم الآن لو عمل — يُحسب حيًّا لا وقت الإعداد. */
  audienceSize: number;
  errorRuns: number;
  lastFiredAt: string | null;
}

export interface SaveScheduledTaskDto {
  id: string | null;
  name: string;
  isActive: boolean;
  action: TaskAction;
  transactionType: string | null;
  projectId: string | null;
  subjectTemplate: string;
  bodyTemplate: string;
  context: Readonly<Record<string, unknown>>;
  audience: Audience;
  scheduleKind: ScheduleKind;
  scheduleSpec: ScheduleSpec;
  shiftToWorkday: boolean;
  /** أول موعد؛ اتركه فارغًا ليُحسب من الجدولة. */
  nextRunAt: string | null;
}

export interface ScheduledTaskRunDto {
  id: string;
  taskId: string;
  firedAt: string;
  scheduledFor: string | null;
  status: "ok" | "skipped" | "error";
  audienceCount: number;
  createdTransactionIds: readonly string[];
  notifiedCount: number;
  error: string;
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
  assignmentId: string;
  transactionNo: number;
  stageName: string;
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

/** فئة تجمع بنود تقييم متقاربة — التقرير يُقرأ بثلاثة أرقام لا بخمسة عشر. */
export interface EvaluationCategoryDto {
  id: string;
  key: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface EvaluationCategoryScoreDto {
  userId: string;
  period: string;
  categoryKey: string;
  categoryName: string;
  sortOrder: number;
  categoryScore: number;
  categoryWeight: number;
}

/** قاعدة إدارية تعدّل الدرجة بشرط محسوب على مقاييس الفترة. */
export interface EvaluationRuleDto {
  id: string;
  key: string;
  name: string;
  reasonTemplate: string;
  condition: WorkflowCondition | null;
  effect: RuleEffect;
  points: number;
  /** null = نقاط ثابتة؛ وإلا تُضرَب في هذا الحقل من المقاييس. */
  perUnitField: string | null;
  maxPoints: number | null;
  employeeType: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface SaveEvaluationRuleDto {
  id: string | null;
  key: string;
  name: string;
  reasonTemplate: string;
  condition: WorkflowCondition | null;
  effect: RuleEffect;
  points: number;
  perUnitField: string | null;
  maxPoints: number | null;
  employeeType: string | null;
  isActive: boolean;
  sortOrder: number;
}

/** صفٌّ من المُختبِر التجريبي: ماذا ستفعل القاعدة لو طُبِّقت — بلا كتابة. */
export interface RulePreviewRowDto {
  userId: string;
  fullName: string;
  employeeType: string;
  ruleId: string;
  ruleKey: string;
  ruleName: string;
  effect: RuleEffect;
  points: number;
  reason: string;
  metrics: Readonly<Record<string, unknown>>;
  /** طُبِّقت أصلًا على هذه الفترة — لا تُطبَّق مرّتين. */
  alreadyApplied: boolean;
}

/** الدرجة النهائية: المجمَّدة من اللقطة، والجارية محسوبةً حيّةً. */
export interface EvaluationPeriodRowDto {
  period: string;
  userId: string;
  fullName: string;
  employeeType: string;
  baseScore: number | null;
  adjustmentPoints: number;
  finalScore: number | null;
  completedSteps: number;
  rankInPeriod: number | null;
  isFrozen: boolean;
  frozenAt: string | null;
}

/** سطر من سجلّ التدقيق: ماذا ولمن ومن ومتى. */
export interface EvaluationAuditRowDto {
  id: string;
  entity: string;
  action: "insert" | "update" | "delete";
  userName: string | null;
  period: string | null;
  actorName: string | null;
  actedAt: string;
  beforeData: unknown;
  afterData: unknown;
}

export interface SaveEvaluationScoreDto {
  userId: string;
  criteriaId: string;
  period: string;
  score: number;
  note: string;
}
