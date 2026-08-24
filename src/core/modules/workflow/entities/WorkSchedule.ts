/**
 * WorkSchedule — يوم دوام. الاستثناء الفردي يُلغي العام لذلك اليوم [المراسلات 8].
 * الحساب الفعلي للعدّاد في Postgres؛ هذه القواعد للتحقّق قبل الحفظ.
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";

export type ScheduleScope = "global" | "user";

/** 0 = الأحد … 6 = السبت، مطابق لـ extract(dow) في Postgres. */
export const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export interface WorkScheduleProps {
  id: EntityId;
  scope: ScheduleScope;
  userId: EntityId | null;
  dayOfWeek: WeekDay;
  /** "HH:MM" */
  startTime: string;
  endTime: string;
}

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export class WorkSchedule {
  readonly id: EntityId;
  readonly scope: ScheduleScope;
  readonly userId: EntityId | null;
  readonly dayOfWeek: WeekDay;
  readonly startTime: string;
  readonly endTime: string;

  private constructor(props: WorkScheduleProps) {
    this.id = props.id;
    this.scope = props.scope;
    this.userId = props.userId;
    this.dayOfWeek = props.dayOfWeek;
    this.startTime = props.startTime;
    this.endTime = props.endTime;
    Object.freeze(this);
  }

  static restore(props: WorkScheduleProps): WorkSchedule {
    return new WorkSchedule(props);
  }

  static create(props: WorkScheduleProps): Result<WorkSchedule, ValidationError> {
    if (!TIME_PATTERN.test(props.startTime) || !TIME_PATTERN.test(props.endTime)) {
      return err(
        new ValidationError("الوقت يجب أن يكون بصيغة HH:MM", { time: "pattern" }),
      );
    }
    if (
      WorkSchedule.toMinutes(props.endTime) <= WorkSchedule.toMinutes(props.startTime)
    ) {
      return err(
        new ValidationError("نهاية الدوام يجب أن تكون بعد بدايته", {
          endTime: "before_start",
        }),
      );
    }
    if ((props.scope === "user") !== (props.userId !== null)) {
      return err(
        new ValidationError("الاستثناء الفردي يحتاج موظفًا محدَّدًا", {
          userId: "required",
        }),
      );
    }
    return ok(new WorkSchedule(props));
  }

  static toMinutes(time: string): number {
    const [hours = "0", minutes = "0"] = time.split(":");
    return Number(hours) * 60 + Number(minutes);
  }

  /** طول يوم الدوام بالدقائق. */
  get durationMinutes(): number {
    return (
      WorkSchedule.toMinutes(this.endTime) - WorkSchedule.toMinutes(this.startTime)
    );
  }
}
