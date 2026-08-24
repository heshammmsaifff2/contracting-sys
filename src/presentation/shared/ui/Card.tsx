import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  /** إجراءات في رأس البطاقة (أزرار، فلاتر). */
  actions?: ReactNode;
}

export function Card({
  title,
  description,
  actions,
  className,
  children,
  ...rest
}: CardProps) {
  const hasHeader = title !== undefined || actions !== undefined;

  return (
    <div
      className={cn(
        "border-border bg-surface rounded-[var(--radius-card)] border shadow-sm",
        className,
      )}
      {...rest}
    >
      {hasHeader && (
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            {title !== undefined && (
              <h2 className="text-content truncate text-base font-bold">{title}</h2>
            )}
            {description !== undefined && (
              <p className="text-content-muted mt-1 text-sm">{description}</p>
            )}
          </div>
          {actions !== undefined && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
