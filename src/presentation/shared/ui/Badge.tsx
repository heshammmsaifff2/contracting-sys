import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type BadgeTone = "neutral" | "brand" | "success" | "info" | "warning" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-content-muted border-border",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  success: "bg-success-soft text-success border-success/25",
  info: "bg-info-soft text-info border-info/25",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/25",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...rest}
    />
  );
}
