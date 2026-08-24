/**
 * تصدير جدول معروض إلى CSV.
 *
 * المصدر هو نفس أعمدة الجدول التي يراها المستخدم، لا استعلام ثانٍ: لو صدّرنا
 * من مصدر مختلف لأصبح للتقرير الواحد رقمان. ولأن `render` يعيد عناصر React،
 * نستخرج النص منها بدل استدعائها كمكوّن.
 *
 * الملف يُنتَج في المتصفّح ولا يمرّ بأي خادم — لا تُرسَل بيانات التقرير خارجًا.
 */
import type { ReactNode } from "react";
import { isValidElement } from "react";

export interface CsvColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
}

/**
 * تسطيح عقدة React إلى نص: الأرقام والنصوص كما هي، والعناصر تُقرأ من
 * أبنائها. ما لا نص له (أيقونة مثلًا) يسقط بلا ضجيج.
 */
function nodeToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");

  if (isValidElement(node)) {
    const props: unknown = node.props;
    if (typeof props === "object" && props !== null && "children" in props) {
      return nodeToText((props as { children?: ReactNode }).children);
    }
    return "";
  }

  return "";
}

/** اقتباس حقل CSV: الفاصلة وعلامة الاقتباس والسطر الجديد تكسر الملف بدونه. */
function quote(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return `"${clean.replace(/"/g, '""')}"`;
}

export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const header = columns.map((c) => quote(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => quote(nodeToText(c.render(row)))).join(","),
  );
  return [header, ...body].join("\r\n");
}

/**
 * تنزيل الجدول كملف CSV.
 * تُضاف علامة BOM لأن Excel بدونها يقرأ العربية كرموز مشوّهة.
 */
export function downloadCsv<T>(
  filename: string,
  columns: readonly CsvColumn<T>[],
  rows: readonly T[],
): void {
  // BOM مكتوب بالهروب لا بالمحرف نفسه: محرف غير مرئي في الشيفرة مصيدة خطأ.
  const bom = "\ufeff";
  const blob = new Blob([bom + toCsv(columns, rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
