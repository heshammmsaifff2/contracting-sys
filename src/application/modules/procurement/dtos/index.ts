import type { MaterialRequestStatus } from "@core/modules/procurement/entities/MaterialRequest";
import type { SupplyOrderStatus } from "@core/modules/procurement/entities/SupplyOrder";
import type {
  PaymentPartyType,
  PaymentStatus,
} from "@core/modules/procurement/entities/PaymentRequest";

// ── الموردون ────────────────────────────────────────────────────────────
export interface SupplierDto {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  bankAccountCount: number;
}

export interface SaveSupplierDto {
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
}

export interface SupplierBankAccountDto {
  id: string;
  supplierId: string;
  bankName: string;
  accountNo: string | null;
  iban: string | null;
  isDefault: boolean;
}

// ── حدود المكتب الفني والمتوفّر بالموقع ─────────────────────────────────
export interface ProjectItemLimitDto {
  projectId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  maxQty: number;
  /** المتوفّر حاليًا بالموقع — يُطرح من الاحتياج عند الشراء. */
  siteQty: number;
}

export interface SaveProjectItemLimitDto {
  projectId: string;
  itemId: string;
  maxQty: number;
}

// ── طلبات الاحتياج ──────────────────────────────────────────────────────
export interface MaterialRequestLineDto {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  requestedQty: number;
  maxQty: number | null;
  prevRequestedQty: number;
  remainingBalance: number | null;
}

export interface MaterialRequestDto {
  id: string;
  no: number;
  projectId: string;
  projectName: string;
  status: MaterialRequestStatus;
  notes: string;
  lines: readonly MaterialRequestLineDto[];
}

export interface CreateMaterialRequestDto {
  projectId: string;
  notes: string;
  lines: readonly { itemId: string; requestedQty: number }[];
}

// ── طلبات الشراء والتسعير ───────────────────────────────────────────────
export interface PurchaseRequestLineDto {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  projectId: string;
  projectName: string;
  qty: number;
}

export interface PurchaseRequestDto {
  id: string;
  no: number;
  status: string;
  notes: string;
  lines: readonly PurchaseRequestLineDto[];
  quotedSupplierIds: readonly string[];
}

export interface PriceComparisonRowDto {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  unitPrice: number;
  requiredQty: number;
  lineTotal: number;
  /** 1 = الأرخص لهذا الصنف. */
  priceRank: number;
}

export interface SaveQuoteDto {
  purchaseRequestId: string;
  supplierId: string;
  lines: readonly { itemId: string; unitPrice: number }[];
}

// ── أوامر التوريد ───────────────────────────────────────────────────────
export interface SupplyOrderLineDto {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  projectId: string;
  projectName: string;
  qty: number;
  unitPrice: number;
}

export interface SupplyOrderDto {
  id: string;
  no: number;
  purchaseRequestId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: SupplyOrderStatus;
  notes: string;
  lines: readonly SupplyOrderLineDto[];
}

// ── الاستلام ────────────────────────────────────────────────────────────
export interface ReceiptRequestLineDto {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  qty: number;
  unitPrice: number;
}

export interface ReceiptRequestDto {
  id: string;
  no: number;
  supplyOrderId: string;
  supplyOrderNo: number;
  supplierName: string;
  projectId: string;
  projectName: string;
  status: "draft" | "received" | "cancelled";
  receivedAt: string | null;
  lines: readonly ReceiptRequestLineDto[];
  total: number;
}

// ── الدفع ───────────────────────────────────────────────────────────────
export interface PaymentRequestDto {
  id: string;
  no: number;
  sourceType: string;
  sourceId: string;
  partyType: PaymentPartyType;
  partyId: string;
  partyName: string;
  bankAccountId: string | null;
  bankName: string | null;
  accountNo: string | null;
  projectId: string | null;
  projectName: string | null;
  amount: number;
  bankFeeCompany: number;
  bankFeeClient: number;
  status: PaymentStatus;
  transferredAt: string | null;
}

export interface TransferPaymentDto {
  id: string;
  bankFeeCompany: number;
  bankFeeClient: number;
}

// ── سندات النقل ─────────────────────────────────────────────────────────
export interface TransferNoteLineDto {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  qty: number;
  unitCost: number;
}

export interface TransferNoteDto {
  id: string;
  no: number;
  fromProjectId: string;
  fromProjectName: string;
  toProjectId: string;
  toProjectName: string;
  status: "draft" | "approved" | "cancelled";
  notes: string;
  lines: readonly TransferNoteLineDto[];
  total: number;
}

export interface CreateTransferNoteDto {
  fromProjectId: string;
  toProjectId: string;
  notes: string;
  lines: readonly { itemId: string; qty: number; unitCost: number }[];
}
