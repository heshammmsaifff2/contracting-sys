/**
 * DTOs التقارير الشاملة — صور قراءة فقط لعروض Postgres.
 * لا كيان دومين لها: التقرير ليس شيئًا له قواعد عمل، بل نتيجة حساب
 * تمّ كاملًا في الخادم. الواجهة تعرضه ولا تعيد اشتقاق أي رقم منه.
 */

// ── مرشّحات مشتركة ──────────────────────────────────────────────────────
export interface ReportFilter {
  projectId?: string | null;
  /** بداية المدى (YYYY-MM-DD) — يخصّ التقارير المؤرَّخة وحدها. */
  from?: string | null;
  to?: string | null;
}

// ── 1) تكلفة المشروع ────────────────────────────────────────────────────
export interface ProjectCostRowDto {
  projectId: string;
  projectCode: string;
  projectName: string;
  projectStatus: string;
  contractValue: number;
  supplyTotal: number;
  custodyTotal: number;
  extractTotal: number;
  advanceTotal: number;
  committedTotal: number;
  paidTotal: number;
  remainingBudget: number;
  /** null حين لا قيمة عقد — لا تُحسب نسبة على صفر. */
  consumedRatio: number | null;
}

// ── 2) أرصدة الأطراف ────────────────────────────────────────────────────
export type PartyType = "supplier" | "contractor" | "worker" | "employee";

export interface PartyBalanceRowDto {
  partyType: PartyType;
  partyId: string;
  partyCode: string;
  partyName: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  linesCount: number;
  debitTotal: number;
  creditTotal: number;
  /** موجب = مستحقّ للطرف على الشركة (خصوم) أو على الطرف (أصول). */
  balance: number;
  lastEntryDate: string | null;
}

// ── 3) القيود اليدوية ───────────────────────────────────────────────────
export interface ManualEntryRowDto {
  entryId: string;
  entryNo: number;
  entryDate: string;
  description: string;
  sourceType: string;
  projectId: string | null;
  projectName: string;
  postedBy: string | null;
  postedByName: string;
  totalDebit: number;
  totalCredit: number;
  /** القيد الذي نقل مبلغًا من الذمم إلى المصروف [الحسابات 17]. */
  movesReceivableToExpense: boolean;
  createdAt: string;
}

// ── 4) الأصول غير المستلمة ──────────────────────────────────────────────
export interface ArchivePendingRowDto {
  transactionId: string;
  transactionNo: number;
  transactionType: string;
  subject: string;
  transactionStatus: string;
  projectId: string | null;
  projectName: string;
  requestedByName: string;
  received: boolean;
  hasOriginal: boolean;
  receivedAt: string | null;
  closedAt: string | null;
  daysPending: number | null;
  notes: string;
}

// ── 5) المدد المعدّلة ───────────────────────────────────────────────────
export interface DurationChangeRowDto {
  changeId: string;
  transactionId: string;
  transactionNo: number;
  transactionType: string;
  subject: string;
  projectName: string;
  stepName: string;
  orderNo: number;
  assigneeName: string;
  oldMinutes: number | null;
  newMinutes: number;
  deltaMinutes: number;
  reason: string;
  changedByName: string;
  changedAt: string;
  /** التعديل بعد انتهاء المرحلة هو ما يستحقّ المراجعة [المراسلات 5]. */
  changedAfterCompletion: boolean;
}

// ── 6) المعاملات المتأخّرة ──────────────────────────────────────────────
export interface OverdueTransactionRowDto {
  stepInstanceId: string;
  transactionId: string;
  transactionNo: number;
  transactionType: string;
  subject: string;
  projectName: string;
  stepName: string;
  orderNo: number;
  assigneeId: string | null;
  assigneeName: string;
  allocatedMinutes: number;
  elapsedMinutes: number;
  /** سالب دائمًا في هذا التقرير — مقدار التجاوز. */
  remainingMinutes: number;
  elapsedRatio: number | null;
  arrivedAt: string | null;
  dueAt: string | null;
  wasCompletedLate: boolean;
}

// ── 7) تردّد الأقسام ────────────────────────────────────────────────────
export interface DepartmentFrequencyRowDto {
  departmentId: string;
  departmentName: string;
  transactionType: string;
  transactionsCount: number;
  visitsCount: number;
  /** أكبر من 1 يعني دورانًا على القسم نفسه [المراسلات 24]. */
  visitsPerTransaction: number | null;
  doneCount: number;
  avgScore: number | null;
}
