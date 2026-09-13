import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { AssignUserToProjectDto, ProjectAssignmentDto } from "../dtos";
import type { IProjectAssignmentRepository } from "../ports/project-assignment-repository";

/**
 * إضافة خانة وظيفة على المشروع، بشاغلها أو شاغرة.
 *
 * أن يكون الشاغل من شاغلي الوظيفة فعلًا يُفرض في القاعدة — فهي وحدها تعرف
 * وظيفته لحظة الحفظ. وصلاحية project.assign تُفرض في RLS.
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
    if (input.jobId.trim().length === 0) {
      return err(new ValidationError("اختر الوظيفة", { jobId: "required" }));
    }

    return this.assignments.assign({
      ...input,
      userId: input.userId === null || input.userId.trim() === "" ? null : input.userId,
    });
  }
}
