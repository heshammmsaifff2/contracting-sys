/**
 * سندات نقل الأصناف بين المواقع.
 * الاعتماد يُطلق قيدًا آليًا ينقل ثمن المادة من مخزون الموقع المُرسِل
 * إلى المستقبِل [المشتريات 9].
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IAccountingPoster } from "@application/modules/accounting/ports/accounting-poster";
import type { CreateTransferNoteDto, TransferNoteDto } from "../dtos";
import type { ITransferNoteRepository } from "../ports/transfer-note-repository";

export const TRANSFER_SOURCE_TYPE = "material_transfer";

export class ListTransferNotes implements UseCase<void, readonly TransferNoteDto[]> {
  private readonly repo: ITransferNoteRepository;

  constructor(repo: ITransferNoteRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly TransferNoteDto[], DomainError>> {
    return this.repo.list();
  }
}

export class CreateTransferNote implements UseCase<
  CreateTransferNoteDto,
  TransferNoteDto
> {
  private readonly repo: ITransferNoteRepository;

  constructor(repo: ITransferNoteRepository) {
    this.repo = repo;
  }

  async execute(
    input: CreateTransferNoteDto,
  ): Promise<Result<TransferNoteDto, DomainError>> {
    if (input.fromProjectId === input.toProjectId) {
      return err(
        new ValidationError("لا يُنقل الصنف إلى المشروع نفسه", {
          toProjectId: "same_project",
        }),
      );
    }
    if (input.lines.length === 0) {
      return err(new ValidationError("السند بلا أصناف", { lines: "empty" }));
    }
    if (input.lines.some((line) => line.qty <= 0)) {
      return err(
        new ValidationError("الكمية يجب أن تكون أكبر من صفر", { lines: "invalid_qty" }),
      );
    }
    if (input.lines.some((line) => line.unitCost < 0)) {
      return err(
        new ValidationError("ثمن الوحدة لا يكون سالبًا", { lines: "negative_cost" }),
      );
    }

    return this.repo.create(input);
  }
}

export interface ApproveTransferNoteOutput {
  note: TransferNoteDto;
  entryId: string;
}

export class ApproveTransferNote implements UseCase<
  { id: string },
  ApproveTransferNoteOutput
> {
  private readonly repo: ITransferNoteRepository;
  private readonly poster: IAccountingPoster;

  constructor(repo: ITransferNoteRepository, poster: IAccountingPoster) {
    this.repo = repo;
    this.poster = poster;
  }

  async execute(input: {
    id: string;
  }): Promise<Result<ApproveTransferNoteOutput, DomainError>> {
    const existing = await this.repo.findById(input.id);
    if (!existing.ok) return existing;
    if (existing.value === null) {
      return err(new ConflictError("سند النقل غير موجود", { id: input.id }));
    }
    if (existing.value.status !== "draft") {
      return err(new ConflictError("السند معتمَد بالفعل", { id: input.id }));
    }
    if (existing.value.total <= 0) {
      return err(
        new ConflictError("قيمة السند صفر — أدخل ثمن الوحدة قبل الاعتماد", {
          id: input.id,
        }),
      );
    }

    const approved = await this.repo.approve(input.id);
    if (!approved.ok) return approved;

    const posted = await this.poster.post(TRANSFER_SOURCE_TYPE, input.id);
    if (!posted.ok) return posted;

    return ok({ note: approved.value, entryId: posted.value.entryId });
  }
}
