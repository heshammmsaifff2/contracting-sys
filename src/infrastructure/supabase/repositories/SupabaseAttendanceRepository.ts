/**
 * اليوميات. التسجيل بدالة خادم واحدة تفرض القواعد الثلاث:
 * لا ازدواج بين المشاريع [16]، ولا تسجيل بعد الموعد بلا صلاحية [17]،
 * وقيمة اليوم من الإعدادات [3].
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { AttendanceStatus, DayValues } from "@core/modules/hr/entities/Attendance";
import type {
  AttendanceFilter,
  AttendanceRowDto,
  AttendanceSettingsDto,
  AttendanceSuggestionDto,
  LaborCostRowDto,
  LaborDaysRowDto,
  RegisterAttendanceDto,
} from "@application/modules/hr/dtos";
import type { IAttendanceRepository } from "@application/modules/hr/ports";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const STATUSES: readonly AttendanceStatus[] = ["present", "excused", "absent", "sick"];

function toStatus(raw: string): AttendanceStatus {
  return STATUSES.find((status) => status === raw) ?? "present";
}

const DEFAULT_DAY_VALUES: DayValues = {
  present: 1,
  sick: 0.5,
  excused: -1,
  absent: -2,
};

function readDayValues(value: unknown): DayValues {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_DAY_VALUES;
  }
  const source = value as Record<string, unknown>;
  const read = (key: AttendanceStatus): number => {
    const raw = source[key];
    return typeof raw === "number" ? raw : DEFAULT_DAY_VALUES[key];
  };
  return {
    present: read("present"),
    sick: read("sick"),
    excused: read("excused"),
    absent: read("absent"),
  };
}

const ROW_SELECT = `
  id, project_id, worker_id, work_date, status, is_temp, note,
  projects(name),
  employees!inner(card_no, profiles!inner(full_name))
`;

interface AttendanceRow {
  id: string;
  project_id: string;
  worker_id: string;
  work_date: string;
  status: string;
  is_temp: boolean;
  note: string;
  projects: { name: string } | null;
  employees: { card_no: string | null; profiles: { full_name: string } | null } | null;
}

export class SupabaseAttendanceRepository implements IAttendanceRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async suggest(
    projectId: string,
    workDate: string,
  ): Promise<Result<readonly AttendanceSuggestionDto[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("suggest_attendance", {
        p_project_id: projectId,
        ...(workDate === "" ? {} : { p_date: workDate }),
      });

      if (error) return err(toDomainDbError(error, { entity: "اقتراح اليومية" }));

      return ok(
        (data ?? []).map((row) => ({
          workerId: row.worker_id,
          fullName: row.full_name,
          cardNo: row.card_no,
          professions: row.professions ?? [],
          lastStatus: toStatus(row.last_status),
          lastDate: row.last_date,
          alreadyRegistered: row.already_registered,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة اقتراح اليومية"));
    }
  }

  async list(
    filter: AttendanceFilter,
  ): Promise<Result<readonly AttendanceRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("attendance")
        .select(ROW_SELECT)
        .order("work_date", { ascending: false })
        .limit(500);

      if (filter.projectId !== null && filter.projectId !== "") {
        query = query.eq("project_id", filter.projectId);
      }
      if (filter.workDate !== null && filter.workDate !== "") {
        query = query.eq("work_date", filter.workDate);
      }
      if (filter.workerId !== null && filter.workerId !== "") {
        query = query.eq("worker_id", filter.workerId);
      }

      const { data, error } = await query.overrideTypes<AttendanceRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "اليوميات" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          projectId: row.project_id,
          projectName: row.projects?.name ?? "",
          workerId: row.worker_id,
          workerName: row.employees?.profiles?.full_name ?? "",
          cardNo: row.employees?.card_no ?? null,
          workDate: row.work_date,
          status: toStatus(row.status),
          isTemp: row.is_temp,
          note: row.note,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة اليوميات"));
    }
  }

  async register(input: RegisterAttendanceDto): Promise<Result<number, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("register_attendance", {
        p_project_id: input.projectId,
        p_date: input.workDate,
        p_entries: input.entries.map((entry) => ({
          worker_id: entry.workerId,
          status: entry.status,
          is_temp: entry.isTemp,
          note: entry.note,
        })),
      });

      if (error) return err(toDomainDbError(error, { entity: "تسجيل اليومية" }));
      return ok(data ?? 0);
    } catch (e) {
      return err(toDomainError(e, "تعذّر تسجيل اليومية"));
    }
  }

  async settings(): Promise<Result<AttendanceSettingsDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("settings")
        .select("key, value")
        .in("key", ["attendance_cutoff_time", "attendance_day_values"]);

      if (error) return err(toDomainDbError(error, { entity: "إعدادات اليوميات" }));

      const rows = data ?? [];
      const cutoff = rows.find((row) => row.key === "attendance_cutoff_time")?.value;
      const values = rows.find((row) => row.key === "attendance_day_values")?.value;

      return ok({
        cutoffTime: typeof cutoff === "string" ? cutoff : "12:00",
        dayValues: readDayValues(values),
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة إعدادات اليوميات"));
    }
  }

  async laborDays(
    projectId: string | null,
  ): Promise<Result<readonly LaborDaysRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("project_labor_days")
        .select("*")
        .order("period", { ascending: false });

      if (projectId !== null && projectId !== "") {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "تقرير اليوميات" }));

      return ok(
        (data ?? []).map((row) => ({
          projectId: row.project_id ?? "",
          projectCode: row.project_code ?? "",
          projectName: row.project_name ?? "",
          period: row.period ?? "",
          presentDays: Number(row.present_days ?? 0),
          sickDays: Number(row.sick_days ?? 0),
          excusedDays: Number(row.excused_days ?? 0),
          absentDays: Number(row.absent_days ?? 0),
          workersCount: Number(row.workers_count ?? 0),
          payableDays: Number(row.payable_days ?? 0),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير اليوميات"));
    }
  }

  /** فارغ لمن لا يملك صلاحية رؤية الأجور — RLS على profile_salaries. */
  async laborCost(
    projectId: string | null,
    period: string | null,
  ): Promise<Result<readonly LaborCostRowDto[], DomainError>> {
    try {
      let query = this.client
        .from("project_labor_cost")
        .select("*")
        .order("period", { ascending: false });

      if (projectId !== null && projectId !== "") {
        query = query.eq("project_id", projectId);
      }
      if (period !== null && period !== "") {
        query = query.eq("period", period);
      }

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "تكلفة اليوميات" }));

      return ok(
        (data ?? []).map((row) => ({
          projectId: row.project_id ?? "",
          projectName: row.project_name ?? "",
          period: row.period ?? "",
          workerId: row.worker_id ?? "",
          workerName: row.worker_name ?? "",
          payableDays: Number(row.payable_days ?? 0),
          dailyWage: Number(row.daily_wage ?? 0),
          cost: Number(row.cost ?? 0),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تكلفة اليوميات"));
    }
  }
}
