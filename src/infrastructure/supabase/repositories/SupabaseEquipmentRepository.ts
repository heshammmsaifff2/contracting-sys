import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type {
  EquipmentStatus,
  MaintenanceKind,
} from "@core/modules/warehouse/entities/Equipment";
import type {
  AddMaintenanceDto,
  EquipmentDto,
  EquipmentMovementDto,
  IdleEquipmentDto,
  MaintenanceDto,
  MoveEquipmentDto,
  ReleaseEquipmentDto,
  SaveEquipmentDto,
} from "@application/modules/warehouse/dtos";
import type { IEquipmentRepository } from "@application/modules/warehouse/ports/equipment-repository";
import {
  fromStoredFile,
  toStoredFile,
} from "@infrastructure/mappers/stored-file-mapper";
import type { Json } from "../database.types";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT = `
  id, code, name, category, current_project_id, status, spec, photo,
  acquired_at, is_active,
  projects(name),
  equipment_maintenance(cost)
`;

interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  category: string;
  current_project_id: string | null;
  status: string;
  spec: unknown;
  photo: unknown;
  acquired_at: string | null;
  is_active: boolean;
  projects: { name: string } | null;
  equipment_maintenance: { cost: number }[] | null;
}

const STATUSES: readonly EquipmentStatus[] = [
  "working",
  "idle",
  "maintenance",
  "out_of_service",
];

function toStatus(raw: string): EquipmentStatus {
  return STATUSES.find((s) => s === raw) ?? "idle";
}

function toKind(raw: string): MaintenanceKind {
  return raw === "periodic" ? "periodic" : "repair";
}

/** المواصفات حرّة الشكل: نمرّرها كما هي بعد تسلسلها لتوافق نوع jsonb. */
function toSpecJson(spec: Record<string, unknown>): Json {
  return JSON.parse(JSON.stringify(spec)) as Json;
}

function toSpec(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toDto(row: EquipmentRow): EquipmentDto {
  const maintenance = row.equipment_maintenance ?? [];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    currentProjectId: row.current_project_id,
    currentProjectName: row.projects?.name ?? "",
    status: toStatus(row.status),
    spec: toSpec(row.spec),
    photo: toStoredFile(row.photo),
    acquiredAt: row.acquired_at,
    isActive: row.is_active,
    maintenanceCount: maintenance.length,
    maintenanceCost: maintenance.reduce((sum, m) => sum + Number(m.cost), 0),
  };
}

export class SupabaseEquipmentRepository implements IEquipmentRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(query: string): Promise<Result<readonly EquipmentDto[], DomainError>> {
    try {
      let request = this.client.from("equipment").select(SELECT).order("code");

      const term = query.trim();
      if (term !== "") {
        request = request.or(`code.ilike.%${term}%,name.ilike.%${term}%`);
      }

      const { data, error } = await request.overrideTypes<EquipmentRow[]>();
      if (error) return err(toDomainDbError(error, { entity: "المعدّات" }));
      return ok((data ?? []).map(toDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المعدّات"));
    }
  }

  async findById(id: string): Promise<Result<EquipmentDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("equipment")
        .select(SELECT)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<EquipmentRow>();

      if (error) return err(toDomainDbError(error, { entity: "المعدّة", id }));
      if (data === null) return ok(null);
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المعدّة"));
    }
  }

  async save(input: SaveEquipmentDto): Promise<Result<EquipmentDto, DomainError>> {
    try {
      const payload = {
        code: input.code,
        name: input.name,
        category: input.category,
        status: input.status,
        spec: toSpecJson(input.spec),
        photo: fromStoredFile(input.photo),
        acquired_at: input.acquiredAt === "" ? null : input.acquiredAt,
        is_active: input.isActive,
      };

      const request =
        input.id === null
          ? this.client.from("equipment").insert(payload)
          : this.client.from("equipment").update(payload).eq("id", input.id);

      const { data, error } = await request
        .select(SELECT)
        .single()
        .overrideTypes<EquipmentRow>();

      if (error)
        return err(toDomainDbError(error, { entity: "المعدّة", id: input.id ?? "" }));
      return ok(toDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المعدّة"));
    }
  }

  async listMaintenance(
    equipmentId: string,
  ): Promise<Result<readonly MaintenanceDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("equipment_maintenance")
        .select("id, equipment_id, kind, part, notes, cost, performed_at, next_due_at")
        .eq("equipment_id", equipmentId)
        .order("performed_at", { ascending: false });

      if (error) return err(toDomainDbError(error, { entity: "صيانة المعدّة" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          equipmentId: row.equipment_id,
          kind: toKind(row.kind),
          part: row.part,
          notes: row.notes,
          cost: Number(row.cost),
          performedAt: row.performed_at,
          nextDueAt: row.next_due_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة سجل الصيانة"));
    }
  }

  async addMaintenance(
    input: AddMaintenanceDto,
  ): Promise<Result<MaintenanceDto, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("equipment_maintenance")
        .insert({
          equipment_id: input.equipmentId,
          kind: input.kind,
          part: input.part,
          notes: input.notes,
          cost: input.cost,
          performed_at: input.performedAt,
          next_due_at: input.nextDueAt === "" ? null : input.nextDueAt,
        })
        .select("id, equipment_id, kind, part, notes, cost, performed_at, next_due_at")
        .single();

      if (error) return err(toDomainDbError(error, { entity: "سجل الصيانة" }));

      return ok({
        id: data.id,
        equipmentId: data.equipment_id,
        kind: toKind(data.kind),
        part: data.part,
        notes: data.notes,
        cost: Number(data.cost),
        performedAt: data.performed_at,
        nextDueAt: data.next_due_at,
      });
    } catch (e) {
      return err(toDomainError(e, "تعذّر تسجيل الصيانة"));
    }
  }

  async listMovements(
    equipmentId: string | null,
  ): Promise<Result<readonly EquipmentMovementDto[], DomainError>> {
    try {
      let request = this.client
        .from("equipment_movements")
        .select(
          `id, equipment_id, project_id, from_date, to_date, supervisor_id, note,
           equipment(code, name), projects(name),
           profiles!equipment_movements_supervisor_id_fkey(full_name)`,
        )
        .order("from_date", { ascending: false })
        .limit(200);

      if (equipmentId !== null && equipmentId !== "") {
        request = request.eq("equipment_id", equipmentId);
      }

      const { data, error } = await request.overrideTypes<
        {
          id: string;
          equipment_id: string;
          project_id: string;
          from_date: string;
          to_date: string | null;
          supervisor_id: string | null;
          note: string;
          equipment: { code: string; name: string } | null;
          projects: { name: string } | null;
          profiles: { full_name: string } | null;
        }[]
      >();

      if (error) return err(toDomainDbError(error, { entity: "حركة المعدّات" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          equipmentId: row.equipment_id,
          equipmentCode: row.equipment?.code ?? "",
          equipmentName: row.equipment?.name ?? "",
          projectId: row.project_id,
          projectName: row.projects?.name ?? "",
          fromDate: row.from_date,
          toDate: row.to_date,
          supervisorId: row.supervisor_id,
          supervisorName: row.profiles?.full_name ?? "",
          note: row.note,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة حركة المعدّات"));
    }
  }

  async move(
    input: MoveEquipmentDto,
  ): Promise<Result<{ movementId: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("move_equipment", {
        p_equipment_id: input.equipmentId,
        p_project_id: input.projectId,
        p_from_date: input.fromDate,
        p_note: input.note,
        ...(input.supervisorId === null ? {} : { p_supervisor_id: input.supervisorId }),
      });

      if (error) return err(toDomainDbError(error, { entity: "نقل المعدّة" }));
      return ok({ movementId: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر نقل المعدّة"));
    }
  }

  async release(
    input: ReleaseEquipmentDto,
  ): Promise<Result<{ idleId: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("release_equipment", {
        p_equipment_id: input.equipmentId,
        p_to_date: input.toDate,
        p_note: input.note,
        ...(input.availableTo === null || input.availableTo === ""
          ? {}
          : { p_available_to: input.availableTo }),
      });

      if (error) return err(toDomainDbError(error, { entity: "إخلاء المعدّة" }));
      return ok({ idleId: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر إخلاء المعدّة"));
    }
  }

  async listIdle(): Promise<Result<readonly IdleEquipmentDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("idle_equipment")
        .select(
          `id, equipment_id, available_from, available_to, note,
           equipment(code, name, category)`,
        )
        .eq("is_closed", false)
        .order("available_from", { ascending: false })
        .overrideTypes<
          {
            id: string;
            equipment_id: string;
            available_from: string;
            available_to: string | null;
            note: string;
            equipment: { code: string; name: string; category: string } | null;
          }[]
        >();

      if (error) return err(toDomainDbError(error, { entity: "المعدّات الشاغرة" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          equipmentId: row.equipment_id,
          equipmentCode: row.equipment?.code ?? "",
          equipmentName: row.equipment?.name ?? "",
          category: row.equipment?.category ?? "",
          availableFrom: row.available_from,
          availableTo: row.available_to,
          note: row.note,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المعدّات الشاغرة"));
    }
  }
}
