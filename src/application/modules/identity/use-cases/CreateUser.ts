import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import { Profile } from "@core/modules/identity/entities/Profile";
import type { UseCase } from "@application/shared/use-case";
import type { CreateUserInput } from "../dtos";
import type { IUserAdminService } from "../ports/user-admin-service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
/** معرّف صوري للتحقّق فقط — المعرّف الحقيقي يصدر من مزوّد المصادقة. */
const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

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

    // نستخدم قواعد الدومين نفسها للتحقّق من الاسم والكود والتصنيف
    const validated = Profile.create({
      id: PLACEHOLDER_ID,
      fullName: input.fullName,
      employeeType: input.employeeType,
      code: input.code ?? null,
    });
    if (!validated.ok) return validated;

    return this.admin.createUser({
      email,
      password: input.password,
      fullName: validated.value.fullName,
      employeeType: validated.value.employeeType,
      code: validated.value.code?.value ?? null,
      roleKeys: input.roleKeys ?? [],
    });
  }
}
