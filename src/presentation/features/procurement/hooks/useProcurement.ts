/**
 * Hooks المشتريات. كل عملية توليد تنادي use-case يستدعي دالة Postgres،
 * فلا يُعاد بناء أي مستند في المتصفّح.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type {
  CreateMaterialRequestDto,
  CreateTransferNoteDto,
  SaveQuoteDto,
  SaveSupplierDto,
  SupplierBankAccountDto,
  TransferPaymentDto,
} from "@application/modules/procurement/dtos";
import { JOURNAL_KEY } from "@presentation/features/accounting/hooks/useAccounting";

export const SUPPLIERS_KEY = ["suppliers"] as const;
export const MATERIAL_REQUESTS_KEY = ["material-requests"] as const;
export const PURCHASE_REQUESTS_KEY = ["purchase-requests"] as const;
export const SUPPLY_ORDERS_KEY = ["supply-orders"] as const;
export const RECEIPTS_KEY = ["receipt-requests"] as const;
export const PAYMENTS_KEY = ["payment-requests"] as const;
export const TRANSFER_NOTES_KEY = ["transfer-notes"] as const;

// ── الموردون ────────────────────────────────────────────────────────────
export function useSupplierSearch(query: string) {
  const { searchSuppliers } = useUseCases();
  return useQuery({
    queryKey: [...SUPPLIERS_KEY, query],
    queryFn: async () => unwrap(await searchSuppliers.execute({ query })),
    placeholderData: (previous) => previous,
  });
}

export function useSaveSupplier() {
  const { saveSupplier } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveSupplierDto & { id: string | null }) =>
      unwrap(await saveSupplier.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY }),
  });
}

export function useSupplierBankAccounts(supplierId: string | null) {
  const { listSupplierBankAccounts } = useUseCases();
  return useQuery({
    queryKey: ["supplier-banks", supplierId ?? ""],
    queryFn: async () =>
      unwrap(await listSupplierBankAccounts.execute({ supplierId: supplierId ?? "" })),
    enabled: supplierId !== null,
  });
}

export function useAddSupplierBankAccount(supplierId: string) {
  const { addSupplierBankAccount } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<SupplierBankAccountDto, "id">) =>
      unwrap(await addSupplierBankAccount.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["supplier-banks", supplierId] });
      await queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY });
    },
  });
}

export function useRemoveSupplierBankAccount(supplierId: string) {
  const { removeSupplierBankAccount } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await removeSupplierBankAccount.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["supplier-banks", supplierId] });
      await queryClient.invalidateQueries({ queryKey: SUPPLIERS_KEY });
    },
  });
}

// ── حدود المكتب الفني ───────────────────────────────────────────────────
export function useProjectItemLimits(projectId: string | null) {
  const { listProjectItemLimits } = useUseCases();
  return useQuery({
    queryKey: ["project-item-limits", projectId ?? ""],
    queryFn: async () =>
      unwrap(await listProjectItemLimits.execute({ projectId: projectId ?? "" })),
    enabled: projectId !== null,
  });
}

export function useSaveProjectItemLimit(projectId: string) {
  const { saveProjectItemLimit } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { projectId: string; itemId: string; maxQty: number }) =>
      unwrap(await saveProjectItemLimit.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["project-item-limits", projectId] }),
  });
}

export function useSaveSiteStock(projectId: string) {
  const { saveSiteStock } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      itemId: string;
      quantity: number;
    }) => unwrap(await saveSiteStock.execute(input)),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["project-item-limits", projectId] }),
  });
}

// ── طلبات الاحتياج ──────────────────────────────────────────────────────
export function useMaterialRequests() {
  const { listMaterialRequests } = useUseCases();
  return useQuery({
    queryKey: MATERIAL_REQUESTS_KEY,
    queryFn: async () => unwrap(await listMaterialRequests.execute()),
  });
}

export function useCreateMaterialRequest() {
  const { createMaterialRequest } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMaterialRequestDto) =>
      unwrap(await createMaterialRequest.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MATERIAL_REQUESTS_KEY }),
  });
}

export function useApproveMaterialRequest() {
  const { approveMaterialRequest } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await approveMaterialRequest.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MATERIAL_REQUESTS_KEY }),
  });
}

export function useRejectMaterialRequest() {
  const { rejectMaterialRequest } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await rejectMaterialRequest.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MATERIAL_REQUESTS_KEY }),
  });
}

// ── الشراء والمقارنة ────────────────────────────────────────────────────
export function useGeneratePurchaseRequest() {
  const { generatePurchaseRequest } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (materialRequestIds: readonly string[]) =>
      unwrap(await generatePurchaseRequest.execute({ materialRequestIds })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MATERIAL_REQUESTS_KEY });
      await queryClient.invalidateQueries({ queryKey: PURCHASE_REQUESTS_KEY });
    },
  });
}

export function usePurchaseRequests() {
  const { listPurchaseRequests } = useUseCases();
  return useQuery({
    queryKey: PURCHASE_REQUESTS_KEY,
    queryFn: async () => unwrap(await listPurchaseRequests.execute()),
  });
}

export function usePriceComparison(purchaseRequestId: string | null) {
  const { comparePrices } = useUseCases();
  return useQuery({
    queryKey: ["price-comparison", purchaseRequestId ?? ""],
    queryFn: async () =>
      unwrap(
        await comparePrices.execute({ purchaseRequestId: purchaseRequestId ?? "" }),
      ),
    enabled: purchaseRequestId !== null,
  });
}

export function useSaveQuote(purchaseRequestId: string) {
  const { saveSupplierQuote } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveQuoteDto) =>
      unwrap(await saveSupplierQuote.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["price-comparison", purchaseRequestId],
      });
      await queryClient.invalidateQueries({ queryKey: PURCHASE_REQUESTS_KEY });
    },
  });
}

// ── أوامر التوريد ───────────────────────────────────────────────────────
export function useGenerateSupplyOrder() {
  const { generateSupplyOrder } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { purchaseRequestId: string; supplierId: string }) =>
      unwrap(await generateSupplyOrder.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PURCHASE_REQUESTS_KEY });
      await queryClient.invalidateQueries({ queryKey: SUPPLY_ORDERS_KEY });
    },
  });
}

export function useSupplyOrders() {
  const { listSupplyOrders } = useUseCases();
  return useQuery({
    queryKey: SUPPLY_ORDERS_KEY,
    queryFn: async () => unwrap(await listSupplyOrders.execute()),
  });
}

export function useApproveSupplyOrder() {
  const { approveSupplyOrder } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await approveSupplyOrder.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUPPLY_ORDERS_KEY }),
  });
}

export function useGenerateReceiptRequests() {
  const { generateReceiptRequests } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplyOrderId: string) =>
      unwrap(await generateReceiptRequests.execute({ supplyOrderId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: RECEIPTS_KEY });
      await queryClient.invalidateQueries({ queryKey: SUPPLY_ORDERS_KEY });
    },
  });
}

export function useGeneratePaymentRequest() {
  const { generatePaymentRequest } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplyOrderId: string) =>
      unwrap(await generatePaymentRequest.execute({ supplyOrderId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  });
}

// ── الاستلام — يُطلق قيدًا آليًا ─────────────────────────────────────────
export function useReceiptRequests() {
  const { listReceiptRequests } = useUseCases();
  return useQuery({
    queryKey: RECEIPTS_KEY,
    queryFn: async () => unwrap(await listReceiptRequests.execute()),
  });
}

export function useConfirmReceipt() {
  const { confirmReceipt } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receiptRequestId: string) =>
      unwrap(await confirmReceipt.execute({ receiptRequestId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: RECEIPTS_KEY });
      await queryClient.invalidateQueries({ queryKey: SUPPLY_ORDERS_KEY });
      // القيد الآلي يظهر فورًا في دفتر اليومية
      await queryClient.invalidateQueries({ queryKey: JOURNAL_KEY });
    },
  });
}

// ── الدفع — يُطلق قيدًا آليًا ────────────────────────────────────────────
export function usePaymentRequests() {
  const { listPaymentRequests } = useUseCases();
  return useQuery({
    queryKey: PAYMENTS_KEY,
    queryFn: async () => unwrap(await listPaymentRequests.execute()),
  });
}

export function useTransferPayment() {
  const { transferPayment } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TransferPaymentDto) =>
      unwrap(await transferPayment.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
      await queryClient.invalidateQueries({ queryKey: JOURNAL_KEY });
    },
  });
}

// ── سندات النقل — الاعتماد يُطلق قيدًا آليًا ─────────────────────────────
export function useTransferNotes() {
  const { listTransferNotes } = useUseCases();
  return useQuery({
    queryKey: TRANSFER_NOTES_KEY,
    queryFn: async () => unwrap(await listTransferNotes.execute()),
  });
}

export function useCreateTransferNote() {
  const { createTransferNote } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTransferNoteDto) =>
      unwrap(await createTransferNote.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSFER_NOTES_KEY }),
  });
}

export function useApproveTransferNote() {
  const { approveTransferNote } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await approveTransferNote.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TRANSFER_NOTES_KEY });
      await queryClient.invalidateQueries({ queryKey: JOURNAL_KEY });
    },
  });
}
