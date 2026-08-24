/**
 * منطق ألوان سير العمل في مكان واحد — تجسيد للقاعدة الملزَمة:
 * أخضر = منجَزة، أزرق = مرّ نصف المدة، أصفر = مرّ 75٪، أحمر = انتهت المدة.
 * أي شاشة تعرض حالة معاملة تستهلك هذا الملف ولا تعيد تعريف الألوان.
 */
import type { BadgeTone } from "../ui/Badge";
import { t } from "@i18n/index";

export type WorkflowStatus =
  "pending" | "in_progress" | "half_elapsed" | "near_due" | "overdue" | "done";

export const TONE_BY_STATUS: Record<WorkflowStatus, BadgeTone> = {
  pending: "neutral",
  in_progress: "neutral",
  half_elapsed: "info",
  near_due: "warning",
  overdue: "danger",
  done: "success",
};

export const LABEL_BY_STATUS: Record<WorkflowStatus, string> = {
  pending: t.status.pending,
  in_progress: t.status.inProgress,
  half_elapsed: t.status.inProgress,
  near_due: t.status.inProgress,
  overdue: t.status.overdue,
  done: t.status.done,
};

/**
 * يحوّل نسبة المدة المستهلكة إلى حالة لونية.
 * الحساب الفعلي للوقت المتبقّي يتم في Postgres ضمن مواعيد العمل — هذه الدالة للعرض فقط.
 */
export function statusFromElapsedRatio(ratio: number, isDone: boolean): WorkflowStatus {
  if (isDone) return "done";
  if (ratio >= 1) return "overdue";
  if (ratio >= 0.75) return "near_due";
  if (ratio >= 0.5) return "half_elapsed";
  return "in_progress";
}
