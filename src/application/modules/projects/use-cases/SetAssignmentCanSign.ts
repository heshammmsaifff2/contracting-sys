import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IProjectAssignmentRepository } from "../ports/project-assignment-repository";

export interface SetAssignmentCanSignInput {
  id: string;
  canSign: boolean;
}

export class SetAssignmentCanSign implements UseCase<SetAssignmentCanSignInput, void> {
  private readonly assignments: IProjectAssignmentRepository;

  constructor(assignments: IProjectAssignmentRepository) {
    this.assignments = assignments;
  }

  async execute(input: SetAssignmentCanSignInput): Promise<Result<void, DomainError>> {
    return this.assignments.setCanSign(input.id, input.canSign);
  }
}
