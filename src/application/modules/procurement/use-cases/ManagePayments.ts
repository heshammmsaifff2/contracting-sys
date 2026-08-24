/**
 * الدفع والتحويل البنكي.
 * ضغط «تم التحويل» يُسجّل التحويل ثم يُطلق قيد الصرف آليًا [المشتريات 4]:
 * ذمم المورّد ومصاريف البنك مدينة مقابل البنك دائنًا.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IAccountingPoster } from "@application/modules/accounting/ports/accounting-poster";
import type { PaymentRequestDto, TransferPaymentDto } from "../dtos";
import type { IPaymentRepository } from "../ports/payment-repository";

export const PAYMENT_SOURCE_TYPE = "payment_transfer";

export class ListPaymentRequests implements UseCase<
  void,
  readonly PaymentRequestDto[]
> {
  private readonly repo: IPaymentRepository;

  constructor(repo: IPaymentRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly PaymentRequestDto[], DomainError>> {
    return this.repo.list();
  }
}

export interface TransferPaymentOutput {
  payment: PaymentRequestDto;
  entryId: string;
}

export class TransferPayment implements UseCase<
  TransferPaymentDto,
  TransferPaymentOutput
> {
  private readonly repo: IPaymentRepository;
  private readonly poster: IAccountingPoster;

  constructor(repo: IPaymentRepository, poster: IAccountingPoster) {
    this.repo = repo;
    this.poster = poster;
  }

  async execute(
    input: TransferPaymentDto,
  ): Promise<Result<TransferPaymentOutput, DomainError>> {
    if (input.bankFeeCompany < 0 || input.bankFeeClient < 0) {
      return err(
        new ValidationError("مصاريف التحويل لا تكون سالبة", { fees: "negative" }),
      );
    }

    const existing = await this.repo.findById(input.id);
    if (!existing.ok) return existing;
    if (existing.value === null) {
      return err(new ConflictError("طلب الدفع غير موجود", { id: input.id }));
    }
    if (existing.value.status === "transferred") {
      return err(new ConflictError("الطلب محوَّل بالفعل", { id: input.id }));
    }
    if (existing.value.bankAccountId === null) {
      return err(
        new ConflictError("لا يوجد حساب بنكي للمورّد — أضفه قبل التحويل", {
          id: input.id,
        }),
      );
    }

    const transferred = await this.repo.markTransferred(input);
    if (!transferred.ok) return transferred;

    const posted = await this.poster.post(PAYMENT_SOURCE_TYPE, input.id);
    if (!posted.ok) return posted;

    return ok({ payment: transferred.value, entryId: posted.value.entryId });
  }
}
