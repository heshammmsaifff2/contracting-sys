import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300",
  secondary:
    "bg-surface-sunken text-content hover:bg-border disabled:text-content-muted",
  outline:
    "border border-border-strong bg-surface text-content hover:bg-surface-sunken",
  ghost: "bg-transparent text-content hover:bg-surface-sunken",
  danger: "bg-danger text-white hover:opacity-90 active:opacity-80",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** أيقونة في بداية الزر (يمين في RTL). */
  startIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  startIcon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || isLoading}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius-control)] font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-70",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {isLoading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : startIcon}
      {children}
    </button>
  );
}
