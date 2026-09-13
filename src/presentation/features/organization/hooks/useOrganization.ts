/**
 * Hooks الهيكل التنظيمي — تسحب use-cases من الـ container ولا تعرف Supabase.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type {
  SaveDepartmentInput,
  SaveJobInput,
} from "@application/modules/organization/dtos";
import { PROFILES_KEY } from "@presentation/features/identity/hooks/useIdentity";

const ORG_KEY = ["org"] as const;
export const DEPARTMENTS_KEY = [...ORG_KEY, "departments"] as const;

export function useDepartments() {
  const { listDepartments } = useUseCases();
  return useQuery({
    queryKey: DEPARTMENTS_KEY,
    queryFn: async () => unwrap(await listDepartments.execute()),
  });
}

export function useAttachmentAccess(departmentId: string | null) {
  const { listAttachmentAccess } = useUseCases();
  return useQuery({
    queryKey: [...ORG_KEY, "access", departmentId],
    enabled: departmentId !== null,
    queryFn: async () => unwrap(await listAttachmentAccess.execute(departmentId ?? "")),
  });
}

/**
 * الموظف يرث قسمه وتصنيفه وصلاحياته من وظيفته — فكل تعديل هنا يغيّر
 * صفوف الموظفين أيضًا، وقائمتهم تُعاد قراءتها معه.
 */
function useInvalidateOrganization() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ORG_KEY }),
      queryClient.invalidateQueries({ queryKey: PROFILES_KEY }),
    ]);
}

export function useSaveDepartment() {
  const { saveDepartment } = useUseCases();
  const invalidate = useInvalidateOrganization();
  return useMutation({
    mutationFn: async (input: SaveDepartmentInput) =>
      unwrap(await saveDepartment.execute(input)),
    onSuccess: invalidate,
  });
}

export function useDeleteDepartment() {
  const { deleteDepartment } = useUseCases();
  const invalidate = useInvalidateOrganization();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteDepartment.execute({ id })),
    onSuccess: invalidate,
  });
}

export function useSaveJob() {
  const { saveJob } = useUseCases();
  const invalidate = useInvalidateOrganization();
  return useMutation({
    mutationFn: async (input: SaveJobInput) => unwrap(await saveJob.execute(input)),
    onSuccess: invalidate,
  });
}

export function useDeleteJob() {
  const { deleteJob } = useUseCases();
  const invalidate = useInvalidateOrganization();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await deleteJob.execute({ id })),
    onSuccess: invalidate,
  });
}
