/**
 * دفتر اليومية — عرض فقط.
 * الواجهة لا تكتب في هذا الدفتر إطلاقًا: القيود تُبنى على الخادم عبر
 * post_accounting_entry، والجدول محميّ بسياسات قراءة فقط.
 */
import type { JournalEntryDto } from "@application/modules/accounting/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { formatDate, formatMoney } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useJournalEntries } from "../hooks/useAccounting";
import { t } from "@i18n/index";

const SOURCE_LABELS: Record<string, string> = {
  opening_balance: t.journal.sourceOpeningBalance,
  manual: t.journal.sourceManual,
};

function EntryCard({
  entry,
  currency,
}: {
  entry: JournalEntryDto;
  currency: Parameters<typeof formatMoney>[1];
}) {
  const isBalanced = entry.totalDebit === entry.totalCredit;

  return (
    <div className="border-border bg-surface rounded-[var(--radius-card)] border">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <span className="flex items-center gap-3">
          <span className="tabular text-content font-mono text-sm font-bold">
            #{entry.entryNo}
          </span>
          <span className="text-content text-sm font-medium">{entry.description}</span>
          <Badge tone={entry.isManual ? "warning" : "success"}>
            {entry.isManual ? t.journal.manual : t.journal.automatic}
          </Badge>
          <Badge tone="neutral">
            {SOURCE_LABELS[entry.sourceType] ?? entry.sourceType}
          </Badge>
        </span>

        <span className="flex items-center gap-3">
          {entry.projectName !== null && (
            <Badge tone="brand">{entry.projectName}</Badge>
          )}
          <span className="tabular text-content-muted text-xs">
            {formatDate(entry.entryDate)}
          </span>
          <Badge tone={isBalanced ? "success" : "danger"}>
            {isBalanced ? t.journal.balanced : t.journal.unbalanced}
          </Badge>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-border border-b">
              <th className="text-content-muted px-4 py-2 text-start text-xs font-medium">
                {t.journal.account}
              </th>
              <th className="text-content-muted px-4 py-2 text-end text-xs font-medium">
                {t.journal.debit}
              </th>
              <th className="text-content-muted px-4 py-2 text-end text-xs font-medium">
                {t.journal.credit}
              </th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line) => (
              <tr key={line.id} className="border-border border-b last:border-0">
                <td className="px-4 py-2">
                  <span className="text-content-muted font-mono text-xs">
                    {line.accountCode}
                  </span>
                  <span className="text-content ms-2">{line.accountName}</span>
                </td>
                <td className="tabular px-4 py-2 text-end">
                  {line.debit > 0 ? formatMoney(line.debit, currency) : "—"}
                </td>
                <td className="tabular px-4 py-2 text-end">
                  {line.credit > 0 ? formatMoney(line.credit, currency) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-sunken">
              <td className="text-content px-4 py-2 text-sm font-bold">
                {t.journal.total}
              </td>
              <td className="tabular text-content px-4 py-2 text-end font-bold">
                {formatMoney(entry.totalDebit, currency)}
              </td>
              <td className="tabular text-content px-4 py-2 text-end font-bold">
                {formatMoney(entry.totalCredit, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function JournalPage() {
  const entries = useJournalEntries();
  const { currency } = useAppSettings();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.journal.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.journal.subtitle}</p>
      </header>

      {entries.isPending && (
        <Card>
          <Spinner />
        </Card>
      )}

      {entries.isError && (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(entries.error)}
          />
        </Card>
      )}

      {entries.data !== undefined && entries.data.length === 0 && (
        <Card>
          <EmptyState title={t.journal.empty} description={t.journal.emptyHint} />
        </Card>
      )}

      {(entries.data ?? []).map((entry) => (
        <EntryCard key={entry.id} entry={entry} currency={currency} />
      ))}
    </div>
  );
}
