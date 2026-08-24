import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  DurationChangeDto,
  SaveWorkflowDefinitionDto,
  SaveWorkflowStepDto,
  WorkflowDefinitionDto,
} from "@application/modules/workflow/dtos";
import type { IWorkflowDefinitionRepository } from "@application/modules/workflow/ports/workflow-definition-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT_WITH_STEPS = `
  id, transaction_type, name, is_active,
  workflow_steps(
    id, definition_id, order_no, name, role_id, department_id,
    default_assignee_id, is_program_manager, is_archive,
    roles(name), departments(name), profiles(full_name)
  )
`;

interface DefinitionRow {
  id: string;
  transaction_type: string;
  name: string;
  is_active: boolean;
  workflow_steps:
    | {
        id: string;
        definition_id: string;
        order_no: number;
        name: string;
        role_id: string | null;
        department_id: string | null;
        default_assignee_id: string | null;
        is_program_manager: boolean;
        is_archive: boolean;
        roles: { name: string } | null;
        departments: { name: string } | null;
        profiles: { full_name: string } | null;
      }[]
    | null;
}

function toDto(row: DefinitionRow): WorkflowDefinitionDto {
  return {
    id: row.id,
    transactionType: row.transaction_type,
    name: row.name,
    isActive: row.is_active,
    steps: [...(row.workflow_steps ?? [])]
      .sort((a, b) => a.order_no - b.order_no)
      .map((step) => ({
        id: step.id,
        definitionId: step.definition_id,
        orderNo: step.order_no,
        name: step.name,
        roleId: step.role_id,
        roleName: step.roles?.name ?? null,
        departmentId: step.department_id,
        departmentName: step.departments?.name ?? null,
        defaultAssigneeId: step.default_assignee_id,
        defaultAssigneeName: step.profiles?.full_name ?? null,
        isProgramManager: step.is_program_manager,
        isArchive: step.is_archive,
      })),
  };
}

export class SupabaseWorkflowDefinitionRepository implements IWorkflowDefinitionRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(): Promise<Result<readonly WorkflowDefinitionDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("workflow_definitions")
        .select(SELECT_WITH_STEPS)
        .order("name", { ascending: true })
        .overrideTypes<DefinitionRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "مسارات سير العمل" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة مسارات سير العمل"));
    }
  }

  async saveDefinition(
    input: SaveWorkflowDefinitionDto,
  ): Promise<Result<WorkflowDefinitionDto, DomainError>> {
    try {
      const payload = {
        transaction_type: input.transactionType,
        name: input.name,
        is_active: input.isActive,
      };

      const query =
        input.id === null
          ? this.client.from("workflow_definitions").insert(payload)
          : this.client.from("workflow_definitions").update(payload).eq("id", input.id);

      const { data, error } = await query
        .select(SELECT_WITH_STEPS)
        .single()
        .overrideTypes<DefinitionRow>();

      if (error) return err(toDomainDbError(error, { entity: "مسار سير العمل" }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ مسار سير العمل"));
    }
  }

  async saveStep(input: SaveWorkflowStepDto): Promise<Result<void, DomainError>> {
    try {
      const payload = {
        definition_id: input.definitionId,
        order_no: input.orderNo,
        name: input.name,
        role_id: input.roleId,
        default_assignee_id: input.defaultAssigneeId,
        is_program_manager: input.isProgramManager,
        is_archive: input.isArchive,
      };

      const { error } =
        input.id === null
          ? await this.client.from("workflow_steps").insert(payload)
          : await this.client.from("workflow_steps").update(payload).eq("id", input.id);

      if (error) return err(toDomainDbError(error, { entity: "مرحلة سير العمل" }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المرحلة"));
    }
  }

  async removeStep(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("workflow_steps").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "المرحلة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف المرحلة"));
    }
  }

  /** تقرير المدد المعدّلة: قبل/بعد/الموظف [المراسلات 5]. */
  async listDurationChanges(): Promise<
    Result<readonly DurationChangeDto[], DomainError>
  > {
    try {
      const { data, error } = await this.client
        .from("duration_change_log")
        .select(
          // كل تضمين هنا مُسمّى بمفتاحه الأجنبي، لأن بين هذه الجداول أكثر من
          // علاقة واحدة فيلتبس التضمين المجرّد على PostgREST فيردّه بخطأ:
          //   • `transaction_step_instances` → `profiles` مرّتين
          //     (المسؤول، ومن تُعرض له ملاحظة المدير)
          //   • `transaction_step_instances` ⇄ `transactions` في الاتجاهين
          //     (المعاملة الأمّ، والمرحلة الجارية للمعاملة)
          `id, step_instance_id, old_minutes, new_minutes, reason, changed_at,
           profiles!duration_change_log_changed_by_fkey(full_name),
           transaction_step_instances(
             name,
             transactions!transaction_step_instances_transaction_id_fkey(no),
             profiles!transaction_step_instances_assignee_id_fkey(full_name)
           )`,
        )
        .order("changed_at", { ascending: false })
        .limit(200)
        .overrideTypes<
          {
            id: string;
            step_instance_id: string;
            old_minutes: number | null;
            new_minutes: number;
            reason: string;
            changed_at: string;
            profiles: { full_name: string } | null;
            transaction_step_instances: {
              name: string;
              transactions: { no: number } | null;
              profiles: { full_name: string } | null;
            } | null;
          }[]
        >();

      if (error) return err(toDomainDbError(error, { entity: "تقرير المدد" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          stepInstanceId: row.step_instance_id,
          transactionNo: row.transaction_step_instances?.transactions?.no ?? 0,
          stepName: row.transaction_step_instances?.name ?? "",
          assigneeName: row.transaction_step_instances?.profiles?.full_name ?? "",
          oldMinutes: row.old_minutes,
          newMinutes: row.new_minutes,
          reason: row.reason,
          changedByName: row.profiles?.full_name ?? "",
          changedAt: row.changed_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة تقرير المدد"));
    }
  }
}
