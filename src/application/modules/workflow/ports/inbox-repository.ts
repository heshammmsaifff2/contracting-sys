import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  InboxFilter,
  InboxItemDto,
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
}
