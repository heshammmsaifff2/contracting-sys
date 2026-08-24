/**
 * Mapper — المكان الوحيد الذي يعرف شكل صفوف قاعدة البيانات وشكل كيانات الدومين معًا.
 */
import { Code } from "@core/shared/value-objects/code";
import {
  Profile,
  type EmployeeType,
  EMPLOYEE_TYPES,
} from "@core/modules/identity/entities/Profile";
import type { Tables } from "@infrastructure/supabase/database.types";

export type ProfileRow = Tables<"profiles">;

/** Narrow an unchecked DB string into the domain union. */
export function toEmployeeType(raw: string): EmployeeType {
  return EMPLOYEE_TYPES.includes(raw as EmployeeType) ? (raw as EmployeeType) : "admin";
}

export function profileRowToEntity(row: ProfileRow): Profile {
  const code = row.code === null ? null : Code.create(row.code);

  return Profile.restore({
    id: row.id,
    code: code !== null && code.ok ? code.value : null,
    email: row.email,
    fullName: row.full_name,
    employeeType: toEmployeeType(row.employee_type),
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
  });
}
