import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { AssignUserToProjectDto, ProjectAssignmentDto } from "../dtos";
import type { IProjectAssignmentRepository } from "../ports/project-assignment-repository";

/**
 * اعتماد موظف على مشروع — وهو ما يفتح له رؤية المشروع والتوقيع عليه.
 * صلاحية project.assign تُفرض في RLS، وهذه الطبقة تتحقّق من صحة المدخلات فقط.
 */
export class AssignUserToProject implements UseCase<
  AssignUserToProjectDto,
  ProjectAssignmentDto
> {
  private readonly assignments: IProjectAssignmentRepository;

  constructor(assignments: IProjectAssignmentRepository) {
    this.assignments = assignments;
  }

  async execute(
    input: AssignUserToProjectDto,
  ): Promise<Result<ProjectAssignmentDto, DomainError>> {
    if (input.projectId.trim().length === 0) {
      return err(new ValidationError("المشروع مطلوب", { projectId: "required" }));
    }
    if (input.userId.trim().length === 0) {
      return err(new ValidationError("الموظف مطلوب", { userId: "required" }));
    }

    return this.assignments.assign(input);
  }
}
