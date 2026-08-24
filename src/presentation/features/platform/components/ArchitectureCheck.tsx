/**
 * يعرض نتيجة عملية لكائنات القيمة في طبقة core — دليل أن الطبقة الخالصة
 * تعمل بلا أي تبعية لإطار عمل، وأن نسبة الضريبة والعملة تأتيان من جدول
 * settings لا من ثابت في الكود.
 */
import { Money } from "@core/shared/value-objects/money";
import { Quantity } from "@core/shared/value-objects/quantity";
import { Code } from "@core/shared/value-objects/code";
import type { CurrencyCode } from "@core/shared/value-objects/money";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { formatMoney, formatNumber } from "@presentation/shared/lib/formatters";
import { Badge } from "@presentation/shared/ui/Badge";

interface Row {
  label: string;
  value: string;
  ok: boolean;
}

function buildRows(currency: CurrencyCode, vatRate: number): Row[] {
  const rows: Row[] = [];

  const unitPrice = Money.create(1250.75, currency);
  const qty = Quantity.create(12.5, "م3");

  if (unitPrice.ok && qty.ok) {
    const lineTotal = unitPrice.value.multiply(qty.value.value);
    if (lineTotal.ok) {
      const vat = lineTotal.value.percentage(vatRate);
      const withVat = vat.ok ? lineTotal.value.add(vat.value) : null;

      rows.push({
        label: "سعر الوحدة × الكمية",
        value: `${formatMoney(unitPrice.value.amount, currency)} × ${formatNumber(qty.value.value)} ${qty.value.unit} = ${formatMoney(lineTotal.value.amount, currency)}`,
        ok: true,
      });
      rows.push({
        label: `ضريبة القيمة المضافة ${formatNumber(vatRate)}٪ (من جدول الإعدادات)`,
        value: vat.ok ? formatMoney(vat.value.amount, currency) : "—",
        ok: vat.ok,
      });
      rows.push({
        label: "الإجمالي شامل الضريبة",
        value: withVat?.ok === true ? formatMoney(withVat.value.amount, currency) : "—",
        ok: withVat?.ok === true,
      });
    }
  }

  const badCode = Code.create("صنف 1");
  rows.push({
    label: "رفض كود غير صالح (Result بدل استثناء)",
    value: badCode.ok ? "لم يُرفض!" : badCode.error.message,
    ok: !badCode.ok,
  });

  const negativeQty = Quantity.create(-5, "طن");
  rows.push({
    label: "رفض كمية سالبة",
    value: negativeQty.ok ? "لم تُرفض!" : negativeQty.error.message,
    ok: !negativeQty.ok,
  });

  return rows;
}

export function ArchitectureCheck() {
  const { currency, vatRate } = useAppSettings();
  const rows = buildRows(currency, vatRate);

  return (
    <ul className="divide-border divide-y">
      {rows.map((row) => (
        <li
          key={row.label}
          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
        >
          <span className="text-content-muted text-sm">{row.label}</span>
          <span className="flex items-center gap-2">
            <span className="tabular text-content text-sm font-medium">
              {row.value}
            </span>
            <Badge tone={row.ok ? "success" : "danger"}>
              {row.ok ? "سليم" : "خطأ"}
            </Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}
