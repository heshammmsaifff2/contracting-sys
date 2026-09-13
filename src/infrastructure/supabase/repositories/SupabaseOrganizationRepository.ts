import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type {
  AttachmentAccessDto,
  DepartmentDto,
  JobDto,
  SaveDepartmentInput,
  SaveJobInput,
} from "@application/modules/organization/dtos";
import type { IOrganizationRepository } from "@application/modules/organization/ports/organization-repository";
import { toEmployeeType } from "@infrastructure/mappers/profile-mapper";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

interface CountRow {
  count: number;
}

interface JobRow {
  id: string;
  department_id: string;
  name: string;
  description: string;
  sort_order: number;
  role_id: string;
  roles: { key: string; name: string } | null;
  profiles: CountRow[] | null;
}

interface DepartmentRow {
  id: string;
  name: string;
  classification: string;
  description: string;
  restrict_attachments: boolean;
  sort_order: number;
  profiles: CountRow[] | null;
  jobs: JobRow[] | null;
}

interface AccessRow {
  id: string;
  kind: string;
  user_id: string | null;
  allowed_department_id: string | null;
  profiles: { full_name: string } | null;
  allowed: { name: string } | null;
}

// العلاقات بأسماء قيودها: الأقسام ترتبط بالموظفين مباشرةً وعبر جدول
// الاستثناءات، والتضمين بلا تسمية ملتبس
const DEPARTMENT_SELECT = `
  id, name, classification, description, restrict_attachments, sort_order,
  profiles!profiles_department_id_fkey(count),
  jobs!jobs_department_id_fkey(
    id, department_id, name, description, sort_order, role_id,
    roles!jobs_role_id_fkey(key, name),
    profiles!profiles_job_id_fkey(count)
  )
`;

const ACCESS_SELECT = `
  id, kind, user_id, allowed_department_id,
  profiles!department_attachment_access_user_id_fkey(full_name),
  allowed:departments!department_attachment_access_allowed_department_id_fkey(name)
`;

function countOf(rows: CountRow[] | null): number {
  return rows?.[0]?.count ?? 0;
}

function byOrder<T extends { sort_order: number; name: string }>(a: T, b: T): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ar");
}

function toJob(row: JobRow): JobDto {
  return {
    id: row.id,
    departmentId: row.department_id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    roleId: row.role_id,
    roleKey: row.roles?.key ?? "",
    roleName: row.roles?.name ?? "—",
    holderCount: countOf(row.profiles),
  };
}

export class SupabaseOrganizationRepository implements IOrganizationRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async listDepartments(): Promise<Result<readonly DepartmentDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("departments")
        .select(DEPARTMENT_SELECT)
        .overrideTypes<DepartmentRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "الأقسام" }));

      return ok(
        [...(data ?? [])].sort(byOrder).map((row) => ({
          id: row.id,
          name: row.name,
          classification: toEmployeeType(row.classification),
          description: row.description,
          restrictAttachments: row.restrict_attachments,
          sortOrder: row.sort_order,
          employeeCount: countOf(row.profiles),
          jobs: [...(row.jobs ?? [])].sort(byOrder).map(toJob),
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الأقسام"));
    }
  }

  async listAttachmentAccess(
    departmentId: string,
  ): Promise<Result<readonly AttachmentAccessDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("department_attachment_access")
        .select(ACCESS_SELECT)
        .eq("department_id", departmentId)
        .overrideTypes<AccessRow[]>();

      if (error)
        return err(
          toDomainDbError(error, { entity: "استثناءات القسم", id: departmentId }),
        );

      return ok(
        (data ?? []).map((row) =>
          row.kind === "user"
            ? {
                id: row.id,
                kind: "user" as const,
                userId: row.user_id,
                departmentId: null,
                label: row.profiles?.full_name ?? "—",
              }
            : {
                id: row.id,
                kind: "department" as const,
                userId: null,
                departmentId: row.allowed_department_id,
                label: row.allowed?.name ?? "—",
              },
        ),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة استثناءات القسم"));
    }
  }

  async saveDepartment(
    input: SaveDepartmentInput,
  ): Promise<Result<string, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("save_department", {
        // القاعدة تقبل null للإنشاء؛ والأنواع المولَّدة لا تعبّر عن uuid اختياريّ
        p_id: input.id as string,
        p_name: input.name,
        p_classification: input.classification,
        p_description: input.description,
        p_restrict_attachments: input.restrictAttachments,
        p_sort_order: input.sortOrder,
        p_access: input.access.map((entry) => ({
          kind: entry.kind,
          user_id: entry.userId,
          department_id: entry.departmentId,
        })),
      });

      if (error)
        return err(
          toDomainDbError(error, {
            entity: "القسم",
            ...(input.id ? { id: input.id } : {}),
          }),
        );
      return ok(data);
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ القسم"));
    }
  }

  async deleteDepartment(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("departments").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "القسم", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف القسم"));
    }
  }

  async saveJob(input: SaveJobInput): Promise<Result<string, DomainError>> {
    try {
      // تغيير دور الوظيفة أو قسمها يسري على شاغليها بمُشغّل القاعدة
      const columns = {
        department_id: input.departmentId,
        name: input.name,
        role_id: input.roleId,
        description: input.description,
        sort_order: input.sortOrder,
      };
      const { data, error } =
        input.id === null
          ? await this.client.from("jobs").insert(columns).select("id").single()
          : await this.client
              .from("jobs")
              .update(columns)
              .eq("id", input.id)
              .select("id")
              .single();

      if (error)
        return err(
          toDomainDbError(error, {
            entity: "الوظيفة",
            ...(input.id === null ? {} : { id: input.id }),
          }),
        );
      return ok(data.id);
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ الوظيفة"));
    }
  }

  async deleteJob(id: string): Promise<Result<void, DomainError>> {
    try {
      const { error } = await this.client.from("jobs").delete().eq("id", id);
      if (error) return err(toDomainDbError(error, { entity: "الوظيفة", id }));
      return okVoid();
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف الوظيفة"));
    }
  }
}
