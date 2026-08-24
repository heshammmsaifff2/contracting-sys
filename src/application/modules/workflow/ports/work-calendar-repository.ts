import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  HolidayDto,
  SaveHolidayDto,
  SaveWorkScheduleDto,
  WorkScheduleDto,
} from "../dtos";

export interface IWorkCalendarRepository {
  listSchedules(): Promise<Result<readonly WorkScheduleDto[], DomainError>>;
  saveSchedule(
    input: SaveWorkScheduleDto,
  ): Promise<Result<WorkScheduleDto, DomainError>>;
  removeSchedule(id: string): Promise<Result<void, DomainError>>;
  listHolidays(): Promise<Result<readonly HolidayDto[], DomainError>>;
  addHoliday(input: SaveHolidayDto): Promise<Result<HolidayDto, DomainError>>;
  removeHoliday(id: string): Promise<Result<void, DomainError>>;
}
