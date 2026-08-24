import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { WeekDay } from "@core/modules/workflow/entities/WorkSchedule";
import { WEEK_DAYS } from "@core/modules/workflow/entities/WorkSchedule";
import type {
  HolidayDto,
  SaveHolidayDto,
  SaveWorkScheduleDto,
  WorkScheduleDto,
} from "@application/modules/workflow/dtos";
import type { IWorkCalendarRepository } from "@application/modules/workflow/ports/work-calendar-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

interface ScheduleRow {
  id: string;
  scope: string;
  user_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  profiles: { full_name: string } | null;
}

interface HolidayRow {
  id: string;
  holiday_date: string;
  description: string;
  scope: string;
  user_id: string | null;
  profiles: { full_name: string } | null;
}

/** Postgres يعيد الوقت كـ HH:MM:SS — نقصّه لـ HH:MM للعرض والتحرير. */
function toShortTime(time: string): string {
  return time.slice(0, 5);
}

function toWeekDay(raw: number): WeekDay {
  return WEEK_DAYS.includes(raw as WeekDay) ? (raw as WeekDay) : 0;
}

function toScheduleDto(row: ScheduleRow): WorkScheduleDto {
  return {
    id: row.id,
    scope: row.scope === "user" ? "user" : "global",
    userId: row.user_id,
    userName: row.profiles?.full_name ?? null,
    dayOfWeek: toWeekDay(row.day_of_week),
    startTime: toShortTime(row.start_time),
    endTime: toShortTime(row.end_time),
  };
}

function toHolidayDto(row: HolidayRow): HolidayDto {
  return {
    id: row.id,
    holidayDate: row.holiday_date,
    description: row.description,
    scope: row.scope === "user" ? "user" : "global",
    userId: row.user_id,
    userName: row.profiles?.full_name ?? null,
  };
}

const SCHEDULE_SELECT =
  "id, scope, user_id, day_of_week, start_time, end_time, profiles(full_name)";
const HOLIDAY_SELECT =
  "id, holiday_date, description, scope, user_id, profiles(full_name)";

export class SupabaseWorkCalendarRepository implements IWorkCalendarRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async listSchedules(): Promise<Result<readonly WorkScheduleDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("work_schedules")
        .select(SCHEDULE_SELECT)
        .order("scope", { ascending: true })
        .order("day_of_week", { ascending: true })
        .overrideTypes<ScheduleRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "مواعيد العمل" }));
      return ok((data ?? []).map(toScheduleDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة مواعيد العمل"));
    }
  }

  async saveSchedule(
    input: SaveWorkScheduleDto,
  ): Promise<Result<WorkScheduleDto, DomainError>> {
    try {
      const payload = {
        scope: input.scope,
        user_id: input.userId,
        day_of_week: input.dayOfWeek,
        start_time: input.startTime,
        end_time: input.endTime,
      };

      const query =
        input.id === null
          ? this.client.from("work_schedules").insert(payload)
          : this.client.from("work_schedules").update(payload).eq("id", input.id);

      const { data, error } = await query
        .select(SCHEDULE_SELECT)
        .single()
        .overrideTypes<ScheduleRow>();

      if (error) return err(toDomainDbError(error, { entity: "موعد العمل" }));
      return ok(toScheduleDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ موعد العمل"));
    }
  }

  async removeSchedule(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("work_schedules").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "موعد العمل", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف موعد العمل"));
    }
  }

  async listHolidays(): Promise<Result<readonly HolidayDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("holidays")
        .select(HOLIDAY_SELECT)
        .order("holiday_date", { ascending: false })
        .overrideTypes<HolidayRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "الإجازات" }));
      return ok((data ?? []).map(toHolidayDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الإجازات"));
    }
  }

  async addHoliday(input: SaveHolidayDto): Promise<Result<HolidayDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("holidays")
        .insert({
          holiday_date: input.holidayDate,
          description: input.description,
          scope: input.scope,
          user_id: input.userId,
        })
        .select(HOLIDAY_SELECT)
        .single()
        .overrideTypes<HolidayRow>();

      if (error) return err(toDomainDbError(error, { entity: "الإجازة" }));
      return ok(toHolidayDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر إضافة الإجازة"));
    }
  }

  async removeHoliday(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("holidays").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "الإجازة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف الإجازة"));
    }
  }
}
