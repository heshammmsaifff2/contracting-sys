/**
 * العهد وفواتيرها.
 * كشف التكرار يقع في قاعدة البيانات؛ ما هنا هو ترتيب الخطوات:
 * الواجهة تطلب فحصًا صريحًا عند فتح العهدة فتثبُت العلامات ويراها المراجع،
 * والاعتماد يعيد الفحص على الخادم فلا يمرّ تكرار بأي حال [الحسابات 29].
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IAccountingPoster } from "../ports/accounting-poster";
import type {
  CustodyDto,
  CustodyFilter,
  SaveCustodyDto,
  SaveInvoiceDto,
} from "../dtos/documents";
import type { ICustodyRepository } from "../ports/document-repositories";

export const CUSTODY_SOURCE_TYPE = "custody_approval";

export class ListCustodies implements UseCase<CustodyFilter, readonly CustodyDto[]> {
  private readonly repo: ICustodyRepository;

  constructor(repo: ICustodyRepository) {
    this.repo = repo;
  }

  async execute(
    input: CustodyFilter,
  ): Promise<Result<readonly CustodyDto[], DomainError>> {
    return this.repo.list(input);
  }
}

export class GetCustody implements UseCase<{ id: string }, CustodyDto | null> {
  private readonly repo: ICustodyRepository;

  constructor(repo: ICustodyRepository) {
    this.repo = repo;
  }

  async execute(input: {
    id: string;
  }): Promise<Result<CustodyDto | null, DomainError>> {
    return this.repo.findById(input.id);
  }
}

export class SaveCustody implements UseCase<SaveCustodyDto, CustodyDto> {
  private readonly repo: ICustodyRepository;

  constructor(repo: ICustodyRepository) {
    this.repo = repo;
  }

  async execute(input: SaveCustodyDto): Promise<Result<CustodyDto, DomainError>> {
    if (input.holderId === "" || input.projectId === "") {
      return err(
        new ValidationError("صاحب العهدة والمشروع مطلوبان", { fields: "required" }),
      );
    }
    return this.repo.save(input);
  }
}

export class SaveCustodyInvoice implements UseCase<SaveInvoiceDto, void> {
  private readonly repo: ICustodyRepository;

  constructor(repo: ICustodyRepository) {
    this.repo = repo;
  }

  async execute(input: SaveInvoiceDto): Promise<Result<void, DomainError>> {
    if (input.invoiceNo.trim() === "") {
      return err(new ValidationError("رقم الفاتورة مطلوب", { invoiceNo: "required" }));
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return err(
        new ValidationError("قيمة الفاتورة يجب أن تكون أكبر من صفر", {
          amount: "invalid",
        }),
      );
    }
    return this.repo.saveInvoice({ ...input, invoiceNo: input.invoiceNo.trim() });
  }
}

export class RemoveCustodyInvoice implements UseCase<{ id: string }, void> {
  private readonly repo: ICustodyRepository;

  constructor(repo: ICustodyRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeInvoice(input.id);
  }
}

/** فحص صريح يثبّت علامات التكرار ليراها المراجع قبل الاعتماد. */
export class RescanCustodyDuplicates implements UseCase<{ custodyId: string }, number> {
  private readonly repo: ICustodyRepository;

  constructor(repo: ICustodyRepository) {
    this.repo = repo;
  }

  async execute(input: { custodyId: string }): Promise<Result<number, DomainError>> {
    return this.repo.rescanDuplicates(input.custodyId);
  }
}

export class ReviewDuplicateInvoice implements UseCase<{ invoiceId: string }, void> {
  private readonly repo: ICustodyRepository;

  constructor(repo: ICustodyRepository) {
    this.repo = repo;
  }

  async execute(input: { invoiceId: string }): Promise<Result<void, DomainError>> {
    return this.repo.markDuplicateReviewed(input.invoiceId);
  }
}

/** الارتجاع ينقل الفاتورة إلى العهدة الحمراء المخصّصة [الحسابات 30]. */
export class ReturnCustodyInvoice implements UseCase<
  { invoiceId: string; reason: string },
  void
> {
  private readonly repo: ICustodyRepository;

  constructor(repo: ICustodyRepository) {
    this.repo = repo;
  }

  async execute(input: {
    invoiceId: string;
    reason: string;
  }): Promise<Result<void, DomainError>> {
    return this.repo.returnInvoice(input.invoiceId, input.reason);
  }
}

export interface ApproveCustodyOutput {
  custody: CustodyDto;
  entryId: string;
}

export class ApproveCustody implements UseCase<{ id: string }, ApproveCustodyOutput> {
  private readonly repo: ICustodyRepository;
  private readonly poster: IAccountingPoster;

  constructor(repo: ICustodyRepository, poster: IAccountingPoster) {
    this.repo = repo;
    this.poster = poster;
  }

  async execute(input: {
    id: string;
  }): Promise<Result<ApproveCustodyOutput, DomainError>> {
    const approved = await this.repo.approve(input.id);
    if (!approved.ok) return approved;

    const posted = await this.poster.post(CUSTODY_SOURCE_TYPE, input.id);
    if (!posted.ok) return posted;

    const reloaded = await this.repo.findById(input.id);
    if (!reloaded.ok) return reloaded;
    if (reloaded.value === null) {
      return err(new ConflictError("تعذّر قراءة العهدة بعد اعتمادها", input));
    }

    return ok({ custody: reloaded.value, entryId: posted.value.entryId });
  }
}
