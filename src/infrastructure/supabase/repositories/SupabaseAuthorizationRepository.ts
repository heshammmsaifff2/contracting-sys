/**
 * يقرأ صلاحيات المستخدم ومشاريعه من دوال قاعدة البيانات نفسها التي تستخدمها
 * سياسات RLS — فلا يمكن أن تختلف الواجهة عمّا يسمح به الخادم فعليًا.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { IAuthorizationRepository } from "@application/modules/identity/ports/authorization-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

export class SupabaseAuthorizationRepository implements IAuthorizationRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async currentPermissions(): Promise<Result<readonly string[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("current_permissions");
      if (error) return err(toDomainDbError(error, { entity: "الصلاحيات" }));
      return ok(data ?? []);
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة صلاحيات المستخدم"));
    }
  }

  async currentProjectIds(): Promise<Result<readonly string[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("current_project_ids");
      if (error) return err(toDomainDbError(error, { entity: "المشاريع المعتمدة" }));
      return ok(data ?? []);
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المشاريع المعتمدة"));
    }
  }
}
