/**
 * اعتماد الرصيد الافتتاحي — تطبيق السياسة الموحّدة في القسم 8:
 *   1) تغيير حالة المستند إلى approved.
 *   2) استدعاء محرّك الترحيل بـ { source_type, source_id }.
 *   3) المحرّك يقرأ المستند ويبني القيد آليًا بلا أي إدخال بشري.
 * الخطوة الثالثة تقع كلّها على الخادم داخل معاملة واحدة.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { OpeningBalanceDto } from "../dtos";
import type { IAccountingPoster } from "../ports/accounting-poster";
import type { IOpeningBalanceRepository } from "../ports/opening-balance-repository";

export interface ApproveOpeningBalanceOutput {
  balance: OpeningBalanceDto;
  entryId: string;
}

export const OPENING_BALANCE_SOURCE_TYPE = "opening_balance";

export class ApproveOpeningBalance implements UseCase<
  { id: string },
  ApproveOpeningBalanceOutput
> {
  private readonly balances: IOpeningBalanceRepository;
  private readonly poster: IAccountingPoster;

  constructor(balances: IOpeningBalanceRepository, poster: IAccountingPoster) {
    this.balances = balances;
    this.poster = poster;
  }

  async execute(input: {
    id: string;
  }): Promise<Result<ApproveOpeningBalanceOutput, DomainError>> {
    const existing = await this.balances.findById(input.id);
    if (!existing.ok) return existing;
    if (existing.value === null) {
      return err(new ConflictError("الرصيد الافتتاحي غير موجود", { id: input.id }));
    }
    if (existing.value.status === "approved") {
      return err(new ConflictError("الرصيد معتمَد بالفعل", { id: input.id }));
    }

    const approved = await this.balances.approve(input.id);
    if (!approved.ok) return approved;

    const posted = await this.poster.post(OPENING_BALANCE_SOURCE_TYPE, input.id);
    if (!posted.ok) return posted;

    return ok({ balance: approved.value, entryId: posted.value.entryId });
  }
}
