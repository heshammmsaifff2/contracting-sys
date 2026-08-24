/**
 * يعرض صورة المستخدم الحالي كما بناها use-case GetCurrentUser:
 * ملفه وصلاحياته والمشاريع المعتمد عليها.
 * الصلاحيات هنا مقروءة من دالة current_permissions() نفسها التي تستند إليها
 * سياسات RLS، فما يظهر هنا هو ما يسمح به الخادم فعليًا — لا تخمين في الواجهة.
 */
import { useAuth } from "@presentation/app/providers/auth-context";
import { Badge } from "@presentation/shared/ui/Badge";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { t } from "@i18n/index";

const TYPE_LABELS: Record<string, string> = {
  admin: t.users.typeAdmin,
  engineer: t.users.typeEngineer,
  supervisor: t.users.typeSupervisor,
};

export function IdentityCheck() {
  const { user } = useAuth();

  if (user === null) {
    return <EmptyState title={t.auth.noProfile} />;
  }

  const permissions = [...user.permissions].sort();

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
          <dt className="text-content-muted text-xs">{t.users.name}</dt>
          <dd className="text-content mt-0.5 text-sm font-medium">
            {user.profile.fullName}
          </dd>
        </div>
        <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
          <dt className="text-content-muted text-xs">{t.users.type}</dt>
          <dd className="text-content mt-0.5 text-sm font-medium">
            {TYPE_LABELS[user.profile.employeeType]}
          </dd>
        </div>
        <div className="bg-surface-sunken rounded-[var(--radius-control)] p-3">
          <dt className="text-content-muted text-xs">{t.projects.title}</dt>
          <dd className="tabular text-content mt-0.5 text-sm font-medium">
            {user.seesAllProjects
              ? t.common.all
              : formatNumber(user.assignedProjectIds.length)}
          </dd>
        </div>
      </dl>

      <div>
        <h3 className="text-content mb-2 text-sm font-bold">
          {t.roles.permissions} ({formatNumber(permissions.length)})
        </h3>
        {permissions.length === 0 ? (
          <p className="text-content-muted text-sm">{t.users.noRoles}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {permissions.map((key) => (
              <Badge key={key} tone="brand">
                <span className="font-mono text-[11px]">{key}</span>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
