import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  AvailableActionDto,
  InboxFilter,
  InboxItemDto,
  TimelineEntryDto,
  TransactionBriefDto,
  TransactionDto,
} from "../dtos";

export interface IInboxRepository {
  /**
   * صندوق الوارد. العدّاد واللون محسوبان على الخادم داخل مواعيد العمل،
   * فلا يُعاد حسابهما في المتصفّح.
   */
  list(filter: InboxFilter): Promise<Result<readonly InboxItemDto[], DomainError>>;
  findTransaction(id: string): Promise<Result<TransactionDto | null, DomainError>>;
  /** بحث يُظهر المعاملة بلا تفاصيل لغير الموقّعين [المراسلات 19]. */
  searchBrief(
    query: string,
  ): Promise<Result<readonly TransactionBriefDto[], DomainError>>;
  /**
   * الأزرار المتاحة على التكليفات المفتوحة — الواجهة تعرض ما يُرجعه المسار
   * لا زرًّا واحدًا اسمه «إنجاز».
   */
  listAvailableActions(filter: {
    transactionId?: string;
    mineOnly?: boolean;
  }): Promise<Result<readonly AvailableActionDto[], DomainError>>;
  /** الخطّ الزمني — كل إجراء اتُّخذ، بما فيه الملاحظات. */
  listTimeline(
    transactionId: string,
  ): Promise<Result<readonly TimelineEntryDto[], DomainError>>;
}
