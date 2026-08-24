/**
 * أعضاء المشاريع المعتمدة — لاختيار المندوب أو المشرف في شاشات المخازن
 * دون منح صلاحية قراءة دفتر الموظفين كاملًا.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { ProjectMemberDto } from "../dtos";
import type { IProjectAssignmentRepository } from "../ports/project-assignment-repository";

export class ListProjectMembers implements UseCase<
  { projectId: string | null },
  readonly ProjectMemberDto[]
> {
  private readonly repo: IProjectAssignmentRepository;

  constructor(repo: IProjectAssignmentRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string | null;
  }): Promise<Result<readonly ProjectMemberDto[], DomainError>> {
    return this.repo.listMembers(input.projectId);
  }
}
