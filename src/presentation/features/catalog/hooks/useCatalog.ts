/**
 * Hooks الأصناف والبنود. البحث يمرّ عبر use-case يستدعي دالة Postgres،
 * فلا يوجد أي منطق بحث في المتصفّح.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type {
  CreateBoqItemDto,
  CreateItemDto,
  SetBoqComponentsDto,
  UpdateBoqItemDto,
  UpdateItemDto,
} from "@application/modules/catalog/dtos";

export const itemsKey = (query: string) => ["items", query] as const;
export const boqKey = (query: string) => ["boq-items", query] as const;
export const boqComponentsKey = (boqItemId: string) =>
  ["boq-components", boqItemId] as const;

export function useItemSearch(query: string) {
  const { searchItems } = useUseCases();

  return useQuery({
    queryKey: itemsKey(query),
    queryFn: async () => unwrap(await searchItems.execute({ query })),
    // نُبقي النتيجة السابقة ظاهرة أثناء الكتابة فلا يومض الجدول
    placeholderData: (previous) => previous,
  });
}

export function useCreateItem() {
  const { createItem } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateItemDto) => unwrap(await createItem.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });
}

export function useUpdateItem() {
  const { updateItem } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateItemDto) => unwrap(await updateItem.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });
}

export function useDeleteItem() {
  const { deleteItem } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteItem.execute({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });
}

export function useBoqSearch(query: string) {
  const { searchBoqItems } = useUseCases();

  return useQuery({
    queryKey: boqKey(query),
    queryFn: async () => unwrap(await searchBoqItems.execute({ query })),
    placeholderData: (previous) => previous,
  });
}

export function useCreateBoqItem() {
  const { createBoqItem } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBoqItemDto) =>
      unwrap(await createBoqItem.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boq-items"] }),
  });
}

export function useUpdateBoqItem() {
  const { updateBoqItem } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateBoqItemDto) =>
      unwrap(await updateBoqItem.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["boq-items"] }),
  });
}

export function useBoqComponents(boqItemId: string | null) {
  const { listBoqComponents } = useUseCases();

  return useQuery({
    queryKey: boqComponentsKey(boqItemId ?? ""),
    queryFn: async () =>
      unwrap(await listBoqComponents.execute({ boqItemId: boqItemId ?? "" })),
    enabled: boqItemId !== null,
  });
}

export function useSetBoqComponents(boqItemId: string) {
  const { setBoqComponents } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetBoqComponentsDto) =>
      unwrap(await setBoqComponents.execute(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: boqComponentsKey(boqItemId) });
      await queryClient.invalidateQueries({ queryKey: ["boq-items"] });
    },
  });
}
