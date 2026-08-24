/**
 * قراءة الإشعارات وتعليمها مقروءة. لا إنشاء من الواجهة إطلاقًا:
 * الإشعار يُولَد من دوال الخادم عند الحدث نفسه.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { NotificationDto, NotificationFilter } from "../dtos/notification";
import type { INotificationRepository } from "../ports/notification-repository";

export class ListNotifications implements UseCase<
  NotificationFilter,
  readonly NotificationDto[]
> {
  private readonly repo: INotificationRepository;

  constructor(repo: INotificationRepository) {
    this.repo = repo;
  }

  async execute(
    input: NotificationFilter,
  ): Promise<Result<readonly NotificationDto[], DomainError>> {
    return this.repo.list(input);
  }
}

export class MarkNotificationsRead implements UseCase<
  { ids: readonly string[] },
  number
> {
  private readonly repo: INotificationRepository;

  constructor(repo: INotificationRepository) {
    this.repo = repo;
  }

  async execute(input: {
    ids: readonly string[];
  }): Promise<Result<number, DomainError>> {
    return this.repo.markRead(input.ids);
  }
}
