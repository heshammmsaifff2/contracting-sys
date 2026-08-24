import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  DurationChangeDto,
  SaveWorkflowDefinitionDto,
  SaveWorkflowStepDto,
  WorkflowDefinitionDto,
} from "../dtos";

export interface IWorkflowDefinitionRepository {
  list(): Promise<Result<readonly WorkflowDefinitionDto[], DomainError>>;
  saveDefinition(
    input: SaveWorkflowDefinitionDto,
  ): Promise<Result<WorkflowDefinitionDto, DomainError>>;
  saveStep(input: SaveWorkflowStepDto): Promise<Result<void, DomainError>>;
  removeStep(id: string): Promise<Result<void, DomainError>>;
  /** تقرير المدد المعدّلة: قبل/بعد/الموظف [المراسلات 5]. */
  listDurationChanges(): Promise<Result<readonly DurationChangeDto[], DomainError>>;
}
