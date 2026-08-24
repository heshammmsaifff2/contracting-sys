import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  AssignUserToProjectDto,
  ProjectAssignmentDto,
  ProjectMemberDto,
} from "@application/modules/projects/dtos";
import type { IProjectAssignmentRepository } from "@application/modules/projects/ports/project-assignment-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

interface AssignmentRow {
  id: string;
  project_id: string;
  user_id: string;
  can_sign: boolean;
  profiles: { full_name: string; code: string | null } | null;
}

const SELECT_WITH_PROFILE =
  "id, project_id, user_id, can_sign, profiles(full_name, code)";

function toDto(row: AssignmentRow): ProjectAssignmentDto {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    userName: row.profiles?.full_name ?? "",
    userCode: row.profiles?.code ?? null,
    canSign: row.can_sign,
  };
}

export class SupabaseProjectAssignmentRepository implements IProjectAssignmentRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /** عبر دالة مالك: تُعيد الاسم والفئة فقط لأعضاء المشاريع المرئية. */
  async listMembers(
    projectId: string | null,
  ): Promise<Result<readonly ProjectMemberDto[], DomainError>> {
    try {
      const { data, error } = await this.client.rpc(
        "project_members",
        projectId === null || projectId === "" ? {} : { p_project_id: projectId },
      );

      if (error) return err(toDomainDbError(error, { entity: "أعضاء المشروع" }));

      return ok(
        (data ?? []).map((row) => ({
          userId: row.user_id,
          projectId: row.project_id,
          fullName: row.full_name,
          employeeType: row.employee_type,
          canSign: row.can_sign,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة أعضاء المشروع"));
    }
  }

  async listByProject(
    projectId: string,
  ): Promise<Result<readonly ProjectAssignmentDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("project_assignments")
        .select(SELECT_WITH_PROFILE)
        .eq("project_id", projectId)
        .overrideTypes<AssignmentRow[]>();

      if (error)
        return err(
          toDomainDbError(error, { entity: "اعتمادات المشروع", id: projectId }),
        );
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة اعتمادات المشروع"));
    }
  }

  async assign(
    input: AssignUserToProjectDto,
  ): Promise<Result<ProjectAssignmentDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("project_assignments")
        .insert({
          project_id: input.projectId,
          user_id: input.userId,
          can_sign: input.canSign,
        })
        .select(SELECT_WITH_PROFILE)
        .single()
        .overrideTypes<AssignmentRow>();

      if (error) return err(toDomainDbError(error, { entity: "اعتماد الموظف" }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر اعتماد الموظف على المشروع"));
    }
  }

  async setCanSign(id: string, canSign: boolean): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("project_assignments")
        .update({ can_sign: canSign })
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "اعتماد الموظف", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل حق التوقيع"));
    }
  }

  async remove(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client
        .from("project_assignments")
        .delete()
        .eq("id", id);

      if (error) return err(toDomainDbError(error, { entity: "اعتماد الموظف", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر إلغاء الاعتماد"));
    }
  }
}
