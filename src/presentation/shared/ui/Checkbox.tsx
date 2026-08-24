import type { InputHTMLAttributes } from "react";
import { useId } from "react";
import { cn } from "../lib/cn";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label: string;
  hint?: string;
}

export function Checkbox({ label, hint, className, id, ...rest }: CheckboxProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <input
        id={fieldId}
        type="checkbox"
        className="border-border-strong accent-brand-600 mt-0.5 size-4 shrink-0 rounded"
        {...rest}
      />
      <label htmlFor={fieldId} className="cursor-pointer text-sm select-none">
        <span className="text-content">{label}</span>
        {hint !== undefined && (
          <span className="text-content-muted block text-xs">{hint}</span>
        )}
      </label>
    </div>
  );
}
