import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { FacilityDto, SaveFacilityDto } from "@application/modules/warehouse/dtos";
import type { IFacilityRepository } from "@application/modules/warehouse/ports/facility-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT = `
  id, project_id, code, group_name, district, name, weight, is_active,
  projects(name)
`;

interface FacilityRow {
  id: string;
  project_id: string;
  code: string;
  group_name: string;
  district: string;
  name: string;
  weight: number;
  is_active: boolean;
  projects: { name: string } | null;
}

function toDto(row: FacilityRow): FacilityDto {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.projects?.name ?? "",
    code: row.code,
    groupName: row.group_name,
    district: row.district,
    name: row.name,
    weight: Number(row.weight),
    isActive: row.is_active,
  };
}

export class SupabaseFacilityRepository implements IFacilityRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(
    projectId: string | null,
  ): Promise<Result<readonly FacilityDto[], DomainError>> {
    try {
      let query = this.client
        .from("facilities")
        .select(SELECT)
        .order("group_name")
        .order("district")
        .order("name");

      if (projectId !== null && projectId !== "") {
        query = query.eq("project_id", projectId);
      }

      const { data, error } = await query.overrideTypes<FacilityRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "المنشآت" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المنشآت"));
    }
  }

  async save(input: SaveFacilityDto): Promise<Result<FacilityDto, DomainError>> {
    try {
      const payload = {
        project_id: input.projectId,
        code: input.code,
        group_name: input.groupName,
        district: input.district,
        name: input.name,
        weight: input.weight,
        is_active: input.isActive,
      };

      const query =
        input.id === null
          ? this.client.from("facilities").insert(payload)
          : this.client.from("facilities").update(payload).eq("id", input.id);

      const { data, error } = await query
        .select(SELECT)
        .single()
        .overrideTypes<FacilityRow>();

      if (error)
        return err(toDomainDbError(error, { entity: "المنشأة", id: input.id ?? "" }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المنشأة"));
    }
  }

  /** الحذف يفشل متى كان عليها استهلاك — والسجل التاريخي أولى من الحذف. */
  async remove(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("facilities").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "المنشأة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف المنشأة"));
    }
  }
}
