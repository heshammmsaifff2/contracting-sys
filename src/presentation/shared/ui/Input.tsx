import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export function Input({ hasError = false, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={hasError || undefined}
      className={cn(
        "bg-surface h-10 w-full rounded-[var(--radius-control)] border px-3 text-sm",
        "text-content placeholder:text-content-muted",
        "disabled:bg-surface-sunken disabled:cursor-not-allowed",
        hasError ? "border-danger" : "border-border-strong",
        className,
      )}
      {...rest}
    />
  );
}
