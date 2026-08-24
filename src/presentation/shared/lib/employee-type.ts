/**
 * تسميات تصنيف الموظف في مكان واحد.
 *
 * كانت مكرَّرة في الشريط العلوي وشاشة الموظفين ونموذج الإضافة، فحين أُضيف
 * تصنيف «عامل» في قاعدة البيانات بقيت النسخ الثلاث على ثلاثة تصنيفات
 * وظهر العامل بلا اسم. المصدر الواحد يمنع تكرار ذلك.
 */
import type { EmployeeType } from "@core/modules/identity/entities/Profile";
import { EMPLOYEE_TYPES } from "@core/modules/identity/entities/Profile";
import { t } from "@i18n/index";

export const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  admin: t.users.typeAdmin,
  engineer: t.users.typeEngineer,
  supervisor: t.users.typeSupervisor,
  worker: t.users.typeWorker,
};

/** تسمية آمنة لأي قيمة قادمة من الخادم، ولو لم تعرفها الواجهة بعد. */
export function employeeTypeLabel(value: string): string {
  return EMPLOYEE_TYPE_LABELS[value as EmployeeType] ?? value;
}

export const EMPLOYEE_TYPE_OPTIONS: readonly { value: string; label: string }[] =
  EMPLOYEE_TYPES.map((value) => ({ value, label: EMPLOYEE_TYPE_LABELS[value] }));
