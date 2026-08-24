import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { t } from "@i18n/index";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="text-content-muted">
        {icon ?? <Inbox aria-hidden className="size-10" />}
      </div>
      <p className="text-content text-sm font-medium">{title ?? t.common.noData}</p>
      {description !== undefined && (
        <p className="text-content-muted max-w-sm text-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
