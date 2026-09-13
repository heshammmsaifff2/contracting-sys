import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  AttachmentAccessDto,
  DepartmentDto,
  SaveDepartmentInput,
  SaveJobInput,
} from "../dtos";

export interface IOrganizationRepository {
  /** الأقسام بوظائفها وأعداد شاغليها، مرتّبة كما تُعرض. */
  listDepartments(): Promise<Result<readonly DepartmentDto[], DomainError>>;
  listAttachmentAccess(
    departmentId: string,
  ): Promise<Result<readonly AttachmentAccessDto[], DomainError>>;
  /** القسم واستثناءاته في معاملة واحدة. يُرجع معرّف القسم. */
  saveDepartment(input: SaveDepartmentInput): Promise<Result<string, DomainError>>;
  deleteDepartment(id: string): Promise<Result<void, DomainError>>;
  saveJob(input: SaveJobInput): Promise<Result<string, DomainError>>;
  deleteJob(id: string): Promise<Result<void, DomainError>>;
}
