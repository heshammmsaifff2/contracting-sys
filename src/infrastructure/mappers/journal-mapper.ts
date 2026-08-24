import type {
  JournalEntryDto,
  JournalLineDto,
} from "@application/modules/accounting/dtos";

export interface JournalLineRow {
  id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string;
  party_type: string | null;
  party_id: string | null;
  accounts: { code: string; name: string } | null;
}

export interface JournalEntryRow {
  id: string;
  entry_no: number;
  entry_date: string;
  description: string;
  source_type: string;
  source_id: string | null;
  is_manual: boolean;
  project_id: string | null;
  projects: { name: string } | null;
  journal_lines: JournalLineRow[] | null;
}

function lineToDto(row: JournalLineRow): JournalLineDto {
  return {
    id: row.id,
    accountId: row.account_id,
    accountCode: row.accounts?.code ?? "",
    accountName: row.accounts?.name ?? "",
    debit: Number(row.debit),
    credit: Number(row.credit),
    description: row.description,
    partyType: row.party_type,
    partyId: row.party_id,
  };
}

export function journalRowToDto(row: JournalEntryRow): JournalEntryDto {
  const lines = (row.journal_lines ?? [])
    .map(lineToDto)
    // المدين قبل الدائن كما يُعرض القيد في الدفاتر
    .sort((a, b) => b.debit - a.debit);

  return {
    id: row.id,
    entryNo: row.entry_no,
    entryDate: row.entry_date,
    description: row.description,
    sourceType: row.source_type,
    sourceId: row.source_id,
    isManual: row.is_manual,
    projectId: row.project_id,
    projectName: row.projects?.name ?? null,
    lines,
    totalDebit: lines.reduce((sum, line) => sum + line.debit, 0),
    totalCredit: lines.reduce((sum, line) => sum + line.credit, 0),
  };
}
