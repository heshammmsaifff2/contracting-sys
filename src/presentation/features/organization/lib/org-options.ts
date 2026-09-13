/**
 * خيارات القوائم المنسدلة للأقسام والوظائف — مصدرٌ واحد تقرؤه شاشة
 * الموظفين ومنشئ المسار ونافذة المشارك، فيُقرأ اسم الوظيفة بالشكل نفسه
 * أينما ظهر: «تشغيلي · الإدارة الهندسية — مهندس».
 */
import type {
  Classification,
  DepartmentDto,
  JobDto,
} from "@application/modules/organization/dtos";
import type { SelectOption } from "@presentation/shared/ui/Select";
import { employeeTypeLabel } from "@presentation/shared/lib/employee-type";

export const CLASSIFICATIONS: readonly Classification[] = [
  "administrative",
  "operational",
];

/** بترتيب العرض: الإداري أوّلًا، ثم ترتيب القسم. */
export function sortDepartments(
  departments: readonly DepartmentDto[],
): readonly DepartmentDto[] {
  return [...departments].sort(
    (a, b) =>
      CLASSIFICATIONS.indexOf(a.classification) -
        CLASSIFICATIONS.indexOf(b.classification) || a.sortOrder - b.sortOrder,
  );
}

export function departmentLabel(department: DepartmentDto): string {
  return `${employeeTypeLabel(department.classification)} · ${department.name}`;
}

export function departmentOptions(
  departments: readonly DepartmentDto[],
  exceptId?: string,
): SelectOption[] {
  return sortDepartments(departments)
    .filter((d) => d.id !== exceptId)
    .map((d) => ({ value: d.id, label: departmentLabel(d) }));
}

export function jobOptions(departments: readonly DepartmentDto[]): SelectOption[] {
  return sortDepartments(departments).flatMap((d) =>
    d.jobs.map((job) => ({
      value: job.id,
      label: `${departmentLabel(d)} — ${job.name}`,
    })),
  );
}

export function findJob(
  departments: readonly DepartmentDto[],
  jobId: string,
): { department: DepartmentDto; job: JobDto } | null {
  for (const department of departments) {
    const job = department.jobs.find((j) => j.id === jobId);
    if (job !== undefined) return { department, job };
  }
  return null;
}
