import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { ProjectAssignmentDto } from "../dtos";
import type { IProjectAssignmentRepository } from "../ports/project-assignment-repository";

export class ListProjectAssignments implements UseCase<
  { projectId: string },
  readonly ProjectAssignmentDto[]
> {
  private readonly assignments: IProjectAssignmentRepository;

  constructor(assignments: IProjectAssignmentRepository) {
    this.assignments = assignments;
  }

  async execute(input: {
    projectId: string;
  }): Promise<Result<readonly ProjectAssignmentDto[], DomainError>> {
    return this.assignments.listByProject(input.projectId);
  }
}
