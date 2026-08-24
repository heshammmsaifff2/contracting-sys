import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { Profile } from "@core/modules/identity/entities/Profile";
import type {
  ProfileDto,
  UpdateProfileInput,
} from "@application/modules/identity/dtos";
import type { IProfileRepository } from "@application/modules/identity/ports/profile-repository";
import {
  profileRowToEntity,
  toEmployeeType,
} from "@infrastructure/mappers/profile-mapper";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

/** شكل صف الموظف مع أدواره كما يُرجعه select المتداخل. */
interface ProfileWithRolesRow {
  id: string;
  code: string | null;
  email: string | null;
  full_name: string;
  employee_type: string;
  is_active: boolean;
  user_roles: { roles: { key: string; name: string } | null }[] | null;
}

export class SupabaseProfileRepository implements IProfileRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async findById(id: string): Promise<Result<Profile | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) return err(toDomainDbError(error, { entity: "الموظف", id }));
      if (data === null) return ok(null);

      return ok(profileRowToEntity(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة بيانات الموظف"));
    }
  }

  async list(): Promise<Result<readonly ProfileDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("profiles")
        .select(
          "id, code, email, full_name, employee_type, is_active, user_roles(roles(key, name))",
        )
        .order("full_name", { ascending: true })
        .overrideTypes<ProfileWithRolesRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "الموظفون" }));

      return ok(
        (data ?? []).map((row) => {
          const roles = (row.user_roles ?? [])
            .map((link) => link.roles)
            .filter((role): role is { key: string; name: string } => role !== null);

          return {
            id: row.id,
            code: row.code,
            email: row.email,
            fullName: row.full_name,
            employeeType: toEmployeeType(row.employee_type),
            isActive: row.is_active,
            roleKeys: roles.map((r) => r.key),
            roleNames: roles.map((r) => r.name),
          } satisfies ProfileDto;
        }),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة قائمة الموظفين"));
    }
  }

  async update(input: UpdateProfileInput): Promise<Result<Profile, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("profiles")
        .update({
          full_name: input.fullName,
          code: input.code,
          employee_type: input.employeeType,
        })
        .eq("id", input.id)
        .select("*")
        .single();

      if (error) return err(toDomainDbError(error, { entity: "الموظف", id: input.id }));

      return ok(profileRowToEntity(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل بيانات الموظف"));
    }
  }

  async setActive(id: string, isActive: boolean): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("profiles")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "الموظف", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تغيير حالة الموظف"));
    }
  }
}
