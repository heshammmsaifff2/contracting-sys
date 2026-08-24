/**
 * إدارة تعريفات سير العمل وتقويم العمل والتقييم.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import { WorkSchedule } from "@core/modules/workflow/entities/WorkSchedule";
import type { UseCase } from "@application/shared/use-case";
import type {
  EvaluationCriterionDto,
  EvaluationSummaryDto,
  HolidayDto,
  SaveEvaluationScoreDto,
  SaveHolidayDto,
  SaveWorkflowDefinitionDto,
  SaveWorkflowStepDto,
  SaveWorkScheduleDto,
  WorkflowDefinitionDto,
  WorkScheduleDto,
} from "../dtos";
import type { IWorkflowDefinitionRepository } from "../ports/workflow-definition-repository";
import type { IWorkCalendarRepository } from "../ports/work-calendar-repository";
import type { IEvaluationRepository } from "../ports/evaluation-repository";

/** معرّف صوري للتحقّق فقط — المعرّف الحقيقي يصدر من قاعدة البيانات. */
const PLACEHOLDER_ID = "00000000-0000-0000-0000-000000000000";

// ── تعريفات سير العمل ───────────────────────────────────────────────────
export class ListWorkflowDefinitions implements UseCase<
  void,
  readonly WorkflowDefinitionDto[]
> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly WorkflowDefinitionDto[], DomainError>> {
    return this.repo.list();
  }
}

export class SaveWorkflowDefinition implements UseCase<
  SaveWorkflowDefinitionDto,
  WorkflowDefinitionDto
> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(
    input: SaveWorkflowDefinitionDto,
  ): Promise<Result<WorkflowDefinitionDto, DomainError>> {
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(input.transactionType)) {
      return err(
        new ValidationError(
          "نوع المعاملة يقبل الحروف الإنجليزية الصغيرة والأرقام و _ فقط",
          { transactionType: "pattern" },
        ),
      );
    }
    if (input.name.trim().length < 2) {
      return err(new ValidationError("اسم المسار مطلوب", { name: "required" }));
    }
    return this.repo.saveDefinition(input);
  }
}

export class SaveWorkflowStep implements UseCase<SaveWorkflowStepDto, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: SaveWorkflowStepDto): Promise<Result<void, DomainError>> {
    if (input.name.trim().length < 2) {
      return err(new ValidationError("اسم المرحلة مطلوب", { name: "required" }));
    }
    if (!Number.isInteger(input.orderNo) || input.orderNo < 1) {
      return err(
        new ValidationError("ترتيب المرحلة يبدأ من 1", { orderNo: "invalid" }),
      );
    }
    return this.repo.saveStep(input);
  }
}

export class RemoveWorkflowStep implements UseCase<{ id: string }, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeStep(input.id);
  }
}

// ── تقويم العمل ─────────────────────────────────────────────────────────
export class ListWorkSchedules implements UseCase<void, readonly WorkScheduleDto[]> {
  private readonly repo: IWorkCalendarRepository;

  constructor(repo: IWorkCalendarRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly WorkScheduleDto[], DomainError>> {
    return this.repo.listSchedules();
  }
}

export class SaveWorkSchedule implements UseCase<SaveWorkScheduleDto, WorkScheduleDto> {
  private readonly repo: IWorkCalendarRepository;

  constructor(repo: IWorkCalendarRepository) {
    this.repo = repo;
  }

  async execute(
    input: SaveWorkScheduleDto,
  ): Promise<Result<WorkScheduleDto, DomainError>> {
    // قواعد الدومين ترفض النهاية قبل البداية والاستثناء بلا موظف
    const validated = WorkSchedule.create({
      id: input.id ?? PLACEHOLDER_ID,
      scope: input.scope,
      userId: input.userId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
    });
    if (!validated.ok) return validated;

    return this.repo.saveSchedule(input);
  }
}

export class RemoveWorkSchedule implements UseCase<{ id: string }, void> {
  private readonly repo: IWorkCalendarRepository;

  constructor(repo: IWorkCalendarRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeSchedule(input.id);
  }
}

export class ListHolidays implements UseCase<void, readonly HolidayDto[]> {
  private readonly repo: IWorkCalendarRepository;

  constructor(repo: IWorkCalendarRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly HolidayDto[], DomainError>> {
    return this.repo.listHolidays();
  }
}

export class AddHoliday implements UseCase<SaveHolidayDto, HolidayDto> {
  private readonly repo: IWorkCalendarRepository;

  constructor(repo: IWorkCalendarRepository) {
    this.repo = repo;
  }

  async execute(input: SaveHolidayDto): Promise<Result<HolidayDto, DomainError>> {
    if (Number.isNaN(new Date(input.holidayDate).getTime())) {
      return err(
        new ValidationError("تاريخ الإجازة غير صالح", { holidayDate: "invalid" }),
      );
    }
    return this.repo.addHoliday(input);
  }
}

export class RemoveHoliday implements UseCase<{ id: string }, void> {
  private readonly repo: IWorkCalendarRepository;

  constructor(repo: IWorkCalendarRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeHoliday(input.id);
  }
}

// ── التقييم ─────────────────────────────────────────────────────────────
export class ListEvaluationSummary implements UseCase<
  { period: string | null },
  readonly EvaluationSummaryDto[]
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    period: string | null;
  }): Promise<Result<readonly EvaluationSummaryDto[], DomainError>> {
    return this.repo.listSummary(input.period);
  }
}

export class ListEvaluationCriteria implements UseCase<
  void,
  readonly EvaluationCriterionDto[]
> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly EvaluationCriterionDto[], DomainError>> {
    return this.repo.listCriteria();
  }
}

export class SaveEvaluationScore implements UseCase<SaveEvaluationScoreDto, void> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: SaveEvaluationScoreDto): Promise<Result<void, DomainError>> {
    if (input.score < 0 || input.score > 100) {
      return err(new ValidationError("الدرجة بين صفر ومئة", { score: "out_of_range" }));
    }
    if (!/^[0-9]{4}-[0-9]{2}$/.test(input.period)) {
      return err(new ValidationError("الفترة بصيغة YYYY-MM", { period: "pattern" }));
    }
    return this.repo.saveScore(input);
  }
}

export interface SetCriterionWeightInput {
  criteriaId: string;
  employeeType: string;
  weight: number;
}

export class SetCriterionWeight implements UseCase<SetCriterionWeightInput, void> {
  private readonly repo: IEvaluationRepository;

  constructor(repo: IEvaluationRepository) {
    this.repo = repo;
  }

  async execute(input: SetCriterionWeightInput): Promise<Result<void, DomainError>> {
    if (input.weight < 0) {
      return err(new ValidationError("الوزن لا يكون سالبًا", { weight: "negative" }));
    }
    return this.repo.setWeight(input.criteriaId, input.employeeType, input.weight);
  }
}
