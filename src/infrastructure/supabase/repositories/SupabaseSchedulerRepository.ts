import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  Audience,
  AudienceScope,
  ScheduleKind,
  ScheduleSpec,
  TaskAction,
} from "@core/modules/workflow/entities/ScheduledTask";
import type {
  SaveScheduledTaskDto,
  ScheduledTaskDto,
  ScheduledTaskRunDto,
} from "@application/modules/workflow/dtos";
import type { ISchedulerRepository } from "@application/modules/workflow/ports/scheduler-repository";
import type { Json } from "../database.types";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const ACTIONS: readonly TaskAction[] = ["start_workflow", "notify"];
const KINDS: readonly ScheduleKind[] = [
  "once",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];
const SCOPES: readonly AudienceScope[] = [
  "company",
  "department",
  "role",
  "project",
  "users",
];

interface StatusRow {
  id: string | null;
  name: string | null;
  is_active: boolean | null;
  action: string | null;
  transaction_type: string | null;
  project_id: string | null;
  project_name: string | null;
  audience: unknown;
  schedule_kind: string | null;
  schedule_spec: unknown;
  shift_to_workday: boolean | null;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  run_count: number | null;
  audience_size: number | null;
  error_runs: number | null;
  last_fired_at: string | null;
}

function audienceOf(value: unknown): Audience {
  const raw = (value ?? {}) as { scope?: string; ids?: unknown };
  const scope = SCOPES.includes(raw.scope as AudienceScope)
    ? (raw.scope as AudienceScope)
    : "company";
  const ids = Array.isArray(raw.ids) ? raw.ids.map(String) : undefined;
  return ids === undefined ? { scope } : { scope, ids };
}

/**
 * القوالب والسياق والجدولة تُقرأ من عرض `scheduled_task_status`، لكنه لا يحمل
 * القوالب — فتُقرأ من الجدول نفسه بضمّة واحدة.
 */
export class SupabaseSchedulerRepository implements ISchedulerRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(): Promise<Result<readonly ScheduledTaskDto[], DomainError>> {
    try {
      const [status, tasks] = await Promise.all([
        this.client
          .from("scheduled_task_status")
          .select("*")
          .order("next_run_at", { ascending: true })
          .overrideTypes<StatusRow[]>(),
        this.client
          .from("scheduled_tasks")
          .select("id, subject_template, body_template, context")
          .overrideTypes<
            {
              id: string;
              subject_template: string;
              body_template: string;
              context: unknown;
            }[]
          >(),
      ]);

      if (status.error)
        return err(toDomainDbError(status.error, { entity: "المهام المجدولة" }));
      if (tasks.error)
        return err(toDomainDbError(tasks.error, { entity: "المهام المجدولة" }));

      const templates = new Map(
        (tasks.data ?? []).map((t) => [
          t.id,
          {
            subject: t.subject_template,
            body: t.body_template,
            context: (t.context ?? {}) as Readonly<Record<string, unknown>>,
          },
        ]),
      );

      return ok(
        (status.data ?? []).map((row) => {
          const id = row.id ?? "";
          const tpl = templates.get(id);
          return {
            id,
            name: row.name ?? "",
            isActive: row.is_active ?? false,
            action: ACTIONS.includes(row.action as TaskAction)
              ? (row.action as TaskAction)
              : "notify",
            transactionType: row.transaction_type,
            projectId: row.project_id,
            projectName: row.project_name,
            subjectTemplate: tpl?.subject ?? "",
            bodyTemplate: tpl?.body ?? "",
            context: tpl?.context ?? {},
            audience: audienceOf(row.audience),
            scheduleKind: KINDS.includes(row.schedule_kind as ScheduleKind)
              ? (row.schedule_kind as ScheduleKind)
              : "daily",
            scheduleSpec: (row.schedule_spec ?? {}) as ScheduleSpec,
            shiftToWorkday: row.shift_to_workday ?? false,
            nextRunAt: row.next_run_at ?? "",
            lastRunAt: row.last_run_at,
            lastStatus: row.last_status,
            lastError: row.last_error ?? "",
            runCount: Number(row.run_count ?? 0),
            audienceSize: Number(row.audience_size ?? 0),
            errorRuns: Number(row.error_runs ?? 0),
            lastFiredAt: row.last_fired_at,
          };
        }),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المهام المجدولة"));
    }
  }

  async save(input: SaveScheduledTaskDto): Promise<Result<void, DomainError>> {
    try {
      const payload = {
        name: input.name,
        is_active: input.isActive,
        action: input.action,
        // النوع يخصّ بدء المسار وحده، والقيد في القاعدة يرفض الخلط
        transaction_type:
          input.action === "start_workflow" ? input.transactionType : null,
        project_id: input.projectId,
        subject_template: input.subjectTemplate,
        body_template: input.bodyTemplate,
        context: input.context as Json,
        audience: input.audience as unknown as Json,
        schedule_kind: input.scheduleKind,
        schedule_spec: input.scheduleSpec as unknown as Json,
        shift_to_workday: input.shiftToWorkday,
        ...(input.nextRunAt === null ? {} : { next_run_at: input.nextRunAt }),
      };

      const { error } =
        input.id === null
          ? await this.client.from("scheduled_tasks").insert(payload)
          : await this.client
              .from("scheduled_tasks")
              .update(payload)
              .eq("id", input.id);

      if (error) return err(toDomainDbError(error, { entity: "المهمة المجدولة" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المهمة"));
    }
  }

  async remove(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("scheduled_tasks").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "المهمة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف المهمة"));
    }
  }

  async runNow(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("run_scheduled_task_now", {
        p_task_id: id,
      });
      if (error) return err(toDomainDbError(error, { entity: "المهمة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تشغيل المهمة"));
    }
  }

  async listRuns(
    taskId: string,
  ): Promise<Result<readonly ScheduledTaskRunDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("scheduled_task_runs")
        .select("*")
        .eq("task_id", taskId)
        .order("fired_at", { ascending: false })
        .limit(50);

      if (error)
        return err(toDomainDbError(error, { entity: "سجل التشغيل", id: taskId }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          taskId: row.task_id,
          firedAt: row.fired_at,
          scheduledFor: row.scheduled_for,
          status: row.status as "ok" | "skipped" | "error",
          audienceCount: Number(row.audience_count ?? 0),
          createdTransactionIds: row.created_transaction_ids ?? [],
          notifiedCount: Number(row.notified_count ?? 0),
          error: row.error ?? "",
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة سجل التشغيل"));
    }
  }

  async previewSchedule(
    kind: ScheduleKind,
    spec: ScheduleSpec,
    shiftToWorkday: boolean,
    count: number,
  ): Promise<Result<readonly string[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc("preview_schedule", {
        p_kind: kind,
        p_spec: spec as unknown as Json,
        p_shift: shiftToWorkday,
        p_count: count,
      });

      if (error) return err(toDomainDbError(error, { entity: "معاينة الجدولة" }));
      return ok((data ?? []) as string[]);
    } catch (e) {
      return err(toDomainError(e, "تعذّر حساب المواعيد القادمة"));
    }
  }
}
