/**
 * Hooks المستندات المالية: المقاولون والمستخلصات والعهد والدفعات والضمانات.
 * كل اعتماد يُبطل دفتر اليومية أيضًا لأن القيد يُسجَّل معه آليًا.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import { JOURNAL_KEY } from "@presentation/features/accounting/hooks/useAccounting";
import { NOTIFICATIONS_KEY } from "@presentation/features/notifications/hooks/useNotifications";
import type { OcrProgress } from "@application/shared/ports/ocr-reader";
import type {
  CustodyFilter,
  ExtractFilter,
  SaveAdvanceDto,
  SaveContractItemDto,
  SaveContractorDto,
  SaveCustodyDto,
  SaveDeductionTypeDto,
  SaveGuaranteeDto,
  SaveInvoiceDto,
  SetExtractLineQtyDto,
} from "@application/modules/accounting/dtos/documents";

export const CONTRACTORS_KEY = ["contractors"] as const;
export const CONTRACT_ITEMS_KEY = ["contract-items"] as const;
export const BALANCES_KEY = ["contractor-balances"] as const;
export const EXTRACTS_KEY = ["extracts"] as const;
export const CUSTODIES_KEY = ["custodies"] as const;
export const ADVANCES_KEY = ["advances"] as const;
export const GUARANTEES_KEY = ["guarantees"] as const;
export const DEDUCTIONS_KEY = ["deduction-types"] as const;

// ── المقاولون وبنود التعاقد ─────────────────────────────────────────────
export function useContractorSearch(query: string) {
  const { searchContractors } = useUseCases();
  return useQuery({
    queryKey: [...CONTRACTORS_KEY, query],
    queryFn: async () => unwrap(await searchContractors.execute({ query })),
    placeholderData: (previous) => previous,
  });
}

export function useSaveContractor() {
  const { saveContractor } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveContractorDto) =>
      unwrap(await saveContractor.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACTORS_KEY }),
  });
}

export function useContractItems(
  contractorId: string | null,
  projectId: string | null,
) {
  const { listContractItems } = useUseCases();
  return useQuery({
    queryKey: [...CONTRACT_ITEMS_KEY, contractorId ?? "", projectId ?? "all"],
    queryFn: async () =>
      unwrap(
        await listContractItems.execute({
          contractorId: contractorId ?? "",
          projectId,
        }),
      ),
    enabled: contractorId !== null,
  });
}

export function useSaveContractItem() {
  const { saveContractItem } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveContractItemDto) =>
      unwrap(await saveContractItem.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_ITEMS_KEY }),
  });
}

export function useRemoveContractItem() {
  const { removeContractItem } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeContractItem.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONTRACT_ITEMS_KEY }),
  });
}

export function useContractorBalances(projectId: string | null) {
  const { getContractorBalances } = useUseCases();
  return useQuery({
    queryKey: [...BALANCES_KEY, projectId ?? "all"],
    queryFn: async () => unwrap(await getContractorBalances.execute({ projectId })),
  });
}

// ── المستخلصات ──────────────────────────────────────────────────────────
export function useExtracts(filter: ExtractFilter) {
  const { listExtracts } = useUseCases();
  return useQuery({
    queryKey: [
      ...EXTRACTS_KEY,
      filter.projectId ?? "all",
      filter.contractorId ?? "all",
      filter.status ?? "all",
    ],
    queryFn: async () => unwrap(await listExtracts.execute(filter)),
  });
}

export function useGenerateExtract() {
  const { generateExtract } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      contractorId: string;
      extractDate: string;
    }) => unwrap(await generateExtract.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXTRACTS_KEY }),
  });
}

export function useSetExtractLineQty() {
  const { setExtractLineQty } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetExtractLineQtyDto) =>
      unwrap(await setExtractLineQty.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXTRACTS_KEY }),
  });
}

export function useSetExtractFinal() {
  const { setExtractFinal } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; isFinal: boolean }) =>
      unwrap(await setExtractFinal.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXTRACTS_KEY }),
  });
}

export function useApproveExtract() {
  const { approveExtract } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await approveExtract.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: EXTRACTS_KEY });
      await queryClient.invalidateQueries({ queryKey: JOURNAL_KEY });
      await queryClient.invalidateQueries({ queryKey: BALANCES_KEY });
      await queryClient.invalidateQueries({ queryKey: ["payment-requests"] });
    },
  });
}

// ── العهد ───────────────────────────────────────────────────────────────
export function useCustodies(filter: CustodyFilter) {
  const { listCustodies } = useUseCases();
  return useQuery({
    queryKey: [
      ...CUSTODIES_KEY,
      filter.projectId ?? "all",
      filter.holderId ?? "all",
      filter.includeReturnedBoxes === true ? "with-returned" : "plain",
    ],
    queryFn: async () => unwrap(await listCustodies.execute(filter)),
  });
}

export function useSaveCustody() {
  const { saveCustody } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveCustodyDto) =>
      unwrap(await saveCustody.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTODIES_KEY }),
  });
}

export function useSaveInvoice() {
  const { saveCustodyInvoice } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveInvoiceDto) =>
      unwrap(await saveCustodyInvoice.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CUSTODIES_KEY });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useRemoveInvoice() {
  const { removeCustodyInvoice } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await removeCustodyInvoice.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTODIES_KEY }),
  });
}

/** فحص صريح: يثبّت علامات التكرار على الخادم ليراها المراجع. */
export function useRescanDuplicates() {
  const { rescanCustodyDuplicates } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (custodyId: string) =>
      unwrap(await rescanCustodyDuplicates.execute({ custodyId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CUSTODIES_KEY });
      await queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useReviewDuplicate() {
  const { reviewDuplicateInvoice } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) =>
      unwrap(await reviewDuplicateInvoice.execute({ invoiceId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTODIES_KEY }),
  });
}

export function useReturnInvoice() {
  const { returnCustodyInvoice } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { invoiceId: string; reason: string }) =>
      unwrap(await returnCustodyInvoice.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTODIES_KEY }),
  });
}

export function useApproveCustody() {
  const { approveCustody } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await approveCustody.execute({ id })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CUSTODIES_KEY });
      await queryClient.invalidateQueries({ queryKey: JOURNAL_KEY });
    },
  });
}

/** المسح الضوئي في المتصفّح — لا يمرّ بـ react-query لأنه ليس بيانات خادم. */
export function useInvoiceScanner() {
  const { readInvoiceImage } = useUseCases();

  return useMutation({
    mutationFn: async (input: {
      file: File;
      onProgress?: (progress: OcrProgress) => void;
    }) =>
      unwrap(
        await readInvoiceImage.execute({
          file: input.file,
          ...(input.onProgress === undefined ? {} : { onProgress: input.onProgress }),
        }),
      ),
  });
}

// ── الدفعات المقدّمة ────────────────────────────────────────────────────
export function useAdvances(projectId: string | null) {
  const { listAdvances } = useUseCases();
  return useQuery({
    queryKey: [...ADVANCES_KEY, projectId ?? "all"],
    queryFn: async () => unwrap(await listAdvances.execute({ projectId })),
  });
}

export function useSaveAdvance() {
  const { saveAdvance } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveAdvanceDto) =>
      unwrap(await saveAdvance.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADVANCES_KEY }),
  });
}

export function useApproveAdvance(projectId: string | null) {
  const { approveAdvance } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await approveAdvance.execute({ id, projectId })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADVANCES_KEY });
      await queryClient.invalidateQueries({ queryKey: JOURNAL_KEY });
      await queryClient.invalidateQueries({ queryKey: ["payment-requests"] });
    },
  });
}

// ── الضمانات ────────────────────────────────────────────────────────────
export function useGuarantees(projectId: string | null) {
  const { listGuarantees } = useUseCases();
  return useQuery({
    queryKey: [...GUARANTEES_KEY, projectId ?? "all"],
    queryFn: async () => unwrap(await listGuarantees.execute({ projectId })),
  });
}

export function useSaveGuarantee() {
  const { saveGuarantee } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveGuaranteeDto) =>
      unwrap(await saveGuarantee.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GUARANTEES_KEY }),
  });
}

export function useRemoveGuarantee() {
  const { removeGuarantee } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await removeGuarantee.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GUARANTEES_KEY }),
  });
}

// ── الاستقطاعات ─────────────────────────────────────────────────────────
export function useDeductionTypes() {
  const { listDeductionTypes } = useUseCases();
  return useQuery({
    queryKey: DEDUCTIONS_KEY,
    queryFn: async () => unwrap(await listDeductionTypes.execute()),
  });
}

export function useSaveDeductionType() {
  const { saveDeductionType } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveDeductionTypeDto) =>
      unwrap(await saveDeductionType.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEDUCTIONS_KEY }),
  });
}
