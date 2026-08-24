/**
 * JournalEntry — القيد المحاسبي.
 * الثابت الأهم: مجموع المدين = مجموع الدائن. تفرضه قاعدة البيانات بمُشغِّل مؤجّل،
 * ويُعاد التحقّق منه هنا ليكشف أي خلل قبل العرض أو التقارير.
 */
import type { EntityId } from "../../../shared/entities/base-entity";
import { ValidationError } from "../../../shared/errors/domain-error";
import { err, ok, type Result } from "../../../shared/result";
import { Money, type CurrencyCode } from "../../../shared/value-objects/money";

export interface JournalLineProps {
  id: EntityId;
  accountId: EntityId;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  partyType: string | null;
  partyId: EntityId | null;
}

export interface JournalEntryProps {
  id: EntityId;
  entryNo: number;
  entryDate: Date;
  description: string;
  sourceType: string;
  sourceId: EntityId | null;
  isManual: boolean;
  projectId: EntityId | null;
  projectName: string | null;
  lines: readonly JournalLineProps[];
  currency: CurrencyCode;
}

export class JournalEntry {
  readonly id: EntityId;
  readonly entryNo: number;
  readonly entryDate: Date;
  readonly description: string;
  readonly sourceType: string;
  readonly sourceId: EntityId | null;
  readonly isManual: boolean;
  readonly projectId: EntityId | null;
  readonly projectName: string | null;
  readonly lines: readonly JournalLineProps[];
  readonly currency: CurrencyCode;

  private constructor(props: JournalEntryProps) {
    this.id = props.id;
    this.entryNo = props.entryNo;
    this.entryDate = props.entryDate;
    this.description = props.description;
    this.sourceType = props.sourceType;
    this.sourceId = props.sourceId;
    this.isManual = props.isManual;
    this.projectId = props.projectId;
    this.projectName = props.projectName;
    this.lines = props.lines;
    this.currency = props.currency;
    Object.freeze(this);
  }

  static restore(props: JournalEntryProps): JournalEntry {
    return new JournalEntry(props);
  }

  /** Build an entry, rejecting anything unbalanced. */
  static create(props: JournalEntryProps): Result<JournalEntry, ValidationError> {
    if (props.lines.length < 2) {
      return err(
        new ValidationError("القيد يحتاج سطرين على الأقل", { lines: "too_few" }),
      );
    }

    const invalidSide = props.lines.some(
      (line) => (line.debit === 0) === (line.credit === 0),
    );
    if (invalidSide) {
      return err(
        new ValidationError("كل سطر يجب أن يكون مدينًا أو دائنًا، لا الاثنين", {
          lines: "one_side",
        }),
      );
    }

    const entry = new JournalEntry(props);
    if (!entry.isBalanced) {
      return err(
        new ValidationError("القيد غير متوازن: مجموع المدين لا يساوي الدائن", {
          lines: "unbalanced",
        }),
      );
    }
    return ok(entry);
  }

  get totalDebit(): Money {
    return this.sum((line) => line.debit);
  }

  get totalCredit(): Money {
    return this.sum((line) => line.credit);
  }

  get isBalanced(): boolean {
    return this.totalDebit.minor === this.totalCredit.minor;
  }

  private sum(pick: (line: JournalLineProps) => number): Money {
    const total = this.lines.reduce((acc, line) => acc + pick(line), 0);
    const money = Money.create(total, this.currency);
    return money.ok ? money.value : Money.zero(this.currency);
  }
}
