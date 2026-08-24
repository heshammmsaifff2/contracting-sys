/**
 * DTOs المستندات المالية: المقاولون والمستخلصات والعهد والدفعات والضمانات.
 * منفصلة عن dtos/index.ts (شجرة الحسابات ودفتر اليومية) لأنها وحدة أكبر.
 */
import type { ExtractStatus } from "@core/modules/accounting/entities/Extract";
import type { CustodyStatus } from "@core/modules/accounting/entities/Custody";
import type {
  GuaranteeKind,
  GuaranteeStatus,
} from "@core/modules/accounting/entities/Guarantee";

// ── المقاولون ───────────────────────────────────────────────────────────
export interface ContractorDto {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  accountNo: string | null;
  iban: string | null;
  isActive: boolean;
}

export interface SaveContractorDto {
  id: string | null;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  accountNo: string | null;
  iban: string | null;
  isActive: boolean;
}

// ── بنود التعاقد ────────────────────────────────────────────────────────
export interface ContractItemDto {
  id: string;
  projectId: string;
  projectName: string;
  contractorId: string;
  boqItemId: string;
  boqCode: string;
  boqName: string;
  boqUnit: string;
  unitPrice: number;
  maxQty: number;
  /** المنفَّذ في المستخلصات المعتمدة — يُحسب على الخادم. */
  executedQty: number;
  notes: string;
}

export interface SaveContractItemDto {
  id: string | null;
  projectId: string;
  contractorId: string;
  boqItemId: string;
  unitPrice: number;
  maxQty: number;
  notes: string;
}

// ── المستخلصات ──────────────────────────────────────────────────────────
export interface ExtractLineDto {
  id: string;
  boqItemId: string;
  boqCode: string;
  boqName: string;
  boqUnit: string;
  unitPrice: number;
  maxQty: number;
  prevQty: number;
  currentQty: number;
  /** محسوبة للعرض: (الحد − السابق − الحالي) و(الكمية × السعر). */
  remainingQty: number;
  amount: number;
}

export interface ExtractDeductionDto {
  id: string;
  key: string;
  name: string;
  rate: number;
  accountCode: string;
  amount: number;
}

export interface ExtractDto {
  id: string;
  no: number;
  seq: number;
  projectId: string;
  projectName: string;
  contractorId: string;
  contractorCode: string;
  contractorName: string;
  extractDate: string;
  status: ExtractStatus;
  isFinal: boolean;
  grossAmount: number;
  deductionsAmount: number;
  retentionReleased: number;
  netAmount: number;
  notes: string;
  approvedAt: string | null;
  lines: readonly ExtractLineDto[];
  deductions: readonly ExtractDeductionDto[];
}

export interface GenerateExtractDto {
  projectId: string;
  contractorId: string;
  extractDate: string;
}

export interface SetExtractLineQtyDto {
  lineId: string;
  extractId: string;
  currentQty: number;
  maxQty: number;
  prevQty: number;
}

export interface ExtractFilter {
  projectId?: string | null;
  contractorId?: string | null;
  status?: ExtractStatus | null;
}

// ── العهد وفواتيرها ─────────────────────────────────────────────────────
export interface CustodyInvoiceDto {
  id: string;
  custodyId: string;
  seq: number;
  supplierId: string | null;
  supplierName: string;
  supplierSeqNo: string;
  invoiceNo: string;
  invoiceDate: string;
  amount: number;
  itemId: string | null;
  itemName: string;
  imagePublicId: string | null;
  imageUrl: string | null;
  ocrText: string;
  isDuplicate: boolean;
  duplicateOf: string | null;
  duplicateReviewed: boolean;
  isReturned: boolean;
  returnReason: string;
  note: string;
}

export interface CustodyDto {
  id: string;
  serial: number;
  holderId: string;
  holderName: string;
  projectId: string;
  projectName: string;
  status: CustodyStatus;
  isReturnedBox: boolean;
  openedAt: string;
  closedAt: string | null;
  totalAmount: number;
  notes: string;
  invoices: readonly CustodyInvoiceDto[];
}

export interface SaveCustodyDto {
  id: string | null;
  holderId: string;
  projectId: string;
  openedAt: string;
  notes: string;
}

export interface SaveInvoiceDto {
  id: string | null;
  custodyId: string;
  supplierId: string | null;
  supplierSeqNo: string;
  invoiceNo: string;
  invoiceDate: string;
  amount: number;
  itemId: string | null;
  imagePublicId: string | null;
  imageUrl: string | null;
  ocrText: string;
  note: string;
}

export interface CustodyFilter {
  projectId?: string | null;
  holderId?: string | null;
  includeReturnedBoxes?: boolean;
}

// ── الدفعات المقدّمة ────────────────────────────────────────────────────
export type AdvanceStatus = "draft" | "approved" | "paid" | "cancelled";

export interface AdvancePaymentDto {
  id: string;
  no: number;
  contractorId: string;
  contractorName: string;
  projectId: string;
  projectName: string;
  boqItemId: string | null;
  boqName: string;
  amount: number;
  status: AdvanceStatus;
  notes: string;
  approvedAt: string | null;
}

export interface SaveAdvanceDto {
  id: string | null;
  contractorId: string;
  projectId: string;
  boqItemId: string | null;
  amount: number;
  notes: string;
}

// ── خطابات الضمان ───────────────────────────────────────────────────────
export interface GuaranteeDto {
  id: string;
  projectId: string;
  projectName: string;
  contractorId: string | null;
  contractorName: string;
  kind: GuaranteeKind;
  referenceNo: string;
  bankName: string;
  amount: number;
  issuedAt: string;
  expiresAt: string;
  status: GuaranteeStatus;
  note: string;
  /** من العرض: الأيام المتبقّية وهل انتهى. */
  daysLeft: number | null;
}

export interface SaveGuaranteeDto {
  id: string | null;
  projectId: string;
  contractorId: string | null;
  kind: GuaranteeKind;
  referenceNo: string;
  bankName: string;
  amount: number;
  issuedAt: string;
  expiresAt: string;
  status: GuaranteeStatus;
  note: string;
}

// ── الاستقطاعات (إعداد صاحب البرنامج) ───────────────────────────────────
export interface DeductionTypeDto {
  id: string;
  key: string;
  name: string;
  rate: number;
  appliesTo: "extract" | "advance";
  accountCode: string;
  accountName: string;
  isActive: boolean;
  sortOrder: number;
  description: string;
}

export interface SaveDeductionTypeDto {
  id: string | null;
  key: string;
  name: string;
  rate: number;
  appliesTo: "extract" | "advance";
  accountCode: string;
  isActive: boolean;
  sortOrder: number;
  description: string;
}

// ── تقرير مديونية المقاولين ─────────────────────────────────────────────
export interface ContractorBalanceDto {
  contractorId: string;
  contractorCode: string;
  contractorName: string;
  projectId: string;
  projectName: string;
  extractsCount: number;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
  paidTotal: number;
  /** المستحقّ غير المصروف. */
  outstanding: number;
}
