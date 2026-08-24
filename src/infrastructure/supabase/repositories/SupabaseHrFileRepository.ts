/**
 * السلف وملفّ العامل (الأجر والتقييم والتوصيات).
 * السلفة يطلبها العامل بنفسه (RLS بالهويّة)، والبتّ فيها بدالة خادم
 * تولّد طلب الدفع فيمرّ بالتحويل البنكي وقيده الآلي.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { LoanStatus } from "@core/modules/hr/entities/Loan";
import type {
  ChangeSalaryDto,
  DecideLoanDto,
  LoanDto,
  ProductionRatingDto,
  RateProductionDto,
  RecommendationDto,
  RequestLoanDto,
  SalaryChangeDto,
  SaveRecommendationDto,
} from "@application/modules/hr/dtos";
import type {
  ILoanRepository,
  IWorkerFileRepository,
} from "@application/modules/hr/ports";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const LOAN_STATUSES: readonly LoanStatus[] = [
  "requested",
  "approved",
  "rejected",
  "paid",
  "settled",
];

function toLoanStatus(raw: string): LoanStatus {
  return LOAN_STATUSES.find((status) => status === raw) ?? "requested";
}

const LOAN_SELECT = `
  id, no, worker_id, project_id, amount, installments, reason, status,
  decision_note, decided_at, created_at,
  projects(name),
  employees!inner(profiles!inner(full_name))
`;

interface LoanRow {
  id: string;
  no: number;
  worker_id: string;
  project_id: string | null;
  amount: number;
  installments: number;
  reason: string;
  status: string;
  decision_note: string;
  decided_at: string | null;
  created_at: string;
  projects: { name: string } | null;
  employees: { profiles: { full_name: string } | null } | null;
}

function toLoanDto(row: LoanRow): LoanDto {
  return {
    id: row.id,
    no: row.no,
    workerId: row.worker_id,
    workerName: row.employees?.profiles?.full_name ?? "",
    projectId: row.project_id,
    projectName: row.projects?.name ?? "",
    amount: Number(row.amount),
    installments: row.installments,
    reason: row.reason,
    status: toLoanStatus(row.status),
    decisionNote: row.decision_note,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  };
}

export class SupabaseLoanRepository implements ILoanRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(
    workerId: string | null,
  ): Promise<Result<readonly LoanDto[], DomainError>> {
    try {
      let query = this.client
        .from("loans")
        .select(LOAN_SELECT)
        .order("created_at", { ascending: false });

      if (workerId !== null && workerId !== "") {
        query = query.eq("worker_id", workerId);
      }

      const { data, error } = await query.overrideTypes<LoanRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "السلف" }));
      return ok((data ?? []).map(toLoanDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة السلف"));
    }
  }

  async request(input: RequestLoanDto): Promise<Result<LoanDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("loans")
        .insert({
          worker_id: input.workerId,
          project_id: input.projectId,
          amount: input.amount,
          installments: input.installments,
          reason: input.reason,
          status: "requested",
        })
        .select(LOAN_SELECT)
        .single()
        .overrideTypes<LoanRow>();

      if (error) return err(toDomainDbError(error, { entity: "السلفة" }));
      return ok(toLoanDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر تسجيل طلب السلفة"));
    }
  }

  async withdraw(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("loans")
        .delete()
        .eq("id", id)
        .eq("status", "requested");

      if (error) return err(toDomainDbError(error, { entity: "السلفة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر سحب طلب السلفة"));
    }
  }

  async decide(input: DecideLoanDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("decide_loan", {
        p_loan_id: input.id,
        p_approve: input.approve,
        p_note: input.note,
      });

      if (error) return err(toDomainDbError(error, { entity: "السلفة", id: input.id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر البتّ في السلفة"));
    }
  }
}

// ── ملفّ العامل: الأجر والتقييم والتوصيات ───────────────────────────────
export class SupabaseWorkerFileRepository implements IWorkerFileRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async salaryHistory(
    workerId: string,
  ): Promise<Result<readonly SalaryChangeDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("salary_changes")
        .select(
          // `salary_changes` له مفتاحان إلى `profiles` (العامل، ومن اعتمد
          // التعديل) — المقصود هنا العامل، ويجب أن يُسمّى صراحةً
          `id, worker_id, old_base, new_base, old_daily, new_daily,
           effective_from, reason, created_at,
           profiles!salary_changes_worker_id_fkey(full_name)`,
        )
        .eq("worker_id", workerId)
        .order("created_at", { ascending: false })
        .overrideTypes<
          {
            id: string;
            worker_id: string;
            old_base: number;
            new_base: number;
            old_daily: number;
            new_daily: number;
            effective_from: string;
            reason: string;
            created_at: string;
            profiles: { full_name: string } | null;
          }[]
        >();

      if (error) return err(toDomainDbError(error, { entity: "سجل الأجر" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          workerId: row.worker_id,
          workerName: row.profiles?.full_name ?? "",
          oldBase: Number(row.old_base),
          newBase: Number(row.new_base),
          oldDaily: Number(row.old_daily),
          newDaily: Number(row.new_daily),
          effectiveFrom: row.effective_from,
          reason: row.reason,
          createdAt: row.created_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة سجل الأجر"));
    }
  }

  async changeSalary(input: ChangeSalaryDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("change_worker_salary", {
        p_worker_id: input.workerId,
        p_new_base: input.newBase,
        p_new_daily: input.newDaily,
        p_reason: input.reason,
        ...(input.effectiveFrom === ""
          ? {}
          : { p_effective_from: input.effectiveFrom }),
      });

      if (error)
        return err(toDomainDbError(error, { entity: "الأجر", id: input.workerId }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل الأجر"));
    }
  }

  async ratings(
    workerId: string | null,
    period: string | null,
  ): Promise<Result<readonly ProductionRatingDto[], DomainError>> {
    try {
      let query = this.client
        .from("production_ratings")
        .select(
          `id, worker_id, period, income, cost, ratio, score, note,
           employees!inner(profiles!inner(full_name))`,
        )
        .order("period", { ascending: false });

      if (workerId !== null && workerId !== "") {
        query = query.eq("worker_id", workerId);
      }
      if (period !== null && period !== "") {
        query = query.eq("period", period);
      }

      const { data, error } = await query.overrideTypes<
        {
          id: string;
          worker_id: string;
          period: string;
          income: number;
          cost: number;
          ratio: number | null;
          score: number | null;
          note: string;
          employees: { profiles: { full_name: string } | null } | null;
        }[]
      >();

      if (error) return err(toDomainDbError(error, { entity: "تقييم الإنتاج" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          workerId: row.worker_id,
          workerName: row.employees?.profiles?.full_name ?? "",
          period: row.period,
          income: Number(row.income),
          cost: Number(row.cost),
          ratio: row.ratio === null ? null : Number(row.ratio),
          score: row.score === null ? null : Number(row.score),
          note: row.note,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقييم الإنتاج"));
    }
  }

  async rateProduction(input: RateProductionDto): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.rpc("rate_worker_production", {
        p_worker_id: input.workerId,
        p_period: input.period,
        p_income: input.income,
        p_note: input.note,
      });

      if (error) return err(toDomainDbError(error, { entity: "تقييم الإنتاج" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ تقييم الإنتاج"));
    }
  }

  async recommendations(
    workerId: string,
  ): Promise<Result<readonly RecommendationDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("worker_recommendations")
        .select(
          "id, worker_id, kind, note, created_at, employees!inner(profiles!inner(full_name))",
        )
        .eq("worker_id", workerId)
        .order("created_at", { ascending: false })
        .overrideTypes<
          {
            id: string;
            worker_id: string;
            kind: string;
            note: string;
            created_at: string;
            employees: { profiles: { full_name: string } | null } | null;
          }[]
        >();

      if (error) return err(toDomainDbError(error, { entity: "التوصيات" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          workerId: row.worker_id,
          workerName: row.employees?.profiles?.full_name ?? "",
          kind:
            row.kind === "praise" || row.kind === "warning"
              ? row.kind
              : ("note" as const),
          note: row.note,
          createdAt: row.created_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة التوصيات"));
    }
  }

  async addRecommendation(
    input: SaveRecommendationDto,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("worker_recommendations").insert({
        worker_id: input.workerId,
        kind: input.kind,
        note: input.note,
      });

      if (error) return err(toDomainDbError(error, { entity: "التوصية" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ التوصية"));
    }
  }
}
