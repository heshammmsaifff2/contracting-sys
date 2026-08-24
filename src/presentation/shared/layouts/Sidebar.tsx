import { NavLink } from "react-router-dom";
import { cn } from "../lib/cn";
import { Badge } from "../ui/Badge";
import { NAV_ITEMS } from "./nav-items";
import { APP_NAME, CURRENT_PHASE } from "@config/app";
import { useAuth } from "@presentation/app/providers/auth-context";
import { t } from "@i18n/index";

/**
 * الشريط الجانبي — في RTL يقع على اليمين تلقائيًا.
 * الشاشات التي لا يملك المستخدم صلاحيتها تُخفى (تجربة استخدام)،
 * والشاشات التي لم تصل مرحلتها بعد تظهر معطّلة بشارة المرحلة.
 */
export function Sidebar() {
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.permission === undefined) return true;
    const keys =
      typeof item.permission === "string" ? [item.permission] : item.permission;
    return user?.canAny(keys) ?? false;
  });

  return (
    <aside className="border-border bg-surface hidden w-64 shrink-0 border-s md:block">
      <div className="border-border flex h-16 items-center gap-2 border-b px-5">
        <span className="bg-brand-600 grid size-8 place-items-center rounded-[var(--radius-control)] text-sm font-bold text-white">
          م
        </span>
        <span className="text-content truncate text-sm font-bold">{APP_NAME}</span>
      </div>

      <nav className="flex flex-col gap-1 p-3" aria-label={t.nav.dashboard}>
        {visibleItems.map((item) => {
          const isLocked = item.phase > CURRENT_PHASE;
          const Icon = item.icon;

          if (isLocked) {
            return (
              <span
                key={item.to}
                aria-disabled
                className="text-content-muted flex cursor-not-allowed items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm opacity-60"
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                <Badge tone="neutral">{`P${item.phase}`}</Badge>
              </span>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-content hover:bg-surface-sunken",
                )
              }
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
