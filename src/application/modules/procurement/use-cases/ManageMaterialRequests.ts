import type { DomainError } from "@core/shared/errors/domain-error";
import { ConflictError, ValidationError } from "@core/shared/errors/domain-error";
import { err, ok, okVoid, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { CreateMaterialRequestDto, MaterialRequestDto } from "../dtos";
import type { IMaterialRequestRepository } from "../ports/material-request-repository";

export class ListMaterialRequests implements UseCase<
  void,
  readonly MaterialRequestDto[]
> {
  private readonly repo: IMaterialRequestRepository;

  constructor(repo: IMaterialRequestRepository) {
    this.repo = repo;
  }

  async execute(): Promise<Result<readonly MaterialRequestDto[], DomainError>> {
    return this.repo.list();
  }
}

export class CreateMaterialRequest implements UseCase<
  CreateMaterialRequestDto,
  MaterialRequestDto
> {
  private readonly repo: IMaterialRequestRepository;

  constructor(repo: IMaterialRequestRepository) {
    this.repo = repo;
  }

  async execute(
    input: CreateMaterialRequestDto,
  ): Promise<Result<MaterialRequestDto, DomainError>> {
    if (input.lines.length === 0) {
      return err(new ValidationError("الطلب بلا أصناف", { lines: "empty" }));
    }
    if (input.lines.some((line) => line.requestedQty <= 0)) {
      return err(
        new ValidationError("الكمية المطلوبة يجب أن تكون أكبر من صفر", {
          lines: "invalid_qty",
        }),
      );
    }

    const unique = new Set(input.lines.map((line) => line.itemId));
    if (unique.size !== input.lines.length) {
      return err(
        new ValidationError("لا يجوز تكرار الصنف في الطلب نفسه", {
          lines: "duplicate",
        }),
      );
    }

    // الحد الأقصى والمتبقّي يحسبهما الخادم — لا نرسلهما إطلاقًا
    return this.repo.create(input);
  }
}

export class ApproveMaterialRequest implements UseCase<{ id: string }, void> {
  private readonly repo: IMaterialRequestRepository;

  constructor(repo: IMaterialRequestRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    const existing = await this.repo.findById(input.id);
    if (!existing.ok) return existing;
    if (existing.value === null) {
      return err(new ConflictError("طلب الاحتياج غير موجود", { id: input.id }));
    }
    if (existing.value.status !== "draft" && existing.value.status !== "submitted") {
      return err(
        new ConflictError("لا يُعتمد إلا الطلب في حالة مسودّة أو مُرسَل", {
          status: existing.value.status,
        }),
      );
    }

    // تجاوز الحد الأقصى يُرفض قبل الاعتماد
    const overLimit = existing.value.lines.filter(
      (line) => line.remainingBalance !== null && line.remainingBalance < 0,
    );
    if (overLimit.length > 0) {
      return err(
        new ConflictError(
          `${overLimit.length} صنف يتجاوز الحد الأقصى المعتمد من المكتب الفني`,
          { items: overLimit.map((line) => line.itemCode) },
        ),
      );
    }

    const updated = await this.repo.setStatus(input.id, "approved");
    if (!updated.ok) return updated;
    return okVoid();
  }
}

export class RejectMaterialRequest implements UseCase<{ id: string }, void> {
  private readonly repo: IMaterialRequestRepository;

  constructor(repo: IMaterialRequestRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.setStatus(input.id, "rejected");
  }
}

export class GetMaterialRequest implements UseCase<
  { id: string },
  MaterialRequestDto | null
> {
  private readonly repo: IMaterialRequestRepository;

  constructor(repo: IMaterialRequestRepository) {
    this.repo = repo;
  }

  async execute(input: {
    id: string;
  }): Promise<Result<MaterialRequestDto | null, DomainError>> {
    const found = await this.repo.findById(input.id);
    if (!found.ok) return found;
    return ok(found.value);
  }
}
