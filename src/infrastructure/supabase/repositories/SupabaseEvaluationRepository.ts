import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  EvaluationCriterionDto,
  EvaluationSummaryDto,
  SaveEvaluationScoreDto,
} from "@application/modules/workflow/dtos";
import type { IEvaluationRepository } from "@application/modules/workflow/ports/evaluation-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

interface CriterionRow {
  id: string;
  key: string;
  name: string;
  kind: string;
  is_active: boolean;
  evaluation_weights: { employee_type: string; weight: number }[] | null;
}

export class SupabaseEvaluationRepository implements IEvaluationRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /** الترتيب والأوزان يحسبهما العرض في Postgres [المراسلات 17، 18]. */
  async listSummary(
    period: string | null,
  ): Promise<Result<readonly EvaluationSummaryDto[], DomainError>> {
    try {
      let query = this.client
        .from("employee_evaluation_summary")
        .select("*")
        .order("period", { ascending: false })
        .order("rank_in_period", { ascending: true });

      if (period !== null && period !== "") {
        query = query.eq("period", period);
      }

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "تقرير التقييم" }));

      return ok(
        (data ?? []).map((row) => ({
          userId: row.user_id ?? "",
          fullName: row.full_name ?? "",
          employeeType: row.employee_type ?? "admin",
          period: row.period ?? "",
          weightedScore: Number(row.weighted_score ?? 0),
          completedSteps: Number(row.completed_steps ?? 0),
          rankInPeriod: Number(row.rank_in_period ?? 0),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير التقييم"));
    }
  }

  async listCriteria(): Promise<
    Result<readonly EvaluationCriterionDto[], DomainError>
  > {
    try {
      const { data, error } = await this.client
        .from("evaluation_criteria")
        .select(
          "id, key, name, kind, is_active, evaluation_weights(employee_type, weight)",
        )
        .order("key", { ascending: true })
        .overrideTypes<CriterionRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "بنود التقييم" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          key: row.key,
          name: row.name,
          kind: row.kind === "completion" ? "completion" : "manual",
          isActive: row.is_active,
          weights: Object.fromEntries(
            (row.evaluation_weights ?? []).map((w) => [
              w.employee_type,
              Number(w.weight),
            ]),
          ),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة بنود التقييم"));
    }
  }

  /**
   * تقييم من كل من تولّى الإشراف [المراسلات 15]، لذا المفتاح يشمل المقيِّم
   * ولا يطمس تقييم غيره.
   */
  async saveScore(input: SaveEvaluationScoreDto): Promise<Result<void, DomainError>> {
    try {
      const { data: session } = await this.client.auth.getUser();
      const raterId = session.user?.id ?? null;

      const { error } = await this.client.from("evaluation_scores").upsert(
        {
          user_id: input.userId,
          criteria_id: input.criteriaId,
          period: input.period,
          score: input.score,
          note: input.note,
          rated_by: raterId,
        },
        { onConflict: "user_id,criteria_id,period,rated_by" },
      );

      if (error) return err(toDomainDbError(error, { entity: "درجة التقييم" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ درجة التقييم"));
    }
  }

  async setWeight(
    criteriaId: string,
    employeeType: string,
    weight: number,
  ): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("evaluation_weights")
        .upsert(
          { criteria_id: criteriaId, employee_type: employeeType, weight },
          { onConflict: "criteria_id,employee_type" },
        );

      if (error) return err(toDomainDbError(error, { entity: "وزن البند" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ الوزن"));
    }
  }
}
