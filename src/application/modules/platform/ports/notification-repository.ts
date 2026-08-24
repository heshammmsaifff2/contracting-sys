import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { NotificationDto, NotificationFilter } from "../dtos/notification";

export interface INotificationRepository {
  list(
    filter: NotificationFilter,
  ): Promise<Result<readonly NotificationDto[], DomainError>>;
  unreadCount(): Promise<Result<number, DomainError>>;
  /** ids فارغة تعني: علّم الكل مقروءًا. */
  markRead(ids: readonly string[]): Promise<Result<number, DomainError>>;
}
