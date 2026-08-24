import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";
import { t } from "@i18n/index";

export interface SpinnerProps {
  className?: string;
  label?: string;
}

export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className="text-content-muted inline-flex items-center gap-2 text-sm"
    >
      <Loader2 aria-hidden className={cn("size-4 animate-spin", className)} />
      {label ?? t.common.loading}
    </span>
  );
}
