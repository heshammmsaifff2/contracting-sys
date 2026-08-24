/**
 * المقاولون وبنود تعاقدهم.
 * سعر البند وحده الأقصى يُدخلان هنا مرة واحدة، ثم لا يسألهما أي مستخلص
 * بعد ذلك — تجسيد «الإدخال مرة واحدة» في وحدة الحسابات.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import { ValidationError } from "@core/shared/errors/domain-error";
import { err, type Result } from "@core/shared/result";
import type { UseCase } from "@application/shared/use-case";
import type {
  ContractItemDto,
  ContractorBalanceDto,
  ContractorDto,
  SaveContractItemDto,
  SaveContractorDto,
} from "../dtos/documents";
import type { IContractorRepository } from "../ports/document-repositories";

export class SearchContractors implements UseCase<
  { query: string },
  readonly ContractorDto[]
> {
  private readonly repo: IContractorRepository;

  constructor(repo: IContractorRepository) {
    this.repo = repo;
  }

  async execute(input: {
    query: string;
  }): Promise<Result<readonly ContractorDto[], DomainError>> {
    return this.repo.search(input.query);
  }
}

export class SaveContractor implements UseCase<SaveContractorDto, ContractorDto> {
  private readonly repo: IContractorRepository;

  constructor(repo: IContractorRepository) {
    this.repo = repo;
  }

  async execute(input: SaveContractorDto): Promise<Result<ContractorDto, DomainError>> {
    if (input.code.trim() === "") {
      return err(new ValidationError("كود المقاول مطلوب", { code: "required" }));
    }
    if (input.name.trim().length < 2) {
      return err(new ValidationError("اسم المقاول مطلوب", { name: "required" }));
    }
    return this.repo.save({
      ...input,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
    });
  }
}

export class ListContractItems implements UseCase<
  { contractorId: string; projectId: string | null },
  readonly ContractItemDto[]
> {
  private readonly repo: IContractorRepository;

  constructor(repo: IContractorRepository) {
    this.repo = repo;
  }

  async execute(input: {
    contractorId: string;
    projectId: string | null;
  }): Promise<Result<readonly ContractItemDto[], DomainError>> {
    return this.repo.listContractItems(input.contractorId, input.projectId);
  }
}

export class SaveContractItem implements UseCase<SaveContractItemDto, ContractItemDto> {
  private readonly repo: IContractorRepository;

  constructor(repo: IContractorRepository) {
    this.repo = repo;
  }

  async execute(
    input: SaveContractItemDto,
  ): Promise<Result<ContractItemDto, DomainError>> {
    if (input.projectId === "" || input.contractorId === "" || input.boqItemId === "") {
      return err(
        new ValidationError("المشروع والمقاول والبند مطلوبة", { fields: "required" }),
      );
    }
    if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
      return err(
        new ValidationError("سعر البند يجب أن يكون أكبر من صفر", {
          unitPrice: "invalid",
        }),
      );
    }
    if (!Number.isFinite(input.maxQty) || input.maxQty <= 0) {
      return err(
        new ValidationError("الكمية التعاقدية يجب أن تكون أكبر من صفر", {
          maxQty: "invalid",
        }),
      );
    }
    return this.repo.saveContractItem(input);
  }
}

export class RemoveContractItem implements UseCase<{ id: string }, void> {
  private readonly repo: IContractorRepository;

  constructor(repo: IContractorRepository) {
    this.repo = repo;
  }

  async execute(input: { id: string }): Promise<Result<void, DomainError>> {
    return this.repo.removeContractItem(input.id);
  }
}

export class GetContractorBalances implements UseCase<
  { projectId: string | null },
  readonly ContractorBalanceDto[]
> {
  private readonly repo: IContractorRepository;

  constructor(repo: IContractorRepository) {
    this.repo = repo;
  }

  async execute(input: {
    projectId: string | null;
  }): Promise<Result<readonly ContractorBalanceDto[], DomainError>> {
    return this.repo.balances(input.projectId);
  }
}
