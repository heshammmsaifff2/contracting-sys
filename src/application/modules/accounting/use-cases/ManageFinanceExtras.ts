/**
 * الدفعات المقدّمة وخطابات الضمان وإعداد الاستقطاعات.
 * الاستقطاعات قرار صاحب البرنامج: نسبها وحساباتها تُضبط من الواجهة عند
 * بدء الاستخدام، ويلتقطها كل مستخلص يُعتمد بعد ذلك كلقطة ثابتة.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { err, ok, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { IAccountingPoster } from "../ports/accounting-poster";
import type {
  AdvancePaymentDto,
  DeductionTypeDto,
  GuaranteeDto,
  SaveAdvanceDto,
  SaveDeductionTypeDto,
  SaveGuaranteeDto,
} from "../dtos/documents";
import type {
  IAdvanceRepository,
  IDeductionRepository,
  IGuaranteeRepository,
} from "../ports/document-repositories";

export const ADVANCE_SOURCE_TYPE = "advance_payment";

// ── الدفعات المقدّمة ────────────────────────────────────────────────────
export class ListAdvances implements UseCase<
  { projectId: string | null },
  readonly AdvancePaymentDto[]
> {
  private readonly repo: IAdvanceRepository;

  constructor(repo: IAdvanceRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string | null;
  }): Promise<Result<readonly AdvancePaymentDto[], DomainError>> {
    return this.repo.list(input.projectId);
  }
}

export class SaveAdvance implements UseCase<SaveAdvanceDto, AdvancePaymentDto> {
  private readonly repo: IAdvanceRepository;

  constructor(repo: IAdvanceRepository) {
    this.repo = repo;
  }

  async execute(
    input: SaveAdvanceDto,
  ): Promise<Result<AdvancePaymentDto, DomainError>> {
    if (input.contractorId === "" || input.projectId === "") {
      return err(
        new ValidationError("المقاول والمشروع مطلوبان", { fields: "required" }),
      );
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return err(
        new ValidationError("قيمة الدفعة يجب أن تكون أكبر من صفر", {
          amount: "invalid",
        }),
      );
    }
    return this.repo.save(input);
  }
}

export interface ApproveAdvanceOutput {
  advance: AdvancePaymentDto;
  entryId: string;
}

export class ApproveAdvance implements UseCase<
  { id: string; projectId: string | null },
  ApproveAdvanceOutput
> {
  private readonly repo: IAdvanceRepository;
  private readonly poster: IAccountingPoster;

  constructor(repo: IAdvanceRepository, poster: IAccountingPoster) {
    this.repo = repo;
    this.poster = poster;
  }

  async execute(input: {
    id: string;
    projectId: string | null;
  }): Promise<Result<ApproveAdvanceOutput, DomainError>> {
    const approved = await this.repo.approve(input.id);
    if (!approved.ok) return approved;

    const posted = await this.poster.post(ADVANCE_SOURCE_TYPE, input.id);
    if (!posted.ok) return posted;

    const reloaded = await this.repo.list(input.projectId);
    if (!reloaded.ok) return reloaded;

    const advance = reloaded.value.find((row) => row.id === input.id);
    if (advance === undefined) {
      return err(
        new ConflictError("تعذّر قراءة الدفعة بعد اعتمادها", { id: input.id }),
      );
    }

    return ok({ advance, entryId: posted.value.entryId });
  }
}

// ── خطابات الضمان ───────────────────────────────────────────────────────
export class ListGuarantees implements UseCase<
  { projectId: string | null },
  readonly GuaranteeDto[]
> {
  private readonly repo: IGuaranteeRepository;

  constructor(repo: IGuaranteeRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string | null;
  }): Promise<Result<readonly GuaranteeDto[], DomainError>> {
    return this.repo.list(input.projectId);
  }
}

export class SaveGuarantee implements UseCase<SaveGuaranteeDto, GuaranteeDto> {
  private readonly repo: IGuaranteeRepository;

  constructor(repo: IGuaranteeRepository) {
    this.repo = repo;
  }

  async execute(input: SaveGuaranteeDto): Promise<Result<GuaranteeDto, DomainError>> {
    if (input.projectId === "") {
      return err(new ValidationError("المشروع مطلوب", { projectId: "required" }));
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return err(
        new ValidationError("قيمة الضمان يجب أن تكون أكبر من صفر", {
          amount: "invalid",
        }),
      );
    }
    if (input.expiresAt < input.issuedAt) {
      return err(
        new ValidationError("تاريخ الانتهاء قبل تاريخ الإصدار", {
          expiresAt: "before_issued",
        }),
      );
    }
    return this.repo.save(input);
  }
}

export class RemoveGuarantee implements UseCase<{ id: string }, void> {
  private readonly repo: IGuaranteeRepository;

  constructor(repo: IGuaranteeRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.remove(input.id);
  }
}

// ── إعداد الاستقطاعات ───────────────────────────────────────────────────
export class ListDeductionTypes implements UseCase<void, readonly DeductionTypeDto[]> {
  private readonly repo: IDeductionRepository;

  constructor(repo: IDeductionRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly DeductionTypeDto[], DomainError>> {
    return this.repo.list();
  }
}

export class SaveDeductionType implements UseCase<
  SaveDeductionTypeDto,
  DeductionTypeDto
> {
  private readonly repo: IDeductionRepository;

  constructor(repo: IDeductionRepository) {
    this.repo = repo;
  }

  async execute(
    input: SaveDeductionTypeDto,
  ): Promise<Result<DeductionTypeDto, DomainError>> {
    if (input.key.trim() === "") {
      return err(new ValidationError("مفتاح الاستقطاع مطلوب", { key: "required" }));
    }
    if (input.name.trim() === "") {
      return err(new ValidationError("اسم الاستقطاع مطلوب", { name: "required" }));
    }
    if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 100) {
      return err(new ValidationError("النسبة بين صفر و100", { rate: "out_of_range" }));
    }
    if (input.accountCode.trim() === "") {
      return err(
        new ValidationError("حساب الاستقطاع مطلوب", { accountCode: "required" }),
      );
    }
    return this.repo.save({
      ...input,
      key: input.key.trim().toLowerCase(),
      name: input.name.trim(),
    });
  }
}
