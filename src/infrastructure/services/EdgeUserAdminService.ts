/**
 * إنشاء المستخدمين يمرّ عبر Edge Function تملك service_role وتتحقّق من
 * صلاحية user.create قبل التنفيذ. المتصفّح لا يرى المفتاح إطلاقًا.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { CreateUserInput } from "@application/modules/identity/dtos";
import type { IUserAdminService } from "@application/modules/identity/ports/user-admin-service";
import type { EdgeFnClient } from "./EdgeFnClient";

export class EdgeUserAdminService implements IUserAdminService {
  private readonly edgeFn: EdgeFnClient;

  constructor(edgeFn: EdgeFnClient) {
    this.edgeFn = edgeFn;
  }

  async createUser(
    input: CreateUserInput,
  ): Promise<Result<{ userId: string }, DomainError>> {
    return this.edgeFn.invoke<{ userId: string }>("admin-create-user", {
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      employeeType: input.employeeType,
      code: input.code ?? null,
      roleKeys: input.roleKeys ?? [],
    });
  }
}
