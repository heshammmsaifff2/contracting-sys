import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Search, X } from "lucide-react";
import { cn } from "../lib/cn";
import { Badge } from "../ui/Badge";
import { NAV_GROUPS, type NavItem } from "./nav-items";
import { APP_NAME, CURRENT_PHASE } from "@config/app";
import { useAuth } from "@presentation/app/providers/auth-context";
import { t } from "@i18n/index";

/**
 * الشريط الجانبي — في RTL يقع على اليمين تلقائيًا.
 *
 * ثلاثة قرارات تحلّ مشكلة قائمة من أربعين شاشة:
 * ١) **مجموعات بعناوين** حسب وحدات المواصفات، فيعرف المستخدم أين يبحث.
 * ٢) **تمرير داخلي** للقائمة وحدها، فلا تختفي آخر الشاشات تحت حافة النافذة.
 * ٣) **بحث فوري** يصل إلى أي شاشة بحرفين، أسرع من التنقّل بالعين.
 *
 * الشاشات التي لا يملك المستخدم صلاحيتها تُخفى (تجربة استخدام لا أمان).
 */
export interface SidebarProps {
  /** يُستدعى بعد اختيار شاشة — يُغلق الدرج على الجوال. */
  onNavigate?: (() => void) | undefined;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const needle = query.trim();

    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.permission !== undefined) {
          const keys =
            typeof item.permission === "string" ? [item.permission] : item.permission;
          if (!(user?.canAny(keys) ?? false)) return false;
        }
        return needle === "" || item.label.includes(needle);
      }),
    })).filter((group) => group.items.length > 0);
  }, [user, query]);

  return (
    <div className="bg-surface flex h-full min-h-0 w-64 shrink-0 flex-col">
      <div className="border-border flex h-16 shrink-0 items-center gap-2 border-b px-5">
        <span className="bg-brand-600 grid size-8 place-items-center rounded-[var(--radius-control)] text-sm font-bold text-white">
          م
        </span>
        <span className="text-content truncate text-sm font-bold">{APP_NAME}</span>
      </div>

      <div className="border-border shrink-0 border-b p-3">
        <div className="relative">
          <Search
            aria-hidden
            className="text-content-muted pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.nav.searchScreens}
            aria-label={t.nav.searchScreens}
            className="border-border-strong bg-surface text-content h-9 w-full rounded-[var(--radius-control)] border px-3 pe-8 text-sm"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t.common.cancel}
              className="text-content-muted hover:text-content absolute start-2 top-1/2 -translate-y-1/2"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* التمرير هنا وحده: القائمة تطول والنافذة لا تطول معها */}
      <nav
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3"
        aria-label={t.nav.dashboard}
      >
        {groups.length === 0 && (
          <p className="text-content-muted px-3 py-6 text-center text-sm">
            {t.nav.noScreens}
          </p>
        )}

        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            <h2 className="text-content-muted px-3 pb-1 text-[11px] font-bold tracking-wide">
              {group.label}
            </h2>
            {group.items.map((item) => (
              <NavEntry key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>
    </div>
  );
}

function NavEntry({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: (() => void) | undefined;
}) {
  const Icon = item.icon;

  if (item.phase > CURRENT_PHASE) {
    return (
      <span
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
      to={item.to}
      end
      onClick={onNavigate}
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
}
