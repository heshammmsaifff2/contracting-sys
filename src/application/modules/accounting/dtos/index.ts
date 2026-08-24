import type { AccountType } from "@core/modules/accounting/entities/Account";
import type { OpeningBalanceStatus } from "@core/modules/accounting/entities/OpeningBalance";

export interface AccountDto {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isPostable: boolean;
  isActive: boolean;
  /** عمق الحساب في الشجرة — للعرض المتدرّج. */
  depth: number;
}

export interface JournalLineDto {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
  partyType: string | null;
  partyId: string | null;
}

export interface JournalEntryDto {
  id: string;
  entryNo: number;
  entryDate: string;
  description: string;
  sourceType: string;
  sourceId: string | null;
  isManual: boolean;
  projectId: string | null;
  projectName: string | null;
  lines: readonly JournalLineDto[];
  totalDebit: number;
  totalCredit: number;
}

export interface OpeningBalanceDto {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  projectId: string | null;
  projectName: string | null;
  amount: number;
  asOf: string;
  status: OpeningBalanceStatus;
  notes: string;
}

export interface CreateOpeningBalanceDto {
  accountId: string;
  projectId: string | null;
  amount: number;
  asOf: string;
  notes: string;
}

export interface PostingRuleDto {
  id: string;
  sourceType: string;
  debitAccountCode: string | null;
  creditAccountCode: string | null;
  description: string;
  isActive: boolean;
}
