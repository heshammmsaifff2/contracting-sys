import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  EvaluationCriterionDto,
  EvaluationSummaryDto,
  SaveEvaluationScoreDto,
} from "../dtos";

export interface IEvaluationRepository {
  /** الملخّص بالأوزان مع الترتيب — يحسبه الخادم [المراسلات 17، 18]. */
  listSummary(
    period: string | null,
  ): Promise<Result<readonly EvaluationSummaryDto[], DomainError>>;
  listCriteria(): Promise<Result<readonly EvaluationCriterionDto[], DomainError>>;
  saveScore(input: SaveEvaluationScoreDto): Promise<Result<void, DomainError>>;
  setWeight(
    criteriaId: string,
    employeeType: string,
    weight: number,
  ): Promise<Result<void, DomainError>>;
}
