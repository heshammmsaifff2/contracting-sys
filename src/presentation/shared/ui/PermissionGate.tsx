import type { ReactNode } from "react";
import { useAuth } from "@presentation/app/providers/auth-context";

export interface PermissionGateProps {
  /** صلاحية واحدة أو عدّة صلاحيات (يكفي امتلاك إحداها). */
  permission: string | readonly string[];
  children: ReactNode;
  /** ما يُعرض عند غياب الصلاحية — لا شيء افتراضيًا. */
  fallback?: ReactNode;
}

/**
 * إظهار/إخفاء حسب الصلاحية — تحسين لتجربة الاستخدام فقط.
 * لا يُعتمد عليه كأمان: الجداول محميّة بـ RLS على الخادم.
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { user } = useAuth();

  const keys = typeof permission === "string" ? [permission] : permission;
  const allowed = user?.canAny(keys) ?? false;

  return <>{allowed ? children : fallback}</>;
}
