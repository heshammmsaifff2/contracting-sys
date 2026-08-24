import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  CreateProjectDto,
  ProjectDto,
  UpdateProjectDto,
} from "@application/modules/projects/dtos";
import type { IProjectRepository } from "@application/modules/projects/ports/project-repository";
import {
  projectRowToDto,
  type ProjectRowWithRelations,
} from "@infrastructure/mappers/project-mapper";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT_WITH_RELATIONS =
  "*, manager:profiles!projects_manager_id_fkey(full_name), extracts_officer:profiles!projects_extracts_officer_id_fkey(full_name), project_assignments(count)";

export class SupabaseProjectRepository implements IProjectRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /** لا فلترة هنا: سياسة RLS تُرجع المشاريع المعتمد عليها المستخدم فقط. */
  async list(): Promise<Result<readonly ProjectDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("projects")
        .select(SELECT_WITH_RELATIONS)
        .order("code", { ascending: true })
        .overrideTypes<ProjectRowWithRelations[]>();

      if (error) return err(toDomainDbError(error, { entity: "المشاريع" }));
      return ok((data ?? []).map(projectRowToDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المشاريع"));
    }
  }

  async findById(id: string): Promise<Result<ProjectDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("projects")
        .select(SELECT_WITH_RELATIONS)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<ProjectRowWithRelations>();

      if (error) return err(toDomainDbError(error, { entity: "المشروع", id }));
      if (data === null) return ok(null);
      return ok(projectRowToDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المشروع"));
    }
  }

  async create(input: CreateProjectDto): Promise<Result<ProjectDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("projects")
        .insert({
          code: input.code,
          name: input.name,
          owner_entity: input.ownerEntity,
          contract_value: input.contractValue,
          received_at: input.receivedAt,
          manager_id: input.managerId,
          extracts_officer_id: input.extractsOfficerId,
          status: input.status,
        })
        .select(SELECT_WITH_RELATIONS)
        .single()
        .overrideTypes<ProjectRowWithRelations>();

      if (error) return err(toDomainDbError(error, { entity: "المشروع" }));
      return ok(projectRowToDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر إنشاء المشروع"));
    }
  }

  async update(input: UpdateProjectDto): Promise<Result<ProjectDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("projects")
        .update({
          code: input.code,
          name: input.name,
          owner_entity: input.ownerEntity,
          contract_value: input.contractValue,
          received_at: input.receivedAt,
          manager_id: input.managerId,
          extracts_officer_id: input.extractsOfficerId,
          status: input.status,
        })
        .eq("id", input.id)
        .select(SELECT_WITH_RELATIONS)
        .single()
        .overrideTypes<ProjectRowWithRelations>();

      if (error)
        return err(toDomainDbError(error, { entity: "المشروع", id: input.id }));
      return ok(projectRowToDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعديل المشروع"));
    }
  }

  async remove(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("projects").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "المشروع", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف المشروع"));
    }
  }
}
