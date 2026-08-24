import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  CreateMaterialRequestDto,
  MaterialRequestDto,
  ProjectItemLimitDto,
  SaveProjectItemLimitDto,
} from "../dtos";

export interface IMaterialRequestRepository {
  /** RLS تحصر الطلبات في المشاريع المعتمدة للمستخدم. */
  list(): Promise<Result<readonly MaterialRequestDto[], DomainError>>;
  findById(id: string): Promise<Result<MaterialRequestDto | null, DomainError>>;
  create(
    input: CreateMaterialRequestDto,
  ): Promise<Result<MaterialRequestDto, DomainError>>;
  setStatus(id: string, status: string): Promise<Result<void, DomainError>>;

  /** حدود المكتب الفني مع المتوفّر بالموقع لكل صنف. */
  listLimits(
    projectId: string,
  ): Promise<Result<readonly ProjectItemLimitDto[], DomainError>>;
  saveLimit(input: SaveProjectItemLimitDto): Promise<Result<void, DomainError>>;
  saveSiteStock(
    projectId: string,
    itemId: string,
    quantity: number,
  ): Promise<Result<void, DomainError>>;
}
