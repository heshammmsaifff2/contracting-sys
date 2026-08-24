import type { ReactNode } from "react";
import { useId } from "react";
import { cn } from "../lib/cn";
import { t } from "@i18n/index";

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  /** يتلقّى id ليُربط بالحقل عبر htmlFor. */
  children: (fieldId: string) => ReactNode;
}

export function FormField({
  label,
  required = false,
  error,
  hint,
  className,
  children,
}: FormFieldProps) {
  const fieldId = useId();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-content text-sm font-medium">
        {label}
        {required ? (
          <span className="text-danger ms-1" aria-label={t.common.required}>
            *
          </span>
        ) : (
          <span className="text-content-muted ms-1 text-xs">({t.common.optional})</span>
        )}
      </label>
      {children(fieldId)}
      {error !== undefined ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : (
        hint !== undefined && <p className="text-content-muted text-xs">{hint}</p>
      )}
    </div>
  );
}
