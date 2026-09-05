/**
 * Use-cases التقييم الموسَّع [المرحلة ٠٨].
 *
 * ثلاثة أفعال تكتب في ملفّ موظف: تعريف قاعدة، وتطبيقها، وتجميد فترة.
 * ولكلٍّ حارسه هنا وحارسه في القاعدة — الواجهة تمنع المعطوب قبل الشبكة،
 * والخادم لا يثق بالواجهة.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import { validateCondition } from "@core/modules/workflow/entities/WorkflowCondition";
import {
  canFreezePeriod,
  ruleProblems,
  type RuleProblem,
} from "@core/modules/workflow/entities/EvaluationRule";
import type { UseCase } from "@application/shared/use-case";
import type {
  EvaluationAuditRowDto,
  EvaluationCategoryDto,
  EvaluationCategoryScoreDto,
  EvaluationPeriodRowDto,
  EvaluationRuleDto,
  RulePreviewRowDto,
  SaveEvaluationRuleDto,
} from "../dtos";
import type { IEvaluationRepository } from "../ports/evaluation-repository";

const PERIOD_PATTERN = /^[0-9]{4}-[0-9]{2}$/;

const RULE_PROBLEM_MESSAGES: Record<RuleProblem, string> = {
  no_condition: "القاعدة بلا شرط تُطبَّق على الجميع — اكتب شرطها",
  points_not_positive: "النقاط يجب أن تكون أكبر من صفر",
  unknown_unit_field: "الضرب يكون في عدّاد لا في نسبة ولا معرّف",
  unit_without_cap: "القاعدة بوحدة تحتاج سقفًا — بغيره تمحو الدرجة كلّها",
  cap_not_positive: "السقف يجب أن يكون أكبر من صفر",
};

/** يُرجع الخطأ لا النتيجة: النتيجة تُبنى عند النداء بنوعها هناك. */
function periodError(period: string): ValidationError | null {
  return PERIOD_PATTERN.test(period)
    ? null
    : new ValidationError("الفترة بصيغة YYYY-MM", { period: "pattern" });
}

// ── الفئات ──────────────────────────────────────────────────────────────
export class ListEvaluationCategories implements UseCase<
  void,
  readonly EvaluationCategoryDto[]
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly EvaluationCategoryDto[], DomainError>> {
    return this.repo.listCategories();
  }
}

export class ListCategoryScores implements UseCase<
  { period: string },
  readonly EvaluationCategoryScoreDto[]
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    period: string;
  }): Promise<Result<readonly EvaluationCategoryScoreDto[], DomainError>> {
    const invalid = periodError(input.period);
    if (invalid !== null) return err(invalid);
    return this.repo.listCategoryScores(input.period);
  }
}

// ── القواعد ─────────────────────────────────────────────────────────────
export class ListEvaluationRules implements UseCase<
  void,
  readonly EvaluationRuleDto[]
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly EvaluationRuleDto[], DomainError>> {
    return this.repo.listRules();
  }
}

export class SaveEvaluationRule implements UseCase<SaveEvaluationRuleDto, void> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: SaveEvaluationRuleDto): Promise<Result<void, DomainError>> {
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(input.key)) {
      return err(
        new ValidationError(
          "مفتاح القاعدة يقبل الحروف الإنجليزية الصغيرة والأرقام و _ فقط",
          { key: "pattern" },
        ),
      );
    }
    if (input.name.trim().length < 2) {
      return err(new ValidationError("اسم القاعدة مطلوب", { name: "required" }));
    }

    const problems = ruleProblems({
      condition: input.condition,
      effect: input.effect,
      points: input.points,
      perUnitField: input.perUnitField,
      maxPoints: input.maxPoints,
    });
    const first = problems[0];
    if (first !== undefined) {
      return err(new ValidationError(RULE_PROBLEM_MESSAGES[first], { rule: first }));
    }

    const condition = validateCondition(input.condition);
    if (!condition.ok) return condition;

    return this.repo.saveRule(input);
  }
}

export class RemoveEvaluationRule implements UseCase<{ id: string }, void> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeRule(input.id);
  }
}

/**
 * المُختبِر التجريبي: ماذا ستفعل القواعد لو طُبِّقت — بلا أن تكتب حرفًا.
 * هذا هو الفرق بين قاعدة تُجرَّب وقاعدة تُفاجئ ثلاثين موظفًا.
 */
export class PreviewEvaluationRules implements UseCase<
  { period: string; ruleId: string | null },
  readonly RulePreviewRowDto[]
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    period: string;
    ruleId: string | null;
  }): Promise<Result<readonly RulePreviewRowDto[], DomainError>> {
    const invalid = periodError(input.period);
    if (invalid !== null) return err(invalid);
    return this.repo.previewRules(input.period, input.ruleId);
  }
}

export class ApplyEvaluationRules implements UseCase<
  { period: string; ruleId: string | null },
  number
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    period: string;
    ruleId: string | null;
  }): Promise<Result<number, DomainError>> {
    const invalid = periodError(input.period);
    if (invalid !== null) return err(invalid);
    return this.repo.applyRules(input.period, input.ruleId);
  }
}

export class RevokeEvaluationRule implements UseCase<
  { period: string; ruleId: string },
  number
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    period: string;
    ruleId: string;
  }): Promise<Result<number, DomainError>> {
    const invalid = periodError(input.period);
    if (invalid !== null) return err(invalid);
    return this.repo.revokeRule(input.period, input.ruleId);
  }
}

// ── التقرير واللقطة ─────────────────────────────────────────────────────
export class ListEvaluationPeriodReport implements UseCase<
  { period: string },
  readonly EvaluationPeriodRowDto[]
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    period: string;
  }): Promise<Result<readonly EvaluationPeriodRowDto[], DomainError>> {
    const invalid = periodError(input.period);
    if (invalid !== null) return err(invalid);
    return this.repo.listPeriodReport(input.period);
  }
}

/** الفترة الجارية لا تُجمَّد: يومها لم ينتهِ بعد. */
export class TakeEvaluationSnapshot implements UseCase<
  { period: string; currentPeriod: string },
  number
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    period: string;
    currentPeriod: string;
  }): Promise<Result<number, DomainError>> {
    if (!canFreezePeriod(input.period, input.currentPeriod)) {
      return err(
        new ValidationError("لا تُجمَّد فترة لم تنتهِ بعد", { period: "not_finished" }),
      );
    }
    return this.repo.takeSnapshot(input.period);
  }
}

/**
 * فكّ التجميد يُبطل ترتيبًا أُعلن. سببه إلزاميّ — ويُكتب في سجلّ التدقيق
 * قبل أن تُحذف اللقطة.
 */
export class ClearEvaluationSnapshot implements UseCase<
  { period: string; reason: string },
  number
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    period: string;
    reason: string;
  }): Promise<Result<number, DomainError>> {
    const invalid = periodError(input.period);
    if (invalid !== null) return err(invalid);
    if (input.reason.trim() === "") {
      return err(new ValidationError("سبب فكّ التجميد مطلوب", { reason: "required" }));
    }
    return this.repo.clearSnapshot(input.period, input.reason);
  }
}

export class ListEvaluationAudit implements UseCase<
  { period: string | null },
  readonly EvaluationAuditRowDto[]
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    period: string | null;
  }): Promise<Result<readonly EvaluationAuditRowDto[], DomainError>> {
    return this.repo.listAudit(input.period);
  }
}
