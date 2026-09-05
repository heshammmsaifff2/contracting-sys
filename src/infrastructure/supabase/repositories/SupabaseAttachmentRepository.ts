import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { StoredFile } from "@application/shared/ports/file-storage";
import type {
  AddAttachmentDto,
  AttachmentVisibility,
  TransactionAttachmentDto,
} from "@application/modules/workflow/dtos";
import type { IAttachmentRepository } from "@application/modules/workflow/ports/attachment-repository";
import { toStoredFile, fromStoredFile } from "../../mappers/stored-file-mapper";
import type { Json } from "../database.types";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const VISIBILITIES: readonly AttachmentVisibility[] = [
  "participants",
  "department",
  "permission",
];

interface AttachmentRow {
  id: string | null;
  transaction_id: string | null;
  assignment_id: string | null;
  stage_instance_id: string | null;
  action_log_id: string | null;
  name: string | null;
  file: unknown;
  content_type: string | null;
  size_bytes: number | null;
  visibility: string | null;
  department_id: string | null;
  department_name: string | null;
  required_permission: string | null;
  is_authenticated: boolean | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string | null;
  seq: number | null;
  stage_name: string | null;
}

export class SupabaseAttachmentRepository implements IAttachmentRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(
    transactionId: string,
  ): Promise<Result<readonly TransactionAttachmentDto[], DomainError>> {
    try {
      const { data, error } = await this.client
        .from("transaction_attachment_list")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: true })
        .overrideTypes<AttachmentRow[]>();

      if (error)
        return err(toDomainDbError(error, { entity: "المرفقات", id: transactionId }));

      // المرفق بلا مرجع صالح لا يُعرَض: رابط مكسور أسوأ من غيابه
      return ok(
        (data ?? []).flatMap((row) => {
          const file = toStoredFile(row.file);
          if (file === null) return [];
          return [
            {
              id: row.id ?? "",
              transactionId: row.transaction_id ?? transactionId,
              assignmentId: row.assignment_id,
              stageInstanceId: row.stage_instance_id,
              actionLogId: row.action_log_id,
              name: row.name ?? "",
              file,
              contentType: row.content_type ?? "",
              sizeBytes: Number(row.size_bytes ?? 0),
              visibility: VISIBILITIES.includes(row.visibility as AttachmentVisibility)
                ? (row.visibility as AttachmentVisibility)
                : "participants",
              departmentId: row.department_id,
              departmentName: row.department_name,
              requiredPermission: row.required_permission,
              isAuthenticated: row.is_authenticated ?? false,
              uploadedBy: row.uploaded_by,
              uploadedByName: row.uploaded_by_name,
              createdAt: row.created_at ?? "",
              seq: row.seq,
              stageName: row.stage_name,
            },
          ];
        }),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة المرفقات"));
    }
  }

  async add(input: AddAttachmentDto): Promise<Result<{ id: string }, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("add_transaction_attachment", {
        p_transaction_id: input.transactionId,
        p_name: input.name,
        p_file: fromStoredFile(input.file) as Json,
        ...(input.assignmentId === null ? {} : { p_assignment_id: input.assignmentId }),
        p_content_type: input.contentType,
        p_size_bytes: input.sizeBytes,
        p_visibility: input.visibility,
        ...(input.departmentId === null ? {} : { p_department_id: input.departmentId }),
        ...(input.requiredPermission === null
          ? {}
          : { p_required_permission: input.requiredPermission }),
        p_is_authenticated: input.isAuthenticated,
      });

      if (error) return err(toDomainDbError(error, { entity: "المرفق" }));
      return ok({ id: data });
    } catch (e) {
      return err(toDomainError(e, "تعذّر حفظ المرفق"));
    }
  }

  async remove(id: string): Promise<Result<StoredFile | null, DomainError>> {
    try {
      const { data, error } = await this.client.rpc("remove_transaction_attachment", {
        p_attachment_id: id,
      });

      if (error) return err(toDomainDbError(error, { entity: "المرفق", id }));
      return ok(toStoredFile(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر حذف المرفق"));
    }
  }
}
