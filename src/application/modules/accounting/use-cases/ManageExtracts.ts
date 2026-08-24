/**
 * المستخلصات.
 * الاعتماد حدث محاسبي: يُثبّت الاستقطاعات ويولّد طلب الدفع على الخادم،
 * ثم يُطلق القيد الآلي عبر Edge Function [القسم 8، الحسابات 19].
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import { validateLineQty } from "@core/modules/accounting/entities/Extract";
import type { UseCase } from "@application/shared/use-case";
import type { IAccountingPoster } from "../ports/accounting-poster";
import type {
  ExtractDto,
  ExtractFilter,
  GenerateExtractDto,
  SetExtractLineQtyDto,
} from "../dtos/documents";
import type { IExtractRepository } from "../ports/document-repositories";

export const EXTRACT_SOURCE_TYPE = "extract_approval";

export class ListExtracts implements UseCase<ExtractFilter, readonly ExtractDto[]> {
  private readonly repo: IExtractRepository;

  constructor(repo: IExtractRepository) {
    this.repo = repo;
  }

  async execute(
    input: ExtractFilter,
  ): Promise<Result<readonly ExtractDto[], DomainError>> {
    return this.repo.list(input);
  }
}

export class GetExtract implements UseCase<{ id: string }, ExtractDto | null> {
  private readonly repo: IExtractRepository;

  constructor(repo: IExtractRepository) {
    this.repo = repo;
  }

  async execute(input: {
    id: string;
  }): Promise<Result<ExtractDto | null, DomainError>> {
    return this.repo.findById(input.id);
  }
}

export class GenerateExtract implements UseCase<GenerateExtractDto, { id: string }> {
  private readonly repo: IExtractRepository;

  constructor(repo: IExtractRepository) {
    this.repo = repo;
  }

  async execute(
    input: GenerateExtractDto,
  ): Promise<Result<{ id: string }, DomainError>> {
    if (input.projectId === "" || input.contractorId === "") {
      return err(
        new ValidationError("المشروع والمقاول مطلوبان", { fields: "required" }),
      );
    }
    return this.repo.generate(input);
  }
}

export class SetExtractLineQty implements UseCase<SetExtractLineQtyDto, void> {
  private readonly repo: IExtractRepository;

  constructor(repo: IExtractRepository) {
    this.repo = repo;
  }

  async execute(input: SetExtractLineQtyDto): Promise<Result<void, DomainError>> {
    const guard = validateLineQty({
      unitPrice: 0,
      maxQty: input.maxQty,
      prevQty: input.prevQty,
      currentQty: input.currentQty,
    });
    if (!guard.ok) return guard;

    return this.repo.setLineQty(input);
  }
}

export class SetExtractFinal implements UseCase<
  { id: string; isFinal: boolean },
  void
> {
  private readonly repo: IExtractRepository;

  constructor(repo: IExtractRepository) {
    this.repo = repo;
  }

  async execute(input: {
    id: string;
    isFinal: boolean;
  }): Promise<Result<void, DomainError>> {
    return this.repo.setFinal(input.id, input.isFinal);
  }
}

export class SetExtractNotes implements UseCase<{ id: string; notes: string }, void> {
  private readonly repo: IExtractRepository;

  constructor(repo: IExtractRepository) {
    this.repo = repo;
  }

  async execute(input: {
    id: string;
    notes: string;
  }): Promise<Result<void, DomainError>> {
    return this.repo.setNotes(input.id, input.notes);
  }
}

export interface ApproveExtractOutput {
  extract: ExtractDto;
  entryId: string;
}

export class ApproveExtract implements UseCase<{ id: string }, ApproveExtractOutput> {
  private readonly repo: IExtractRepository;
  private readonly poster: IAccountingPoster;

  constructor(repo: IExtractRepository, poster: IAccountingPoster) {
    this.repo = repo;
    this.poster = poster;
  }

  async execute(input: {
    id: string;
  }): Promise<Result<ApproveExtractOutput, DomainError>> {
    const approved = await this.repo.approve(input.id);
    if (!approved.ok) return approved;

    // القيد يُبنى من المستند بعد اعتماده، فلا يُرحَّل شيء لم يُثبَّت
    const posted = await this.poster.post(EXTRACT_SOURCE_TYPE, input.id);
    if (!posted.ok) return posted;

    const reloaded = await this.repo.findById(input.id);
    if (!reloaded.ok) return reloaded;
    if (reloaded.value === null) {
      return err(new ConflictError("تعذّر قراءة المستخلص بعد اعتماده", input));
    }

    return ok({ extract: reloaded.value, entryId: posted.value.entryId });
  }
}
