/**
 * اليوميات.
 * التسجيل يبدأ من اقتراح أسماء الأمس [2]: المستخدم يزيل الغائب فقط،
 * ولا يعيد كتابة كشف كل صباح.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import { validateSheet } from "@core/modules/hr/entities/Attendance";
import type { UseCase } from "@application/shared/use-case";
import type {
  AttendanceFilter,
  AttendanceRowDto,
  AttendanceSettingsDto,
  AttendanceSuggestionDto,
  LaborCostRowDto,
  LaborDaysRowDto,
  RegisterAttendanceDto,
} from "../dtos";
import type { IAttendanceRepository } from "../ports";

export class SuggestAttendance implements UseCase<
  { projectId: string; workDate: string },
  readonly AttendanceSuggestionDto[]
> {
  private readonly repo: IAttendanceRepository;

  constructor(repo: IAttendanceRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string;
    workDate: string;
  }): Promise<Result<readonly AttendanceSuggestionDto[], DomainError>> {
    if (input.projectId === "") {
      return err(new ValidationError("المشروع مطلوب", { projectId: "required" }));
    }
    return this.repo.suggest(input.projectId, input.workDate);
  }
}

export class ListAttendance implements UseCase<
  AttendanceFilter,
  readonly AttendanceRowDto[]
> {
  private readonly repo: IAttendanceRepository;

  constructor(repo: IAttendanceRepository) {
    this.repo = repo;
  }

  async execute(
    input: AttendanceFilter,
  ): Promise<Result<readonly AttendanceRowDto[], DomainError>> {
    return this.repo.list(input);
  }
}

export class RegisterAttendance implements UseCase<RegisterAttendanceDto, number> {
  private readonly repo: IAttendanceRepository;

  constructor(repo: IAttendanceRepository) {
    this.repo = repo;
  }

  async execute(input: RegisterAttendanceDto): Promise<Result<number, DomainError>> {
    if (input.projectId === "") {
      return err(new ValidationError("المشروع مطلوب", { projectId: "required" }));
    }

    const sheet = validateSheet(
      input.entries.map((entry) => ({
        workerId: entry.workerId,
        status: entry.status,
      })),
    );
    if (!sheet.ok) return sheet;

    return this.repo.register(input);
  }
}

export class GetAttendanceSettings implements UseCase<void, AttendanceSettingsDto> {
  private readonly repo: IAttendanceRepository;

  constructor(repo: IAttendanceRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<AttendanceSettingsDto, DomainError>> {
    return this.repo.settings();
  }
}

/** «كم يومية كلّفني المشروع» — بالأيام، يراها من لا يرى الأجور. */
export class GetLaborDays implements UseCase<
  { projectId: string | null },
  readonly LaborDaysRowDto[]
> {
  private readonly repo: IAttendanceRepository;

  constructor(repo: IAttendanceRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string | null;
  }): Promise<Result<readonly LaborDaysRowDto[], DomainError>> {
    return this.repo.laborDays(input.projectId);
  }
}

/** التكلفة بالمال — تعتمد على صلاحية رؤية الأجور في RLS. */
export class GetLaborCost implements UseCase<
  { projectId: string | null; period: string | null },
  readonly LaborCostRowDto[]
> {
  private readonly repo: IAttendanceRepository;

  constructor(repo: IAttendanceRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string | null;
    period: string | null;
  }): Promise<Result<readonly LaborCostRowDto[], DomainError>> {
    return this.repo.laborCost(input.projectId, input.period);
  }
}
