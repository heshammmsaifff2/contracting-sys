import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IProjectAssignmentRepository } from "../ports/project-assignment-repository";

export class RemoveProjectAssignment implements UseCase<{ id: string }, void> {
  private readonly assignments: IProjectAssignmentRepository;

  constructor(assignments: IProjectAssignmentRepository) {
    this.assignments = assignments;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.assignments.remove(input.id);
  }
}
