import { useAuth } from "@presentation/app/providers/auth-context";

/**
 * فحص صلاحية لأغراض العرض فقط.
 * إخفاء زر لا يمنع الطلب — المنع الحقيقي في سياسات RLS.
 */
export function usePermission(permissionKey: string): boolean {
  const { user } = useAuth();
  return user?.can(permissionKey) ?? false;
}

export function useAnyPermission(permissionKeys: readonly string[]): boolean {
  const { user } = useAuth();
  return user?.canAny(permissionKeys) ?? false;
}

/** هل المستخدم معتمد على هذا المشروع؟ */
export function useIsAssignedToProject(projectId: string): boolean {
  const { user } = useAuth();
  return user?.isAssignedTo(projectId) ?? false;
}
