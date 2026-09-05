/**
 * Use-cases المجدوِل — ما يفعله النظام بنفسه بجدول زمني.
 *
 * الخطاب معاملة عادية يبدؤها المجدوِل، فلا use-case خاصًّا بالخطابات:
 * `start_workflow` يبدأ أي مسار، و`notify` يرسل إشعارًا بلا معاملة.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import {
  validateAudience,
  validateScheduleSpec,
  type ScheduleKind,
  type ScheduleSpec,
} from "@core/modules/workflow/entities/ScheduledTask";
import type { UseCase } from "@application/shared/use-case";
import type {
  SaveScheduledTaskDto,
  ScheduledTaskDto,
  ScheduledTaskRunDto,
} from "../dtos";
import type { ISchedulerRepository } from "../ports/scheduler-repository";

export class ListScheduledTasks implements UseCase<void, readonly ScheduledTaskDto[]> {
  private readonly repo: ISchedulerRepository;

  constructor(repo: ISchedulerRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly ScheduledTaskDto[], DomainError>> {
    return this.repo.list();
  }
}

export class SaveScheduledTask implements UseCase<SaveScheduledTaskDto, void> {
  private readonly repo: ISchedulerRepository;

  constructor(repo: ISchedulerRepository) {
    this.repo = repo;
  }

  async execute(input: SaveScheduledTaskDto): Promise<Result<void, DomainError>> {
    if (input.name.trim().length < 2) {
      return err(new ValidationError("اسم المهمة مطلوب", { name: "required" }));
    }

    // مسار بلا نوع لا يُبدأ، وإشعار بلا عنوان لا يُقرأ
    if (input.action === "start_workflow") {
      if ((input.transactionType ?? "").trim() === "") {
        return err(
          new ValidationError("اختر نوع المعاملة التي ستبدأ", {
            transactionType: "required",
          }),
        );
      }
    } else if (input.subjectTemplate.trim() === "") {
      return err(
        new ValidationError("عنوان الإشعار مطلوب", { subjectTemplate: "required" }),
      );
    }

    const audience = validateAudience(input.audience);
    if (!audience.ok) return audience;

    const schedule = validateScheduleSpec(input.scheduleKind, input.scheduleSpec);
    if (!schedule.ok) return schedule;

    return this.repo.save(input);
  }
}

export class RemoveScheduledTask implements UseCase<{ id: string }, void> {
  private readonly repo: ISchedulerRepository;

  constructor(repo: ISchedulerRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.remove(input.id);
  }
}

/** تشغيل يدوي — يختبر المهمة على الجمهور الحقيقي، فليس تجربة جافّة. */
export class RunScheduledTaskNow implements UseCase<{ id: string }, void> {
  private readonly repo: ISchedulerRepository;

  constructor(repo: ISchedulerRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.runNow(input.id);
  }
}

export class ListScheduledTaskRuns implements UseCase<
  { taskId: string },
  readonly ScheduledTaskRunDto[]
> {
  private readonly repo: ISchedulerRepository;

  constructor(repo: ISchedulerRepository) {
    this.repo = repo;
  }

  async execute(input: {
    taskId: string;
  }): Promise<Result<readonly ScheduledTaskRunDto[], DomainError>> {
    return this.repo.listRuns(input.taskId);
  }
}

export interface PreviewScheduleInput {
  kind: ScheduleKind;
  spec: ScheduleSpec;
  shiftToWorkday: boolean;
  count?: number;
}

/** «متى تعمل بعد ذلك» — بتوقيت الشركة ومواعيد دوامها، لا بتوقيت المتصفّح. */
export class PreviewSchedule implements UseCase<
  PreviewScheduleInput,
  readonly string[]
> {
  private readonly repo: ISchedulerRepository;

  constructor(repo: ISchedulerRepository) {
    this.repo = repo;
  }

  async execute(
    input: PreviewScheduleInput,
  ): Promise<Result<readonly string[], DomainError>> {
    const schedule = validateScheduleSpec(input.kind, input.spec);
    if (!schedule.ok) return schedule;

    return this.repo.previewSchedule(
      input.kind,
      input.spec,
      input.shiftToWorkday,
      input.count ?? 5,
    );
  }
}
