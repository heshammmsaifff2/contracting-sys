/**
 * إدارة تعريفات سير العمل وتقويم العمل والتقييم.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import { WorkSchedule } from "@core/modules/workflow/entities/WorkSchedule";
import { actionSupportsReturnMinutes } from "@core/modules/workflow/entities/WorkflowAction";
import { validateCondition } from "@core/modules/workflow/entities/WorkflowCondition";
import {
  publishBlockers,
  type PublishBlocker,
  type PublishCandidateStage,
} from "@core/modules/workflow/entities/WorkflowGovernance";
import type { UseCase } from "@application/shared/use-case";
import type {
  EvaluationCriterionDto,
  EvaluationSummaryDto,
  HolidayDto,
  SaveActionRouteDto,
  SaveEvaluationScoreDto,
  SaveHolidayDto,
  SavePipelineWorkflowDto,
  SaveStageParticipantDto,
  SaveStagePositionsDto,
  SaveStageRequirementDto,
  SaveWorkflowActionDto,
  SaveWorkflowDefinitionDto,
  SaveWorkflowStageDto,
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

/**
 * إنشاء مسار كامل عبر منشئ خطوط الأنابيب (Pipeline Builder).
 */
export class SavePipelineWorkflow implements UseCase<
  SavePipelineWorkflowDto,
  WorkflowDefinitionDto
> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(
    input: SavePipelineWorkflowDto,
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
    if (!input.stages || input.stages.length === 0) {
      return err(
        new ValidationError("المسار يجب أن يحتوي على مرحلة واحدة على الأقل", {
          stages: "empty",
        }),
      );
    }
    for (let i = 0; i < input.stages.length; i++) {
      const stage = input.stages[i];
      if (!stage || !stage.name || stage.name.trim().length === 0) {
        return err(
          new ValidationError(`اسم المرحلة رقم ${i + 1} مطلوب`, {
            [`stages.${i}.name`]: "required",
          }),
        );
      }
    }
    return this.repo.savePipeline(input);
  }
}

/**
 * حذف تعريف مسار.
 *
 * الحارس الحقيقي في القاعدة (معاملة واحدة تمنع)، وهذا يمنع النداء العابث
 * قبل الشبكة ويعطي الرسالة نفسها.
 */
export class RemoveWorkflowDefinition implements UseCase<
  { id: string; transactionCount: number },
  void
> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: {
    id: string;
    transactionCount: number;
  }): Promise<Result<void, DomainError>> {
    if (input.transactionCount > 0) {
      return err(
        new ValidationError(
          `لا يُحذف: ${input.transactionCount} معاملة تسير على هذا الإصدار أو سارت عليه. عطّله بدل حذفه.`,
          { transactions: "in_use" },
        ),
      );
    }
    return this.repo.removeDefinition(input.id);
  }
}

export class SaveWorkflowStage implements UseCase<SaveWorkflowStageDto, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: SaveWorkflowStageDto): Promise<Result<void, DomainError>> {
    if (input.name.trim().length < 2) {
      return err(new ValidationError("اسم المرحلة مطلوب", { name: "required" }));
    }
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(input.stageKey)) {
      return err(
        new ValidationError(
          "مفتاح المرحلة يقبل الحروف الإنجليزية الصغيرة والأرقام و _ فقط",
          { stageKey: "pattern" },
        ),
      );
    }
    // النصاب بلا عدد بلا معنى، والعدد بلا نصاب يضلّل من يقرأ التعريف
    if (input.completionPolicy === "quorum") {
      if (!Number.isInteger(input.quorumCount) || (input.quorumCount ?? 0) < 1) {
        return err(
          new ValidationError("النصاب يحتاج عددًا أكبر من صفر", {
            quorumCount: "required",
          }),
        );
      }
    } else if (input.quorumCount !== null) {
      return err(
        new ValidationError("العدد لا يُضبَط إلا مع سياسة النصاب", {
          quorumCount: "unexpected",
        }),
      );
    }
    if (input.slaMinutes !== null && input.slaMinutes <= 0) {
      return err(
        new ValidationError("المهلة يجب أن تكون أكبر من صفر", {
          slaMinutes: "invalid",
        }),
      );
    }
    // مرحلة نهائية لا تُوجَّه إلى ما بعدها
    if (input.isFinal && input.defaultNextStageId !== null) {
      return err(
        new ValidationError("المرحلة النهائية لا يكون لها ما بعدها", {
          defaultNextStageId: "unexpected",
        }),
      );
    }
    if (input.defaultNextStageId !== null && input.defaultNextStageId === input.id) {
      return err(
        new ValidationError("المرحلة لا تُوجَّه إلى نفسها", {
          defaultNextStageId: "self_loop",
        }),
      );
    }
    return this.repo.saveStage(input);
  }
}

/**
 * حفظ مواضع العُقَد بعد السحب.
 *
 * منفصل عن `SaveWorkflowStage` عمدًا: تحريك عقدة عرضٌ لا تعريف، ولا يصحّ
 * أن يمرّ معه `is_final` ولا `sla_minutes` في كل مرة يُسحب فيها مستطيل.
 */
export class SaveStagePositions implements UseCase<SaveStagePositionsDto, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: SaveStagePositionsDto): Promise<Result<void, DomainError>> {
    if (input.definitionId.trim() === "") {
      return err(new ValidationError("المسار مطلوب", { definitionId: "required" }));
    }
    if (input.positions.length === 0) {
      return err(new ValidationError("لا مواضع للحفظ", { positions: "empty" }));
    }
    // الحدّ نفسه المفروض في القاعدة، فتصل الرسالة مفهومة قبل الشبكة
    if (input.positions.length > 200) {
      return err(
        new ValidationError("عدد المواضع يتجاوز الحدّ المسموح", {
          positions: "too_many",
        }),
      );
    }
    if (
      input.positions.some(
        (position) =>
          !Number.isFinite(position.x) ||
          !Number.isFinite(position.y) ||
          position.id.trim() === "",
      )
    ) {
      return err(new ValidationError("موضع غير صالح", { positions: "invalid" }));
    }
    return this.repo.saveStagePositions(input);
  }
}

export class RemoveWorkflowStage implements UseCase<{ id: string }, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeStage(input.id);
  }
}

/**
 * مشارك على مرحلة. إضافة أكثر من مشارك هي ما يجعل المرحلة تقف عند
 * أكثر من موظف؛ و`role` وحده يتمدّد لكل حاملي الدور وقت التشغيل.
 */
export class SaveStageParticipant implements UseCase<SaveStageParticipantDto, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: SaveStageParticipantDto): Promise<Result<void, DomainError>> {
    const shapeError = ((): string | null => {
      switch (input.kind) {
        case "user":
          return input.userId === null ? "اختر الموظف" : null;
        case "role":
        case "project_role":
          return input.roleId === null ? "اختر الدور" : null;
        case "department_role":
          return input.roleId === null || input.departmentId === null
            ? "اختر الدور والقسم معًا"
            : null;
        case "requester":
          return null;
      }
    })();

    if (shapeError !== null) {
      return err(new ValidationError(shapeError, { kind: "incomplete" }));
    }
    return this.repo.saveParticipant(input);
  }
}

export class RemoveStageParticipant implements UseCase<{ id: string }, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeParticipant(input.id);
  }
}

// ── الإجراءات ومساراتها الشرطية ─────────────────────────────────────────
export class SaveWorkflowAction implements UseCase<SaveWorkflowActionDto, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: SaveWorkflowActionDto): Promise<Result<void, DomainError>> {
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(input.actionKey)) {
      return err(
        new ValidationError(
          "مفتاح الإجراء يقبل الحروف الإنجليزية الصغيرة والأرقام و _ فقط",
          { actionKey: "pattern" },
        ),
      );
    }
    if (input.label.trim() === "") {
      return err(new ValidationError("نصّ الزرّ مطلوب", { label: "required" }));
    }
    // مدّة الإعادة تخصّ الإرجاع وحده
    if (input.returnMinutes !== null) {
      if (!actionSupportsReturnMinutes(input.kind)) {
        return err(
          new ValidationError("مدّة الإعادة تخصّ إجراء الإرجاع وحده", {
            returnMinutes: "unexpected",
          }),
        );
      }
      if (input.returnMinutes <= 0) {
        return err(
          new ValidationError("مدّة الإعادة يجب أن تكون أكبر من صفر", {
            returnMinutes: "invalid",
          }),
        );
      }
    }
    return this.repo.saveAction(input);
  }
}

export class RemoveWorkflowAction implements UseCase<{ id: string }, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeAction(input.id);
  }
}

/**
 * وجهة مشروطة للزرّ. الشرط يُتحقَّق منه هنا وفي القاعدة معًا:
 * الواجهة تمنع الحفظ المعطوب، والخادم لا يثق بالواجهة.
 */
export class SaveActionRoute implements UseCase<SaveActionRouteDto, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: SaveActionRouteDto): Promise<Result<void, DomainError>> {
    if (!Number.isInteger(input.priority) || input.priority < 1) {
      return err(
        new ValidationError("الأولوية عدد صحيح يبدأ من 1", { priority: "invalid" }),
      );
    }
    if (input.targetStageId.trim() === "") {
      return err(
        new ValidationError("اختر المرحلة الوجهة", { targetStageId: "required" }),
      );
    }
    const condition = validateCondition(input.condition);
    if (!condition.ok) return condition;

    return this.repo.saveRoute(input);
  }
}

export class RemoveActionRoute implements UseCase<{ id: string }, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeRoute(input.id);
  }
}

// ── شروط الجاهزية [المرحلة ٠٧] ──────────────────────────────────────────
/**
 * شرط يُقاس قبل التقدّم. الرسالة إلزامية: «غير جاهزة» بلا سبب تُرجع الموظف
 * إلى المدير ليسأل عمّا ينقص، وهو ما تشتريه القاعدة أصلًا.
 */
export class SaveStageRequirement implements UseCase<SaveStageRequirementDto, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: SaveStageRequirementDto): Promise<Result<void, DomainError>> {
    if (input.message.trim().length < 3) {
      return err(
        new ValidationError("اكتب ما ينقص الموظف بوضوح", { message: "required" }),
      );
    }

    if (input.kind === "condition") {
      if (input.minAttachments !== null) {
        return err(
          new ValidationError("عدد المرفقات لا يُضبَط مع شرط محسوب", {
            minAttachments: "unexpected",
          }),
        );
      }
      if (input.condition === null) {
        return err(new ValidationError("الشرط مطلوب", { condition: "required" }));
      }
      const condition = validateCondition(input.condition);
      if (!condition.ok) return condition;
    } else {
      if (input.condition !== null) {
        return err(
          new ValidationError("الشرط لا يُضبَط مع اشتراط المرفقات", {
            condition: "unexpected",
          }),
        );
      }
      if (!Number.isInteger(input.minAttachments) || (input.minAttachments ?? 0) < 1) {
        return err(
          new ValidationError("عدد المرفقات عدد صحيح يبدأ من 1", {
            minAttachments: "invalid",
          }),
        );
      }
    }

    return this.repo.saveRequirement(input);
  }
}

export class RemoveStageRequirement implements UseCase<{ id: string }, void> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeRequirement(input.id);
  }
}

// ── إصدارات المسار [المرحلة ٠٧] ─────────────────────────────────────────
/** نسخة مسودّة قابلة للتحرير — المنشور مجمَّد لأن معاملات تسير عليه. */
export class CreateWorkflowDraft implements UseCase<{ definitionId: string }, string> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: { definitionId: string }): Promise<Result<string, DomainError>> {
    return this.repo.createDraft(input.definitionId);
  }
}

/**
 * النشر. موانعه تُفحَص هنا للرسالة الفورية، وتُفحَص في القاعدة للحقيقة:
 * النشر يغيّر ما تفعله المعاملات القادمة، فلا يُترك لثقةٍ في متصفّح.
 */
export class PublishWorkflowVersion implements UseCase<
  { definitionId: string; stages: readonly PublishCandidateStage[] },
  void
> {
  private readonly repo: IWorkflowDefinitionRepository;

  constructor(repo: IWorkflowDefinitionRepository) {
    this.repo = repo;
  }

  async execute(input: {
    definitionId: string;
    stages: readonly PublishCandidateStage[];
  }): Promise<Result<void, DomainError>> {
    const blockers = publishBlockers(input.stages);
    const first = blockers[0];
    if (first !== undefined) {
      return err(
        new ValidationError(
          first.subject === ""
            ? PUBLISH_BLOCKER_MESSAGES[first.code]
            : `${PUBLISH_BLOCKER_MESSAGES[first.code]}: ${first.subject}`,
          { stages: first.code },
        ),
      );
    }
    return this.repo.publishVersion(input.definitionId);
  }
}

const PUBLISH_BLOCKER_MESSAGES: Record<PublishBlocker, string> = {
  no_start: "لا مرحلة بداية — المعاملة لا تجد أين تبدأ",
  no_final: "لا مرحلة نهائية — المسار لا يعرف أين ينتهي",
  stage_without_participants: "مرحلة بلا مشاركين — المعاملة تقف بلا صاحب",
  action_without_route: "زرّ بلا وجهة — يقف المسار عند ضغطه",
};

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
