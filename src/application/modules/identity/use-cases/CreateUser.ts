import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import { Profile } from "@core/modules/identity/entities/Profile";
import type { UseCase } from "@application/shared/use-case";
import type { CreateUserInput } from "../dtos";
import type { IUserAdminService } from "../ports/user-admin-service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_PASSWORD_LENGTH = 8;

export class CreateUser implements UseCase<CreateUserInput, { userId: string }> {
  private readonly admin: IUserAdminService;

  constructor(admin: IUserAdminService) {
    this.admin = admin;
  }

  async execute(
    input: CreateUserInput,
  ): Promise<Result<{ userId: string }, DomainError>> {
    const email = input.email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      return err(
        new ValidationError("البريد الإلكتروني غير صالح", { email: "invalid" }),
      );
    }
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      return err(
        new ValidationError("كلمة المرور يجب ألا تقلّ عن 8 أحرف", {
          password: "too_short",
        }),
      );
    }
    if (input.jobId !== null && !UUID_PATTERN.test(input.jobId)) {
      return err(new ValidationError("الوظيفة غير صالحة", { jobId: "invalid" }));
    }

    // التصنيف لا يُفحص: يُشتقّ من الوظيفة عند إنشاء الملف
    const validated = Profile.validateEditable({
      fullName: input.fullName,
      code: input.code ?? null,
    });
    if (!validated.ok) return validated;

    return this.admin.createUser({
      email,
      password: input.password,
      fullName: validated.value.fullName,
      jobId: input.jobId,
      code: validated.value.code?.value ?? null,
      roleKeys: input.roleKeys ?? [],
    });
  }
}
