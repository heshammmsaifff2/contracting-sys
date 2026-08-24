import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { Profile } from "@core/modules/identity/entities/Profile";
import type { ProfileDto, UpdateProfileInput } from "../dtos";

export interface IProfileRepository {
  findById(id: string): Promise<Result<Profile | null, DomainError>>;
  /** قائمة الموظفين مع أدوارهم — تحترم RLS تلقائيًا. */
  list(): Promise<Result<readonly ProfileDto[], DomainError>>;
  update(input: UpdateProfileInput): Promise<Result<Profile, DomainError>>;
  setActive(id: string, isActive: boolean): Promise<Result<void, DomainError>>;
}
