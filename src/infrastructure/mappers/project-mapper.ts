import type { ProjectStatus } from "@core/modules/projects/entities/Project";
import { PROJECT_STATUSES } from "@core/modules/projects/entities/Project";
import type { ProjectDto } from "@application/modules/projects/dtos";
import type { Tables } from "@infrastructure/supabase/database.types";

export type ProjectRow = Tables<"projects">;

/** صف مشروع مع الحقول المرتبطة كما تُرجعها استعلامات select المتداخلة. */
export interface ProjectRowWithRelations extends ProjectRow {
  manager: { full_name: string } | null;
  extracts_officer: { full_name: string } | null;
  project_assignments: { count: number }[] | null;
}

function toStatus(raw: string): ProjectStatus {
  return PROJECT_STATUSES.includes(raw as ProjectStatus)
    ? (raw as ProjectStatus)
    : "draft";
}

export function projectRowToDto(row: ProjectRowWithRelations): ProjectDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    ownerEntity: row.owner_entity,
    contractValue: Number(row.contract_value),
    receivedAt: row.received_at,
    managerId: row.manager_id,
    managerName: row.manager?.full_name ?? null,
    extractsOfficerId: row.extracts_officer_id,
    extractsOfficerName: row.extracts_officer?.full_name ?? null,
    status: toStatus(row.status),
    assigneeCount: row.project_assignments?.[0]?.count ?? 0,
  };
}
