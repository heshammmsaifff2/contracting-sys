import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IAuthService } from "../ports/auth-service";

export class SignOut implements UseCase<void, void> {
  private readonly auth: IAuthService;

  constructor(auth: IAuthService) {
    this.auth = auth;
  }

  async execute(): Promise<Result<void, DomainError>> {
    return this.auth.signOut();
  }
}
