import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type { PaymentRequestDto, TransferPaymentDto } from "../dtos";

export interface IPaymentRepository {
  list(): Promise<Result<readonly PaymentRequestDto[], DomainError>>;
  findById(id: string): Promise<Result<PaymentRequestDto | null, DomainError>>;
  /** يُسجّل التحويل ويضبط تاريخه — الترحيل المحاسبي يليه في use-case. */
  markTransferred(
    input: TransferPaymentDto,
  ): Promise<Result<PaymentRequestDto, DomainError>>;
}
