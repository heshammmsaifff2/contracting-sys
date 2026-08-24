import type { AttendanceStatus, DayValues } from "@core/modules/hr/entities/Attendance";
import type { LoanStatus } from "@core/modules/hr/entities/Loan";
import type { SalaryType, WorkerStatus } from "@core/modules/hr/entities/Worker";

// ── العمالة ─────────────────────────────────────────────────────────────
export interface WorkerDto {
  id: string;
  fullName: string;
  code: string | null;
  cardNo: string | null;
  professions: readonly string[];
  salaryType: SalaryType;
  employeeType: string;
  isActive: boolean;
  /** الحالة المفتوحة الحالية — شاغر/منتدب/عليه ملاحظة. */
  status: WorkerStatus | null;
  statusProjectId: string | null;
  statusProjectName: string;
  statusNote: string;
}

export interface SaveWorkerDto {
  id: string;
  cardNo: string | null;
  professions: readonly string[];
  salaryType: SalaryType;
  hiredAt: string | null;
  nationalId: string | null;
  phone: string | null;
  notes: string;
}

export interface SetWorkerStatusDto {
  workerId: string;
  status: WorkerStatus;
  projectId: string | null;
  availableFrom: string;
  availableTo: string | null;
  note: string;
}

export interface WorkerPoolFilter {
  status: WorkerStatus | null;
}

// ── اليوميات ────────────────────────────────────────────────────────────
export interface AttendanceSuggestionDto {
  workerId: string;
  fullName: string;
  cardNo: string | null;
  professions: readonly string[];
  lastStatus: AttendanceStatus;
  lastDate: string;
  alreadyRegistered: boolean;
}

export interface AttendanceRowDto {
  id: string;
  projectId: string;
  projectName: string;
  workerId: string;
  workerName: string;
  cardNo: string | null;
  workDate: string;
  status: AttendanceStatus;
  isTemp: boolean;
  note: string;
}

export interface AttendanceEntryDto {
  workerId: string;
  status: AttendanceStatus;
  isTemp: boolean;
  note: string;
}

export interface RegisterAttendanceDto {
  projectId: string;
  workDate: string;
  entries: readonly AttendanceEntryDto[];
}

export interface AttendanceFilter {
  projectId: string | null;
  workDate: string | null;
  workerId: string | null;
}

/** إعدادات اليوميات المقروءة من settings — لا أرقام في الكود. */
export interface AttendanceSettingsDto {
  cutoffTime: string;
  dayValues: DayValues;
}

// ── تقرير «كم يومية كلّفني المشروع» ─────────────────────────────────────
export interface LaborDaysRowDto {
  projectId: string;
  projectCode: string;
  projectName: string;
  period: string;
  presentDays: number;
  sickDays: number;
  excusedDays: number;
  absentDays: number;
  workersCount: number;
  payableDays: number;
}

export interface LaborCostRowDto {
  projectId: string;
  projectName: string;
  period: string;
  workerId: string;
  workerName: string;
  payableDays: number;
  dailyWage: number;
  cost: number;
}

// ── السلف ───────────────────────────────────────────────────────────────
export interface LoanDto {
  id: string;
  no: number;
  workerId: string;
  workerName: string;
  projectId: string | null;
  projectName: string;
  amount: number;
  installments: number;
  reason: string;
  status: LoanStatus;
  decisionNote: string;
  decidedAt: string | null;
  createdAt: string;
}

export interface RequestLoanDto {
  workerId: string;
  projectId: string | null;
  amount: number;
  installments: number;
  reason: string;
}

export interface DecideLoanDto {
  id: string;
  approve: boolean;
  note: string;
}

// ── الأجور والتقييم والتوصيات ───────────────────────────────────────────
export interface SalaryChangeDto {
  id: string;
  workerId: string;
  workerName: string;
  oldBase: number;
  newBase: number;
  oldDaily: number;
  newDaily: number;
  effectiveFrom: string;
  reason: string;
  createdAt: string;
}

export interface ChangeSalaryDto {
  workerId: string;
  newBase: number;
  newDaily: number;
  effectiveFrom: string;
  reason: string;
}

export interface ProductionRatingDto {
  id: string;
  workerId: string;
  workerName: string;
  period: string;
  income: number;
  cost: number;
  ratio: number | null;
  score: number | null;
  note: string;
}

export interface RateProductionDto {
  workerId: string;
  period: string;
  income: number;
  note: string;
}

export interface RecommendationDto {
  id: string;
  workerId: string;
  workerName: string;
  kind: "note" | "praise" | "warning";
  note: string;
  createdAt: string;
}

export interface SaveRecommendationDto {
  workerId: string;
  kind: "note" | "praise" | "warning";
  note: string;
}

// ── ترحيل كشف البنك ─────────────────────────────────────────────────────
export interface BankStatementRowDto {
  reference: number;
  amount: number;
  transferredAt: string | null;
}

export interface ImportStatementDto {
  rows: readonly BankStatementRowDto[];
  dryRun: boolean;
}

export interface ImportStatementResultDto {
  matched: number;
  transferred: number;
  posted: number;
  skipped: readonly { reference: string; reason: string }[];
}
