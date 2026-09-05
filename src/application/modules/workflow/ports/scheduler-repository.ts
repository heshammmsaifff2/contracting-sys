import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  ScheduleKind,
  ScheduleSpec,
} from "@core/modules/workflow/entities/ScheduledTask";
import type {
  SaveScheduledTaskDto,
  ScheduledTaskDto,
  ScheduledTaskRunDto,
} from "../dtos";

export interface ISchedulerRepository {
  /** حالة كل مهمة وحجم جمهورها **الآن** وعدد مرات فشلها. */
  list(): Promise<Result<readonly ScheduledTaskDto[], DomainError>>;
  save(input: SaveScheduledTaskDto): Promise<Result<void, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
  /** تشغيل يدوي لاختبار المهمة دون انتظار موعدها. */
  runNow(id: string): Promise<Result<void, DomainError>>;
  listRuns(
    taskId: string,
  ): Promise<Result<readonly ScheduledTaskRunDto[], DomainError>>;
  /** «متى تعمل بعد ذلك» — يُحسب في القاعدة بتوقيت الشركة لا في المتصفّح. */
  previewSchedule(
    kind: ScheduleKind,
    spec: ScheduleSpec,
    shiftToWorkday: boolean,
    count: number,
  ): Promise<Result<readonly string[], DomainError>>;
}
