import type { SelectHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly SelectOption[];
  hasError?: boolean;
  /** خيار فارغ في المقدّمة (مثل «بدون»). */
  placeholder?: string;
}

export function Select({
  options,
  hasError = false,
  placeholder,
  className,
  ...rest
}: SelectProps) {
  return (
    <select
      aria-invalid={hasError || undefined}
      className={cn(
        "bg-surface h-10 w-full rounded-[var(--radius-control)] border px-3 text-sm",
        "text-content disabled:bg-surface-sunken disabled:cursor-not-allowed",
        hasError ? "border-danger" : "border-border-strong",
        className,
      )}
      {...rest}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
