import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  DurationChangeDto,
  SaveActionRouteDto,
  SaveStageParticipantDto,
  SaveStagePositionsDto,
  SaveStageRequirementDto,
  SaveWorkflowActionDto,
  SaveWorkflowDefinitionDto,
  SaveWorkflowStageDto,
  WorkflowDefinitionDto,
} from "../dtos";

export interface IWorkflowDefinitionRepository {
  list(): Promise<Result<readonly WorkflowDefinitionDto[], DomainError>>;
  saveDefinition(
    input: SaveWorkflowDefinitionDto,
  ): Promise<Result<WorkflowDefinitionDto, DomainError>>;
  /** حذف تعريف بإصداره وكل ما تحته — يُرفض إن سارت عليه معاملة. */
  removeDefinition(id: string): Promise<Result<void, DomainError>>;
  saveStage(input: SaveWorkflowStageDto): Promise<Result<void, DomainError>>;
  removeStage(id: string): Promise<Result<void, DomainError>>;
  /** مواضع عُقَد المحرّر المرئي — دفعة واحدة، وعمودا الموضع وحدهما. */
  saveStagePositions(input: SaveStagePositionsDto): Promise<Result<void, DomainError>>;
  /** مشاركو المرحلة — أكثر من واحد يعني وقوفها عند أكثر من موظف. */
  saveParticipant(input: SaveStageParticipantDto): Promise<Result<void, DomainError>>;
  removeParticipant(id: string): Promise<Result<void, DomainError>>;
  /** أزرار المرحلة: نوع الزرّ يحدّد لونه وسلوكه. */
  saveAction(input: SaveWorkflowActionDto): Promise<Result<void, DomainError>>;
  removeAction(id: string): Promise<Result<void, DomainError>>;
  /** وجهات الزرّ بشروطها — هنا يقع التفريع. */
  saveRoute(input: SaveActionRouteDto): Promise<Result<void, DomainError>>;
  removeRoute(id: string): Promise<Result<void, DomainError>>;
  /** شروط جاهزية المرحلة — تُقاس قبل التقدّم [المرحلة ٠٧]. */
  saveRequirement(input: SaveStageRequirementDto): Promise<Result<void, DomainError>>;
  removeRequirement(id: string): Promise<Result<void, DomainError>>;
  /** نسخة مسودّة من إصدار قائم — المنشور لا يُعدَّل. */
  createDraft(definitionId: string): Promise<Result<string, DomainError>>;
  /** نشر المسودّة وإحالة سابقها للتقاعد. */
  publishVersion(definitionId: string): Promise<Result<void, DomainError>>;
  /** تقرير المدد المعدّلة: قبل/بعد/الموظف [المراسلات 5]. */
  listDurationChanges(): Promise<Result<readonly DurationChangeDto[], DomainError>>;
}
