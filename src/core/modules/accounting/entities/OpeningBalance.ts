/**
 * OpeningBalance — الرصيد الافتتاحي لحساب.
 * اعتماده هو الحدث الذي يُطلق القيد الآلي عبر محرّك الترحيل،
 * تطبيقًا للسياسة الموحّدة: كل اعتماد ⇒ قيد بلا تدخّل بشري.
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Money, type CurrencyCode } from "../../../shared/value-objects/money";

export type OpeningBalanceStatus = "draft" | "approved";

export interface OpeningBalanceProps {
  id: EntityId;
  accountId: EntityId;
  accountCode: string;
  accountName: string;
  projectId: EntityId | null;
  projectName: string | null;
  amount: Money;
  asOf: Date;
  status: OpeningBalanceStatus;
  notes: string;
}

export class OpeningBalance {
  readonly id: EntityId;
  readonly accountId: EntityId;
  readonly accountCode: string;
  readonly accountName: string;
  readonly projectId: EntityId | null;
  readonly projectName: string | null;
  readonly amount: Money;
  readonly asOf: Date;
  readonly status: OpeningBalanceStatus;
  readonly notes: string;

  private constructor(props: OpeningBalanceProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.accountCode = props.accountCode;
    this.accountName = props.accountName;
    this.projectId = props.projectId;
    this.projectName = props.projectName;
    this.amount = props.amount;
    this.asOf = props.asOf;
    this.status = props.status;
    this.notes = props.notes;
    Object.freeze(this);
  }

  static restore(props: OpeningBalanceProps): OpeningBalance {
    return new OpeningBalance(props);
  }

  static create(input: {
    id: EntityId;
    accountId: EntityId;
    accountCode?: string;
    accountName?: string;
    projectId?: EntityId | null;
    amount: number;
    currency: CurrencyCode;
    asOf: Date;
    notes?: string;
  }): Result<OpeningBalance, ValidationError> {
    if (input.amount === 0) {
      return err(
        new ValidationError("الرصيد الافتتاحي لا يكون صفرًا", { amount: "zero" }),
      );
    }

    const amount = Money.create(input.amount, input.currency);
    if (!amount.ok) return amount;

    if (Number.isNaN(input.asOf.getTime())) {
      return err(new ValidationError("التاريخ غير صالح", { asOf: "invalid" }));
    }

    return ok(
      new OpeningBalance({
        id: input.id,
        accountId: input.accountId,
        accountCode: input.accountCode ?? "",
        accountName: input.accountName ?? "",
        projectId: input.projectId ?? null,
        projectName: null,
        amount: amount.value,
        asOf: input.asOf,
        status: "draft",
        notes: input.notes ?? "",
      }),
    );
  }

  /** لا يُرحَّل إلا المعتمَد، ولا يُعتمَد المعتمَد مرتين. */
  get canBeApproved(): boolean {
    return this.status === "draft";
  }

  get isPostable(): boolean {
    return this.status === "approved";
  }

  /** الرصيد الموجب يجعل الحساب مدينًا، والسالب دائنًا. */
  get side(): "debit" | "credit" {
    return this.amount.isNegative ? "credit" : "debit";
  }
}
