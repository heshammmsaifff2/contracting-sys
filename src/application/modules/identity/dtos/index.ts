import type { EmployeeType } from "@core/modules/identity/entities/Profile";

export interface SignInInput {
  email: string;
  password: string;
}

export interface ProfileDto {
  id: string;
  code: string | null;
  email: string | null;
  fullName: string;
  /** مشتقّ من قسم الوظيفة — يُقرأ ولا يُكتب. */
  employeeType: EmployeeType;
  isActive: boolean;
  roleKeys: readonly string[];
  roleNames: readonly string[];
  /** الوظيفة الواحدة — ومنها القسم والتصنيف والصلاحيات. */
  jobId: string | null;
  jobName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  /** أدوارٌ منحتها الوظيفة: تتبعها ولا تُسحب باليد. */
  jobRoleKeys: readonly string[];
}

export interface PermissionDto {
  id: string;
  key: string;
  description: string;
  module: string;
}

export interface RoleDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: readonly string[];
}

export interface UpdateProfileInput {
  id: string;
  fullName: string;
  code: string | null;
  /**
   * غيابه = لا تغيير. وتغييره يغيّر صلاحيات الموظف، فالقاعدة تشترط له
   * صلاحية إسناد الأدوار — ولذلك لا يُرسَل إلا حين يتغيّر فعلًا.
   */
  jobId?: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  /** null = يُضاف بلا وظيفة (فبلا صلاحيات) حتى يُسندها من يملك إسناد الأدوار. */
  jobId: string | null;
  code?: string | null;
  roleKeys?: readonly string[];
}

export interface CreateRoleInput {
  key: string;
  name: string;
  description?: string | null;
  permissionIds?: readonly string[];
}

export interface UpdateRoleInput {
  id: string;
  name: string;
  description?: string | null;
  permissionIds?: readonly string[];
}

export interface DeleteRoleInput {
  id: string;
}
