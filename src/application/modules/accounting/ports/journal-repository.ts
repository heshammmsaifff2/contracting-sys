import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { JournalEntryDto } from "../dtos";

export interface JournalFilter {
  projectId?: string | null;
  limit?: number;
}

export interface IJournalRepository {
  /** RLS تحصر القيود في مشاريع المستخدم المعتمدة. */
  list(
    filter?: JournalFilter,
  ): Promise<Result<readonly JournalEntryDto[], DomainError>>;
  findById(id: string): Promise<Result<JournalEntryDto | null, DomainError>>;
}
