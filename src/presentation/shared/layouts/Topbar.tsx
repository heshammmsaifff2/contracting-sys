import { LogOut, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { NotificationBell } from "@presentation/features/notifications/components/NotificationBell";
import { useAuth } from "@presentation/app/providers/auth-context";
import { useContainer } from "@presentation/app/providers/di-context";
import { t } from "@i18n/index";
import { mode } from "@config/env";

const TYPE_LABELS: Record<string, string> = {
  admin: t.users.typeAdmin,
  engineer: t.users.typeEngineer,
  supervisor: t.users.typeSupervisor,
};

export function Topbar() {
  const { user } = useAuth();
  const container = useContainer();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await container.useCases.signOut.execute();
    // نمسح كل ذاكرة الاستعلامات حتى لا تتسرّب بيانات المستخدم السابق
    queryClient.clear();
  }

  return (
    <header className="border-border bg-surface flex h-16 shrink-0 items-center gap-4 border-b px-4 md:px-6">
      <div className="relative max-w-md flex-1">
        <Search
          aria-hidden
          className="text-content-muted pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Input placeholder={t.common.search} className="pe-9" />
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <Badge tone="brand">{mode}</Badge>

        {user !== null && (
          <span className="hidden text-start sm:block">
            <span className="text-content block text-sm font-medium">
              {user.profile.fullName}
            </span>
            <span className="text-content-muted block text-xs">
              {TYPE_LABELS[user.profile.employeeType]}
            </span>
          </span>
        )}

        <Button
          variant="ghost"
          size="sm"
          aria-label={t.auth.signOut}
          onClick={() => void handleSignOut()}
          startIcon={<LogOut aria-hidden className="size-4" />}
        />
      </div>
    </header>
  );
}
