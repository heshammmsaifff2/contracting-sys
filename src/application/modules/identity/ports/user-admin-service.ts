import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { CreateUserInput } from "../dtos";

/**
 * إنشاء المستخدمين يتطلّب مفتاح service_role، فيتم حصريًا في Edge Function
 * تتحقّق من صلاحية user.create قبل التنفيذ. المتصفّح لا يملك المفتاح.
 */
export interface IUserAdminService {
  createUser(input: CreateUserInput): Promise<Result<{ userId: string }, DomainError>>;
}
