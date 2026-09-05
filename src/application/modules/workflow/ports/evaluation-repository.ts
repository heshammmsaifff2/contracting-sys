import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  EvaluationAuditRowDto,
  EvaluationCategoryDto,
  EvaluationCategoryScoreDto,
  EvaluationCriterionDto,
  EvaluationPeriodRowDto,
  EvaluationRuleDto,
  EvaluationSummaryDto,
  RulePreviewRowDto,
  SaveEvaluationRuleDto,
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

  // ── المرحلة ٠٨ ────────────────────────────────────────────────────────
  listCategories(): Promise<Result<readonly EvaluationCategoryDto[], DomainError>>;
  listCategoryScores(
    period: string,
  ): Promise<Result<readonly EvaluationCategoryScoreDto[], DomainError>>;

  listRules(): Promise<Result<readonly EvaluationRuleDto[], DomainError>>;
  saveRule(input: SaveEvaluationRuleDto): Promise<Result<void, DomainError>>;
  removeRule(id: string): Promise<Result<void, DomainError>>;
  /** المُختبِر التجريبي — يقرأ ولا يكتب. */
  previewRules(
    period: string,
    ruleId: string | null,
  ): Promise<Result<readonly RulePreviewRowDto[], DomainError>>;
  applyRules(
    period: string,
    ruleId: string | null,
  ): Promise<Result<number, DomainError>>;
  revokeRule(period: string, ruleId: string): Promise<Result<number, DomainError>>;

  /** الدرجة النهائية: المجمَّدة من اللقطة، والجارية حيّةً. */
  listPeriodReport(
    period: string,
  ): Promise<Result<readonly EvaluationPeriodRowDto[], DomainError>>;
  takeSnapshot(period: string): Promise<Result<number, DomainError>>;
  clearSnapshot(period: string, reason: string): Promise<Result<number, DomainError>>;

  listAudit(
    period: string | null,
  ): Promise<Result<readonly EvaluationAuditRowDto[], DomainError>>;
}
