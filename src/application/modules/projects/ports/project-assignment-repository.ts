import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  AssignUserToProjectDto,
  ProjectAssignmentDto,
  ProjectMemberDto,
} from "../dtos";

export interface IProjectAssignmentRepository {
  listByProject(
    projectId: string,
  ): Promise<Result<readonly ProjectAssignmentDto[], DomainError>>;
  /** أعضاء المشاريع المرئية — عبر دالة خادم لا تكشف بقية الموظفين. */
  listMembers(
    projectId: string | null,
  ): Promise<Result<readonly ProjectMemberDto[], DomainError>>;
  assign(
    input: AssignUserToProjectDto,
  ): Promise<Result<ProjectAssignmentDto, DomainError>>;
  setCanSign(id: string, canSign: boolean): Promise<Result<void, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}
