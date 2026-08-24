/**
 * Hooks الهوية — كلها تسحب use-cases من الـ container ولا تعرف Supabase.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUseCases } from "@presentation/app/providers/di-context";
import { unwrap } from "@presentation/shared/lib/query";
import type {
  CreateUserInput,
  UpdateProfileInput,
} from "@application/modules/identity/dtos";

export const PROFILES_KEY = ["profiles"] as const;
export const ROLES_KEY = ["roles"] as const;
export const PERMISSIONS_KEY = ["permissions"] as const;

export function useProfiles() {
  const { listProfiles } = useUseCases();
  return useQuery({
    queryKey: PROFILES_KEY,
    queryFn: async () => unwrap(await listProfiles.execute()),
  });
}

export function useRoles() {
  const { listRoles } = useUseCases();
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async () => unwrap(await listRoles.execute()),
  });
}

export function usePermissionsCatalog() {
  const { listPermissions } = useUseCases();
  return useQuery({
    queryKey: PERMISSIONS_KEY,
    queryFn: async () => unwrap(await listPermissions.execute()),
  });
}

export function useUpdateProfile() {
  const { updateProfile } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) =>
      unwrap(await updateProfile.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILES_KEY }),
  });
}

export function useSetProfileActive() {
  const { setProfileActive } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) =>
      unwrap(await setProfileActive.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILES_KEY }),
  });
}

export function useCreateUser() {
  const { createUser } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserInput) =>
      unwrap(await createUser.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILES_KEY }),
  });
}

export function useAssignRole() {
  const { assignRoleToUser } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; roleId: string }) =>
      unwrap(await assignRoleToUser.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILES_KEY }),
  });
}

export function useRemoveRole() {
  const { removeRoleFromUser } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; roleId: string }) =>
      unwrap(await removeRoleFromUser.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILES_KEY }),
  });
}

export function useSetRolePermissions() {
  const { setRolePermissions } = useUseCases();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { roleId: string; permissionIds: string[] }) =>
      unwrap(await setRolePermissions.execute(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ROLES_KEY }),
  });
}
