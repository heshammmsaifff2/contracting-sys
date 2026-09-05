import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  EvaluationAuditRowDto,
  EvaluationCategoryDto,
  EvaluationCategoryScoreDto,
  EvaluationCriterionDto,
  EvaluationPeriodRowDto,
  EvaluationRuleDto,
  EvaluationSummaryDto,
  RulePreviewRowDto,
  SaveEvaluationRuleDto,
  SaveEvaluationScoreDto,
} from "@application/modules/workflow/dtos";
import type { RuleEffect } from "@core/modules/workflow/entities/EvaluationRule";
import type { WorkflowCondition } from "@core/modules/workflow/entities/WorkflowCondition";
import type { Json } from "../database.types";
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

  // ── المرحلة ٠٨: الفئات ────────────────────────────────────────────────
  async listCategories(): Promise<
    Result<readonly EvaluationCategoryDto[], DomainError>
  > {
    try {
      const { data, error } = await this.client
        .from("evaluation_categories")
        .select("id, key, name, description, sort_order, is_active")
        .order("sort_order", { ascending: true });

      if (error) return err(toDomainDbError(error, { entity: "فئات التقييم" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          key: row.key,
          name: row.name,
          description: row.description,
          sortOrder: row.sort_order,
          isActive: row.is_active,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة فئات التقييم"));
    }
  }

  async listCategoryScores(
    period: string,
  ): Promise<Result<readonly EvaluationCategoryScoreDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("evaluation_category_breakdown")
        .select("*")
        .eq("period", period)
        .order("sort_order", { ascending: true });

      if (error) return err(toDomainDbError(error, { entity: "تفصيل الفئات" }));

      return ok(
        (data ?? []).map((row) => ({
          userId: row.user_id ?? "",
          period: row.period ?? period,
          categoryKey: row.category_key ?? "",
          categoryName: row.category_name ?? "",
          sortOrder: row.sort_order ?? 0,
          categoryScore: Number(row.category_score ?? 0),
          categoryWeight: Number(row.category_weight ?? 0),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تفصيل الفئات"));
    }
  }

  // ── القواعد الإدارية ──────────────────────────────────────────────────
  async listRules(): Promise<Result<readonly EvaluationRuleDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("evaluation_rules")
        .select(
          `id, key, name, reason_template, condition, effect, points,
           per_unit_field, max_points, employee_type, is_active, sort_order`,
        )
        .order("sort_order", { ascending: true })
        .order("key", { ascending: true });

      if (error) return err(toDomainDbError(error, { entity: "قواعد التقييم" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          key: row.key,
          name: row.name,
          reasonTemplate: row.reason_template,
          condition: (row.condition ?? null) as WorkflowCondition | null,
          effect: row.effect as RuleEffect,
          points: Number(row.points),
          perUnitField: row.per_unit_field,
          maxPoints: row.max_points === null ? null : Number(row.max_points),
          employeeType: row.employee_type,
          isActive: row.is_active,
          sortOrder: row.sort_order,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة قواعد التقييم"));
    }
  }

  async saveRule(input: SaveEvaluationRuleDto): Promise<Result<void, DomainError>> {
    try {
      const payload = {
        key: input.key,
        name: input.name,
        reason_template: input.reasonTemplate,
        // الشرط بنية للقراءة فقط في الدومين؛ يُمرَّر كـ JSON عند الحفظ
        condition: (input.condition === null
          ? null
          : (JSON.parse(JSON.stringify(input.condition)) as Json)) as Json,
        effect: input.effect,
        points: input.points,
        per_unit_field: input.perUnitField,
        max_points: input.maxPoints,
        employee_type: input.employeeType,
        is_active: input.isActive,
        sort_order: input.sortOrder,
      };

      const { error } =
        input.id === null
          ? await this.client.from("evaluation_rules").insert(payload)
          : await this.client
              .from("evaluation_rules")
              .update(payload)
              .eq("id", input.id);

      if (error) return err(toDomainDbError(error, { entity: "قاعدة التقييم" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ قاعدة التقييم"));
    }
  }

  async removeRule(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("evaluation_rules")
        .delete()
        .eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "قاعدة التقييم", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف قاعدة التقييم"));
    }
  }

  /** المُختبِر التجريبي: دالّة `stable` تقرأ ولا تكتب. */
  async previewRules(
    period: string,
    ruleId: string | null,
  ): Promise<Result<readonly RulePreviewRowDto[], DomainError>> {
    try {
      // `exactOptionalPropertyTypes`: المفتاح يُحذف ولا يُمرَّر undefined
      const { data, error } = await this.client.rpc("preview_evaluation_rules", {
        p_period: period,
        ...(ruleId === null ? {} : { p_rule_id: ruleId }),
      });

      if (error) return err(toDomainDbError(error, { entity: "مُختبِر القواعد" }));

      return ok(
        (data ?? []).map((row) => ({
          userId: row.user_id ?? "",
          fullName: row.full_name ?? "",
          employeeType: row.employee_type ?? "",
          ruleId: row.rule_id ?? "",
          ruleKey: row.rule_key ?? "",
          ruleName: row.rule_name ?? "",
          effect: row.effect as RuleEffect,
          points: Number(row.points ?? 0),
          reason: row.reason ?? "",
          metrics: (row.metrics ?? {}) as Readonly<Record<string, unknown>>,
          alreadyApplied: row.already_applied ?? false,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر تشغيل مُختبِر القواعد"));
    }
  }

  async applyRules(
    period: string,
    ruleId: string | null,
  ): Promise<Result<number, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("apply_evaluation_rules", {
        p_period: period,
        ...(ruleId === null ? {} : { p_rule_id: ruleId }),
      });
      if (error) return err(toDomainDbError(error, { entity: "تطبيق القواعد" }));
      return ok(Number(data ?? 0));
    } catch (e) {
      return err(toDomainError(e, "تعذّر تطبيق القواعد"));
    }
  }

  async revokeRule(
    period: string,
    ruleId: string,
  ): Promise<Result<number, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("revoke_evaluation_rule", {
        p_period: period,
        p_rule_id: ruleId ?? undefined,
      });
      if (error) return err(toDomainDbError(error, { entity: "التراجع عن القاعدة" }));
      return ok(Number(data ?? 0));
    } catch (e) {
      return err(toDomainError(e, "تعذّر التراجع عن القاعدة"));
    }
  }

  // ── التقرير واللقطة ───────────────────────────────────────────────────
  async listPeriodReport(
    period: string,
  ): Promise<Result<readonly EvaluationPeriodRowDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("evaluation_period_report")
        .select("*")
        .eq("period", period)
        .order("rank_in_period", { ascending: true });

      if (error) return err(toDomainDbError(error, { entity: "تقرير الفترة" }));

      return ok(
        (data ?? []).map((row) => ({
          period: row.period ?? period,
          userId: row.user_id ?? "",
          fullName: row.full_name ?? "",
          employeeType: row.employee_type ?? "",
          baseScore: row.base_score === null ? null : Number(row.base_score),
          adjustmentPoints: Number(row.adjustment_points ?? 0),
          finalScore: row.final_score === null ? null : Number(row.final_score),
          completedSteps: row.completed_steps ?? 0,
          rankInPeriod: row.rank_in_period,
          isFrozen: row.is_frozen ?? false,
          frozenAt: row.frozen_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير الفترة"));
    }
  }

  async takeSnapshot(period: string): Promise<Result<number, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("take_evaluation_snapshot", {
        p_period: period,
      });
      if (error) return err(toDomainDbError(error, { entity: "لقطة التقييم" }));
      return ok(Number(data ?? 0));
    } catch (e) {
      return err(toDomainError(e, "تعذّر أخذ اللقطة"));
    }
  }

  async clearSnapshot(
    period: string,
    reason: string,
  ): Promise<Result<number, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("clear_evaluation_snapshot", {
        p_period: period,
        p_reason: reason,
      });
      if (error) return err(toDomainDbError(error, { entity: "لقطة التقييم" }));
      return ok(Number(data ?? 0));
    } catch (e) {
      return err(toDomainError(e, "تعذّر فكّ التجميد"));
    }
  }

  // ── سجلّ التدقيق ──────────────────────────────────────────────────────
  async listAudit(
    period: string | null,
  ): Promise<Result<readonly EvaluationAuditRowDto[], DomainError>> {
    try {
      // بين السجلّ و`profiles` علاقتان — صاحب الدرجة وفاعل التغيير — فيلتبس
      // التضمين المجرّد على PostgREST ويُردّ بخطأ. التسمية بالمفتاح تفكّه.
      let query = this.client
        .from("evaluation_audit_log")
        .select(
          `id, entity, action, period, before_data, after_data, acted_at,
           subject:profiles!evaluation_audit_log_user_id_fkey(full_name),
           actor:profiles!evaluation_audit_log_actor_id_fkey(full_name)`,
        )
        .order("acted_at", { ascending: false })
        .limit(300);

      if (period !== null && period !== "") query = query.eq("period", period);

      const { data, error } = await query.overrideTypes<
        {
          id: string;
          entity: string;
          action: string;
          period: string | null;
          before_data: unknown;
          after_data: unknown;
          acted_at: string;
          subject: { full_name: string } | null;
          actor: { full_name: string } | null;
        }[]
      >();

      if (error) return err(toDomainDbError(error, { entity: "سجلّ التدقيق" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          entity: row.entity,
          action: row.action as "insert" | "update" | "delete",
          userName: row.subject?.full_name ?? null,
          period: row.period,
          actorName: row.actor?.full_name ?? null,
          actedAt: row.acted_at,
          beforeData: row.before_data,
          afterData: row.after_data,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة سجلّ التدقيق"));
    }
  }
}
