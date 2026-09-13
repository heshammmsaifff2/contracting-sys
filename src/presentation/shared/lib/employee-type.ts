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
  administrative: t.users.typeAdministrative,
  operational: t.users.typeOperational,
};

/** القيم القبلية الطيّ — تبقى في لقطات التقييم المجمَّدة فتُسمّى بما طُويت إليه. */
const LEGACY: Readonly<Record<string, EmployeeType>> = {
  admin: "administrative",
  engineer: "operational",
  supervisor: "operational",
  worker: "operational",
};

/** تسمية آمنة لأي قيمة قادمة من الخادم، ولو كانت قديمة أو مجهولة. */
export function employeeTypeLabel(value: string): string {
  const known = EMPLOYEE_TYPE_LABELS[value as EmployeeType];
  if (known !== undefined) return known;
  const folded = LEGACY[value];
  return folded === undefined ? value : EMPLOYEE_TYPE_LABELS[folded];
}

export const EMPLOYEE_TYPE_OPTIONS: readonly { value: string; label: string }[] =
  EMPLOYEE_TYPES.map((value) => ({ value, label: EMPLOYEE_TYPE_LABELS[value] }));
