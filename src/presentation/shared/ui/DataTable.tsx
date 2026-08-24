import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { EmptyState } from "./EmptyState";
import { Spinner } from "./Spinner";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** محاذاة رقمية للأعمدة المالية. */
  numeric?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

/** جدول بسيط بالاتجاه RTL. الجداول الكثيفة لاحقًا تستخدم @tanstack/react-table. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Spinner />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        {...(emptyTitle === undefined ? {} : { title: emptyTitle })}
        {...(emptyDescription === undefined ? {} : { description: emptyDescription })}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-border border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "text-content-muted px-3 py-2.5 text-start text-xs font-medium",
                  column.numeric === true && "text-end",
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-border hover:bg-surface-muted border-b last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-3 py-2.5 align-middle",
                    column.numeric === true && "tabular text-end",
                    column.className,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
