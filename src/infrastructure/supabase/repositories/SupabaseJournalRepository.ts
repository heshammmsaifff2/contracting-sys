import type { DomainError } from "@core/shared/errors/domain-error";
import { toDomainError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { JournalEntryDto } from "@application/modules/accounting/dtos";
import type {
  IJournalRepository,
  JournalFilter,
} from "@application/modules/accounting/ports/journal-repository";
import {
  journalRowToDto,
  type JournalEntryRow,
} from "@infrastructure/mappers/journal-mapper";
import type { AppSupabaseClient } from "../client";
import { toDomainDbError } from "../errors";

const SELECT_WITH_LINES = `
  id, entry_no, entry_date, description, source_type, source_id, is_manual, project_id,
  projects(name),
  journal_lines(
    id, account_id, debit, credit, description, party_type, party_id,
    accounts(code, name)
  )
`;

export class SupabaseJournalRepository implements IJournalRepository {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  /** لا فلترة مشاريع هنا: سياسة RLS تحصر القيود في المشاريع المعتمدة. */
  async list(
    filter: JournalFilter = {},
  ): Promise<Result<readonly JournalEntryDto[], DomainError>> {
    try {
      let query = this.client
        .from("journal_entries")
        .select(SELECT_WITH_LINES)
        .order("entry_no", { ascending: false })
        .limit(filter.limit ?? 100);

      if (filter.projectId !== undefined && filter.projectId !== null) {
        query = query.eq("project_id", filter.projectId);
      }

      const { data, error } = await query.overrideTypes<JournalEntryRow[]>();

      if (error) return err(toDomainDbError(error, { entity: "القيود" }));
      return ok((data ?? []).map(journalRowToDto));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة القيود"));
    }
  }

  async findById(id: string): Promise<Result<JournalEntryDto | null, DomainError>> {
    try {
      const { data, error } = await this.client
        .from("journal_entries")
        .select(SELECT_WITH_LINES)
        .eq("id", id)
        .maybeSingle()
        .overrideTypes<JournalEntryRow>();

      if (error) return err(toDomainDbError(error, { entity: "القيد", id }));
      if (data === null) return ok(null);
      return ok(journalRowToDto(data));
    } catch (e) {
      return err(toDomainError(e, "تعذّر قراءة القيد"));
    }
  }
}
