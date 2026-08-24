/**
 * الإشعارات: قراءة محكومة بـ RLS (كل مستخدم إشعاراته وحده)،
 * والتعليم كمقروء عبر دالة خادم لأنه لا سياسة تعديل على الجدول.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type {
  NotificationDto,
  NotificationFilter,
} from "@application/modules/platform/dtos/notification";
import type { INotificationRepository } from "@application/modules/platform/ports/notification-repository";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

export class SupabaseNotificationRepository implements INotificationRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async list(
    filter: NotificationFilter,
  ): Promise<Result<readonly NotificationDto[], DomainError>> {
    try {
      let query = this.client
        .from("notifications")
        .select(
          "id, kind, title, body, entity_type, entity_id, project_id, is_read, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(filter.limit);

      if (filter.unreadOnly) query = query.eq("is_read", false);

      const { data, error } = await query;
      if (error) return err(toDomainDbError(error, { entity: "الإشعارات" }));

      return ok(
        (data ?? []).map((row) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          body: row.body,
          entityType: row.entity_type,
          entityId: row.entity_id,
          projectId: row.project_id,
          isRead: row.is_read,
          createdAt: row.created_at,
        })),
      );
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة الإشعارات"));
    }
  }

  async unreadCount(): Promise<Result<number, DomainError>> {
    try {
      const { count, error } = await this.client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);

      if (error) return err(toDomainDbError(error, { entity: "الإشعارات" }));
      return ok(count ?? 0);
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة عدد الإشعارات"));
    }
  }

  async markRead(ids: readonly string[]): Promise<Result<number, DomainError>> {
    try {
      // قائمة فارغة تعني «علّم الكل»: نحذف المعامل فتأخذ الدالة قيمتها الافتراضية.
      const { data, error } = await this.client.rpc(
        "mark_notifications_read",
        ids.length === 0 ? {} : { p_ids: [...ids] },
      );

      if (error) return err(toDomainDbError(error, { entity: "الإشعارات" }));
      return ok(data ?? 0);
    } catch (e) {
      return err(toDomainError(e, "تعذّر تعليم الإشعارات كمقروءة"));
    }
  }
}
