import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { CreateProjectDto, ProjectDto, UpdateProjectDto } from "../dtos";

export interface IProjectRepository {
  /**
   * RLS تتكفّل بإرجاع المشاريع المعتمد عليها المستخدم فقط،
   * ما لم يملك صلاحية project.read_all.
   */
  list(): Promise<Result<readonly ProjectDto[], DomainError>>;
  findById(id: string): Promise<Result<ProjectDto | null, DomainError>>;
  create(input: CreateProjectDto): Promise<Result<ProjectDto, DomainError>>;
  update(input: UpdateProjectDto): Promise<Result<ProjectDto, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}
