import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { StoredFile } from "@application/shared/ports/file-storage";
import type { AddAttachmentDto, TransactionAttachmentDto } from "../dtos";

export interface IAttachmentRepository {
  /** مرفقات معاملة — RLS تحجب المقيَّد عمّن لا يراه. */
  list(
    transactionId: string,
  ): Promise<Result<readonly TransactionAttachmentDto[], DomainError>>;
  add(input: AddAttachmentDto): Promise<Result<{ id: string }, DomainError>>;
  /**
   * يعيد مرجع الملفّ المحذوف ليحذف المستدعي الأصلَ من المزوّد —
   * القاعدة لا تملك مفتاح المزوّد ولا يجوز أن تملكه.
   */
  remove(id: string): Promise<Result<StoredFile | null, DomainError>>;
}
