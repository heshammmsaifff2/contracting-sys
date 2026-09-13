import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IProjectAssignmentRepository } from "../ports/project-assignment-repository";

export interface SetAssignmentHolderInput {
  id: string;
  /** null = تُفرَغ الخانة. */
  userId: string | null;
}

/** يملأ خانة الوظيفة أو يبدّل شاغلها أو يُفرغها. */
export class SetAssignmentHolder implements UseCase<SetAssignmentHolderInput, void> {
  private readonly assignments: IProjectAssignmentRepository;

  constructor(assignments: IProjectAssignmentRepository) {
    this.assignments = assignments;
  }

  async execute(input: SetAssignmentHolderInput): Promise<Result<void, DomainError>> {
    if (input.id.trim().length === 0) {
      return err(new ValidationError("الخانة مطلوبة", { id: "required" }));
    }
    const userId =
      input.userId === null || input.userId.trim() === "" ? null : input.userId;
    return this.assignments.setHolder(input.id, userId);
  }
}
