import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { SignInInput } from "../dtos";
import type { IAuthService, SessionIdentity } from "../ports/auth-service";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class SignIn implements UseCase<SignInInput, SessionIdentity> {
  private readonly auth: IAuthService;

  constructor(auth: IAuthService) {
    this.auth = auth;
  }

  async execute(input: SignInInput): Promise<Result<SessionIdentity, DomainError>> {
    const email = input.email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      return err(
        new ValidationError("البريد الإلكتروني غير صالح", { email: "invalid" }),
      );
    }
    if (input.password.length < 6) {
      return err(
        new ValidationError("كلمة المرور قصيرة جدًا", { password: "too_short" }),
      );
    }

    return this.auth.signIn({ email, password: input.password });
  }
}
