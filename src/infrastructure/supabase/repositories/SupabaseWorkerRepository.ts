/**
 * ملفات العمالة وحالتها.
 * البحث بدالة خادم تطبّع الاسم العربي وتقارن الكود ورقم البطاقة بعد توحيد
 * الأرقام — فيجد العامل ولو كُتب اسمه شاذًّا أو بطاقته بأرقام عربية [2].
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { SalaryType, WorkerStatus } from "@core/modules/hr/entities/Worker";
import type {
  SaveWorkerDto,
  SetWorkerStatusDto,
  WorkerDto,
  WorkerPoolFilter,
} from "@application/modules/hr/dtos";
import type { IWorkerRepository } from "@application/modules/hr/ports";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SALARY_TYPES: readonly SalaryType[] = ["monthly", "daily", "production"];
const STATUSES: readonly WorkerStatus[] = ["available", "seconded", "problem"];

function toSalaryType(raw: string): SalaryType {
  return SALARY_TYPES.find((type) => type === raw) ?? "daily";
}

function toStatus(raw: string | null): WorkerStatus | null {
  if (raw === null) return null;
  return STATUSES.find((status) => status === raw) ?? null;
}

/** الحالة المفتوحة لكل عامل — صفّ واحد بحكم الفهرس الفريد. */
interface PoolRow {
  worker_id: string;
  status: string;
  project_id: string | null;
  note: string;
  projects: { name: string } | null;
}

const POOL_SELECT = "worker_id, status, project_id, note, projects(name)";

export class SupabaseWorkerRepository implements IWorkerRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async search(query: string): Promise<Result<readonly WorkerDto[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("search_workers", {
        p_query: query,
      });

      if (error) return err(toDomainDbError(error, { entity: "العمالة" }));

      const rows = data ?? [];
      const pool = await this.openStatuses(rows.map((row) => row.id));
      if (!pool.ok) return pool;

      return ok(
        rows.map((row) => {
          const status = pool.value.get(row.id);
          return {
            id: row.id,
            fullName: row.full_name,
            code: row.code,
            cardNo: row.card_no,
            professions: row.professions ?? [],
            salaryType: toSalaryType(row.salary_type),
            employeeType: row.employee_type,
            isActive: row.is_active,
            status: toStatus(status?.status ?? null),
            statusProjectId: status?.projectId ?? null,
            statusProjectName: status?.projectName ?? "",
            statusNote: status?.note ?? "",
          };
        }),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر البحث في العمالة"));
    }
  }

  /** صفحات العمالة الشاغرة/المنتدبة/التي بها مشكلة [4، 5، 6]. */
  async listPool(
    filter: WorkerPoolFilter,
  ): Promise<Result<readonly WorkerDto[], DomainError>> {
    try {
      let query = this.client
        .from("labor_pool")
        .select(
          `worker_id, status, project_id, note, projects(name),
           employees!inner(card_no, professions, salary_type,
             profiles!inner(full_name, code, employee_type, is_active))`,
        )
        .eq("is_closed", false);

      if (filter.status !== null) {
        query = query.eq("status", filter.status);
      }

      const { data, error } = await query.overrideTypes<
        {
          worker_id: string;
          status: string;
          project_id: string | null;
          note: string;
          projects: { name: string } | null;
          employees: {
            card_no: string | null;
            professions: string[] | null;
            salary_type: string;
            profiles: {
              full_name: string;
              code: string | null;
              employee_type: string;
              is_active: boolean;
            } | null;
          } | null;
        }[]
      >();

      if (error) return err(toDomainDbError(error, { entity: "حالة العمالة" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.worker_id,
          fullName: row.employees?.profiles?.full_name ?? "",
          code: row.employees?.profiles?.code ?? null,
          cardNo: row.employees?.card_no ?? null,
          professions: row.employees?.professions ?? [],
          salaryType: toSalaryType(row.employees?.salary_type ?? "daily"),
          employeeType: row.employees?.profiles?.employee_type ?? "worker",
          isActive: row.employees?.profiles?.is_active ?? true,
          status: toStatus(row.status),
          statusProjectId: row.project_id,
          statusProjectName: row.projects?.name ?? "",
          statusNote: row.note,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة حالة العمالة"));
    }
  }

  async save(input: SaveWorkerDto): Promise<Result<WorkerDto, DomainError>> {
    try {
      const { error } = await this.client.from("employees").upsert({
        id: input.id,
        card_no: input.cardNo,
        professions: [...input.professions],
        salary_type: input.salaryType,
        hired_at: input.hiredAt,
        national_id: input.nationalId,
        phone: input.phone,
        notes: input.notes,
      });

      if (error)
        return err(toDomainDbError(error, { entity: "ملف العامل", id: input.id }));

      const reloaded = await this.search("");
      if (!reloaded.ok) return reloaded;

      const saved = reloaded.value.find((worker) => worker.id === input.id);
      if (saved === undefined) {
        return err(toDomainError(null, "تعذّر قراءة ملف العامل بعد حفظه"));
      }
      return ok(saved);
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ ملف العامل"));
    }
  }

  /** التغيير بدالة خادم لتبقى الحالة المفتوحة واحدة ولها تاريخ. */
  async setStatus(input: SetWorkerStatusDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("set_worker_status", {
        p_worker_id: input.workerId,
        p_status: input.status,
        p_note: input.note,
        ...(input.projectId === null ? {} : { p_project_id: input.projectId }),
        ...(input.availableFrom === ""
          ? {}
          : { p_available_from: input.availableFrom }),
        ...(input.availableTo === null || input.availableTo === ""
          ? {}
          : { p_available_to: input.availableTo }),
      });

      if (error)
        return err(
          toDomainDbError(error, { entity: "حالة العامل", id: input.workerId }),
        );
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تغيير حالة العامل"));
    }
  }

  private async openStatuses(
    ids: readonly string[],
  ): Promise<
    Result<
      Map<
        string,
        { status: string; projectId: string | null; projectName: string; note: string }
      >,
      DomainError
    >
  > {
    if (ids.length === 0) return ok(new Map());

    try {
      const { data, error } = await this.client
        .from("labor_pool")
        .select(POOL_SELECT)
        .eq("is_closed", false)
        .in("worker_id", [...ids])
        .overrideTypes<PoolRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "حالة العمالة" }));

      const map = new Map<
        string,
        { status: string; projectId: string | null; projectName: string; note: string }
      >();
      for (const row of data ?? []) {
        map.set(row.worker_id, {
          status: row.status,
          projectId: row.project_id,
          projectName: row.projects?.name ?? "",
          note: row.note,
        });
      }
      return ok(map);
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة حالة العمالة"));
    }
  }
}
