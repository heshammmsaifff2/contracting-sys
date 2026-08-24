import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { ProjectDto } from "../dtos";
import type { IProjectRepository } from "../ports/project-repository";

/**
 * لا يمرّر هذا الـ use-case أي فلترة بالمشروع:
 * سياسة RLS على جدول projects هي التي تُرجع المشاريع المعتمد عليها المستخدم فقط،
 * فلا يمكن تجاوزها من الواجهة مهما كان الاستدعاء.
 */
export class ListProjects implements UseCase<void, readonly ProjectDto[]> {
  private readonly projects: IProjectRepository;

  constructor(projects: IProjectRepository) {
    this.projects = projects;
  }

  async execute(): Promise<Result<readonly ProjectDto[], DomainError>> {
    return this.projects.list();
  }
}
