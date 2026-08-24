/**
 * منافذ المستندات المالية.
 * كل عملية تغيّر حالة مستند (توليد، اعتماد، ارتجاع) تمرّ بدالة خادم
 * واحدة — لا تُبنى حالة مالية في المتصفّح.
 */
import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  AdvancePaymentDto,
  ContractItemDto,
  ContractorBalanceDto,
  ContractorDto,
  CustodyDto,
  CustodyFilter,
  DeductionTypeDto,
  ExtractDto,
  ExtractFilter,
  GenerateExtractDto,
  GuaranteeDto,
  SaveAdvanceDto,
  SaveContractItemDto,
  SaveContractorDto,
  SaveCustodyDto,
  SaveDeductionTypeDto,
  SaveGuaranteeDto,
  SaveInvoiceDto,
  SetExtractLineQtyDto,
} from "../dtos/documents";

export interface IContractorRepository {
  search(query: string): Promise<Result<readonly ContractorDto[], DomainError>>;
  save(input: SaveContractorDto): Promise<Result<ContractorDto, DomainError>>;

  listContractItems(
    contractorId: string,
    projectId: string | null,
  ): Promise<Result<readonly ContractItemDto[], DomainError>>;
  saveContractItem(
    input: SaveContractItemDto,
  ): Promise<Result<ContractItemDto, DomainError>>;
  removeContractItem(id: string): Promise<Result<void, DomainError>>;

  balances(
    projectId: string | null,
  ): Promise<Result<readonly ContractorBalanceDto[], DomainError>>;
}

export interface IExtractRepository {
  list(filter: ExtractFilter): Promise<Result<readonly ExtractDto[], DomainError>>;
  findById(id: string): Promise<Result<ExtractDto | null, DomainError>>;
  /** التوليد على الخادم: الرقم التالي وأسطر العقد والكميات السابقة. */
  generate(input: GenerateExtractDto): Promise<Result<{ id: string }, DomainError>>;
  setLineQty(input: SetExtractLineQtyDto): Promise<Result<void, DomainError>>;
  setFinal(id: string, isFinal: boolean): Promise<Result<void, DomainError>>;
  setNotes(id: string, notes: string): Promise<Result<void, DomainError>>;
  approve(id: string): Promise<Result<void, DomainError>>;
}

export interface ICustodyRepository {
  list(filter: CustodyFilter): Promise<Result<readonly CustodyDto[], DomainError>>;
  findById(id: string): Promise<Result<CustodyDto | null, DomainError>>;
  save(input: SaveCustodyDto): Promise<Result<CustodyDto, DomainError>>;

  saveInvoice(input: SaveInvoiceDto): Promise<Result<void, DomainError>>;
  removeInvoice(id: string): Promise<Result<void, DomainError>>;
  /** إعادة مسح التكرار على الخادم — يثبّت العلامات ليراها المراجع. */
  rescanDuplicates(custodyId: string): Promise<Result<number, DomainError>>;
  markDuplicateReviewed(invoiceId: string): Promise<Result<void, DomainError>>;
  returnInvoice(invoiceId: string, reason: string): Promise<Result<void, DomainError>>;
  approve(id: string): Promise<Result<void, DomainError>>;
}

export interface IAdvanceRepository {
  list(
    projectId: string | null,
  ): Promise<Result<readonly AdvancePaymentDto[], DomainError>>;
  save(input: SaveAdvanceDto): Promise<Result<AdvancePaymentDto, DomainError>>;
  approve(id: string): Promise<Result<void, DomainError>>;
}

export interface IGuaranteeRepository {
  list(projectId: string | null): Promise<Result<readonly GuaranteeDto[], DomainError>>;
  save(input: SaveGuaranteeDto): Promise<Result<GuaranteeDto, DomainError>>;
  remove(id: string): Promise<Result<void, DomainError>>;
}

export interface IDeductionRepository {
  list(): Promise<Result<readonly DeductionTypeDto[], DomainError>>;
  save(input: SaveDeductionTypeDto): Promise<Result<DeductionTypeDto, DomainError>>;
}
