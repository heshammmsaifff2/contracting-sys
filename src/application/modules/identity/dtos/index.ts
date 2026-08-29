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
  employeeType: EmployeeType;
  isActive: boolean;
  roleKeys: readonly string[];
  roleNames: readonly string[];
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
  employeeType: EmployeeType;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  employeeType: EmployeeType;
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
