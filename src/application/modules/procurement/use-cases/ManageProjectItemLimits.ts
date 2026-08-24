/**
 * حدود المكتب الفني: الكمية القصوى لكل صنف في المشروع [المشتريات 1].
 * تُدخل مرة واحدة ثم يستدعيها كل طلب احتياج ويحسب المتبقّي منها آليًا.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type { ProjectItemLimitDto, SaveProjectItemLimitDto } from "../dtos";
import type { IMaterialRequestRepository } from "../ports/material-request-repository";

export class ListProjectItemLimits implements UseCase<
  { projectId: string },
  readonly ProjectItemLimitDto[]
> {
  private readonly repo: IMaterialRequestRepository;

  constructor(repo: IMaterialRequestRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string;
  }): Promise<Result<readonly ProjectItemLimitDto[], DomainError>> {
    return this.repo.listLimits(input.projectId);
  }
}

export class SaveProjectItemLimit implements UseCase<SaveProjectItemLimitDto, void> {
  private readonly repo: IMaterialRequestRepository;

  constructor(repo: IMaterialRequestRepository) {
    this.repo = repo;
  }

  async execute(input: SaveProjectItemLimitDto): Promise<Result<void, DomainError>> {
    if (!Number.isFinite(input.maxQty) || input.maxQty < 0) {
      return err(
        new ValidationError("الكمية القصوى لا يمكن أن تكون سالبة", {
          maxQty: "invalid",
        }),
      );
    }
    return this.repo.saveLimit(input);
  }
}

export interface SaveSiteStockInput {
  projectId: string;
  itemId: string;
  quantity: number;
}

export class SaveSiteStock implements UseCase<SaveSiteStockInput, void> {
  private readonly repo: IMaterialRequestRepository;

  constructor(repo: IMaterialRequestRepository) {
    this.repo = repo;
  }

  async execute(input: SaveSiteStockInput): Promise<Result<void, DomainError>> {
    if (!Number.isFinite(input.quantity) || input.quantity < 0) {
      return err(
        new ValidationError("المتوفّر بالموقع لا يكون سالبًا", {
          quantity: "invalid",
        }),
      );
    }
    return this.repo.saveSiteStock(input.projectId, input.itemId, input.quantity);
  }
}
