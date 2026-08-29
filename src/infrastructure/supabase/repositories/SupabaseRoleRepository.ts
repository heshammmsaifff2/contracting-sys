import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { PermissionDto, RoleDto } from "@application/modules/identity/dtos";
import type { IRoleRepository } from "@application/modules/identity/ports/role-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

interface RoleWithPermissionsRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  role_permissions: { permissions: { key: string } | null }[] | null;
}

export class SupabaseRoleRepository implements IRoleRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async listRoles(): Promise<Result<readonly RoleDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("roles")
        .select(
          "id, key, name, description, is_system, role_permissions(permissions(key))",
        )
        .order("name", { ascending: true })
        .overrideTypes<RoleWithPermissionsRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "الأدوار" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          key: row.key,
          name: row.name,
          description: row.description,
          isSystem: row.is_system,
          permissionKeys: (row.role_permissions ?? [])
            .map((link) => link.permissions?.key)
            .filter((key): key is string => key !== undefined),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الأدوار"));
    }
  }

  async listPermissions(): Promise<Result<readonly PermissionDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("permissions")
        .select("id, key, description, module")
        .order("module", { ascending: true })
        .order("key", { ascending: true });

      if (error) return err(toDomainDbError(error, { entity: "الصلاحيات" }));

      return ok(data ?? []);
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الصلاحيات"));
    }
  }

  async setRolePermissions(
    roleId: string,
    permissionIds: readonly string[],
  ): Promise<Result<void, DomainError>> {
    try {
      // استبدال كامل: حذف ثم إدراج. ليست معاملة ذرّية —
      // TODO(Phase 2): نقلها إلى دالة Postgres واحدة عبر ITransactionRunner.
      const { error: deleteError } = await this.client
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId);

      if (deleteError)
        return err(
          toDomainDbError(deleteError, { entity: "صلاحيات الدور", id: roleId }),
        );

      if (permissionIds.length === 0) return okVoid();

      const { error: insertError } = await this.client.from("role_permissions").insert(
        permissionIds.map((permissionId) => ({
          role_id: roleId,
          permission_id: permissionId,
        })),
      );

      if (insertError)
        return err(
          toDomainDbError(insertError, { entity: "صلاحيات الدور", id: roleId }),
        );

      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل صلاحيات الدور"));
    }
  }

  async createRole(role: {
    key: string;
    name: string;
    description: string | null;
  }): Promise<Result<RoleDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("roles")
        .insert({
          key: role.key,
          name: role.name,
          description: role.description,
          is_system: false,
        })
        .select("id, key, name, description, is_system")
        .single();

      if (error) return err(toDomainDbError(error, { entity: "الأدوار" }));

      return ok({
        id: data.id,
        key: data.key,
        name: data.name,
        description: data.description,
        isSystem: data.is_system,
        permissionKeys: [],
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر إضافة الدور"));
    }
  }

  async updateRole(role: {
    id: string;
    name: string;
    description: string | null;
  }): Promise<Result<RoleDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("roles")
        .update({
          name: role.name,
          description: role.description,
        })
        .eq("id", role.id)
        .select(
          "id, key, name, description, is_system, role_permissions(permissions(key))",
        )
        .single();

      if (error) return err(toDomainDbError(error, { entity: "الأدوار", id: role.id }));

      const row = data as unknown as RoleWithPermissionsRow;
      return ok({
        id: row.id,
        key: row.key,
        name: row.name,
        description: row.description,
        isSystem: row.is_system,
        permissionKeys: (row.role_permissions ?? [])
          .map((link) => link.permissions?.key)
          .filter((key): key is string => key !== undefined),
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل الدور"));
    }
  }

  async deleteRole(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("roles")
        .delete()
        .eq("id", id)
        .eq("is_system", false);

      if (error) return err(toDomainDbError(error, { entity: "الأدوار", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف الدور"));
    }
  }

  async getUsersCountForRole(roleId: string): Promise<Result<number, DomainError>> {
    try {
      const { count, error } = await this.client
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role_id", roleId);

      if (error) return err(toDomainDbError(error, { entity: "مستخدمو الدور", id: roleId }));
      return ok(count ?? 0);
    } catch (e) {
      return err(toDomainError(e, "تعذّر حساب عدد مستخدمي الدور"));
    }
  }

  async assignRoleToUser(
    userId: string,
    roleId: string,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("user_roles")
        .insert({ user_id: userId, role_id: roleId });

      if (error)
        return err(toDomainDbError(error, { entity: "دور الموظف", id: userId }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر إسناد الدور"));
    }
  }

  async removeRoleFromUser(
    userId: string,
    roleId: string,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role_id", roleId);

      if (error)
        return err(toDomainDbError(error, { entity: "دور الموظف", id: userId }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر إزالة الدور"));
    }
  }
}
