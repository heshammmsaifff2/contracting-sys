/**
 * حارس المسارات. يمنع الوصول قبل تسجيل الدخول، ويتحقّق من الصلاحية
 * قبل عرض الشاشة. هذا حارس تجربة استخدام — البيانات نفسها محميّة بـ RLS.
 */
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@presentation/app/providers/auth-context";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { t } from "@i18n/index";

export interface ProtectedRouteProps {
  /**
   * الصلاحية المطلوبة — يكفي امتلاك إحداها إن مُرّرت عدّة.
   * `undefined` تعني شاشة متاحة لكل مستخدم نشط، وهي القيمة التي تعيدها
   * `screenPermission` لشاشات مثل الخدمة الذاتية.
   */
  permission?: string | readonly string[] | undefined;
}

export function ProtectedRoute({ permission }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!user.profile.isActive) {
    return <EmptyState title={t.auth.inactive} />;
  }

  if (permission !== undefined) {
    const keys = typeof permission === "string" ? [permission] : permission;
    if (!user.canAny(keys)) {
      return <EmptyState title={t.auth.noPermission} />;
    }
  }

  return <Outlet />;
}
