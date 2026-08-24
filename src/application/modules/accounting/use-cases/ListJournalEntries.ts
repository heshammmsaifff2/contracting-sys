import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { JournalEntryDto } from "../dtos";
import type { IJournalRepository, JournalFilter } from "../ports/journal-repository";

export class ListJournalEntries implements UseCase<
  JournalFilter,
  readonly JournalEntryDto[]
> {
  private readonly journal: IJournalRepository;

  constructor(journal: IJournalRepository) {
    this.journal = journal;
  }

  async execute(
    input: JournalFilter,
  ): Promise<Result<readonly JournalEntryDto[], DomainError>> {
    return this.journal.list(input);
  }
}
