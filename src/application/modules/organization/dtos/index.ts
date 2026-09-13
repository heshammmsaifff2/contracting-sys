/**
 * الهيكل التنظيمي:
 *
 *   التصنيف (إداري · تشغيلي)
 *     └─ القسم
 *          └─ الوظيفة  ← تحمل دور صلاحيات
 *               └─ الموظف  ← وظيفة واحدة، يرث منها قسمه وتصنيفه وصلاحياته
 */
import type { EmployeeType } from "@core/modules/identity/entities/Profile";

/** تصنيف القسم هو تصنيف كل موظفيه. */
export type Classification = EmployeeType;

export interface JobDto {
  id: string;
  departmentId: string;
  name: string;
  description: string;
  sortOrder: number;
  roleId: string;
  roleKey: string;
  roleName: string;
  /** شاغلوها — وظيفةٌ يشغلها أحد لا تُحذف. */
  holderCount: number;
}

export interface DepartmentDto {
  id: string;
  name: string;
  classification: Classification;
  description: string;
  /** مرفقات موظفي القسم مخفيّة عن غيرهم إلا من استُثني. */
  restrictAttachments: boolean;
  sortOrder: number;
  employeeCount: number;
  jobs: readonly JobDto[];
}

export type AttachmentAccessKind = "user" | "department";

/** مستثنًى من إخفاء مرفقات القسم: موظف بعينه أو قسم كامل. */
export interface AttachmentAccessEntry {
  kind: AttachmentAccessKind;
  userId: string | null;
  departmentId: string | null;
}

export interface AttachmentAccessDto extends AttachmentAccessEntry {
  id: string;
  /** اسم الموظف أو القسم. */
  label: string;
}

export interface SaveDepartmentInput {
  id: string | null;
  name: string;
  classification: Classification;
  description: string;
  restrictAttachments: boolean;
  sortOrder: number;
  /** تُستبدل كاملةً، وتُمحى حين يُرفع الإخفاء. */
  access: readonly AttachmentAccessEntry[];
}

export interface SaveJobInput {
  id: string | null;
  departmentId: string;
  name: string;
  roleId: string;
  description: string;
  sortOrder: number;
}
