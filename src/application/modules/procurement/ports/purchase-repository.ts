import type { DomainError } from "@core/shared/errors/domain-error";
import type { Result } from "@core/shared/result";
import type {
  PriceComparisonRowDto,
  PurchaseRequestDto,
  SaveQuoteDto,
  SupplyOrderDto,
} from "../dtos";

export interface IPurchaseRepository {
  listPurchaseRequests(): Promise<Result<readonly PurchaseRequestDto[], DomainError>>;
  /** مصفوفة المقارنة لطلب شراء — مرتّبة بالأرخص لكل صنف. */
  comparePrices(
    purchaseRequestId: string,
  ): Promise<Result<readonly PriceComparisonRowDto[], DomainError>>;
  saveQuote(input: SaveQuoteDto): Promise<Result<void, DomainError>>;
  listSupplyOrders(): Promise<Result<readonly SupplyOrderDto[], DomainError>>;
  setSupplyOrderStatus(id: string, status: string): Promise<Result<void, DomainError>>;
}
