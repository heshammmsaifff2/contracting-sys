/**
 * شجرة الحسابات وقواعد الترحيل.
 * جدول القواعد هو تجسيد القسم 8 من المواصفات: كل حدث اعتماد أو تحويل
 * يُنشئ قيده تلقائيًا حسب هذه المطابقة، بلا إدخال بشري.
 */
import type { AccountDto, PostingRuleDto } from "@application/modules/accounting/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAccounts, usePostingRules } from "../hooks/useAccounting";
import { t } from "@i18n/index";

const TYPE_LABELS: Record<AccountDto["type"], string> = {
  asset: t.accounts.typeAsset,
  liability: t.accounts.typeLiability,
  equity: t.accounts.typeEquity,
  revenue: t.accounts.typeRevenue,
  expense: t.accounts.typeExpense,
};

/**
 * أسماء عربية للأحداث. أمّا تفعيل القاعدة فمصدره عمود `is_active` في
 * قاعدة البيانات لا قائمة في الواجهة: القاعدة تُفعَّل وتُعطَّل من الخادم،
 * ولائحة ثابتة هنا كانت ستكذب على المستخدم كلّما أُضيفت قاعدة جديدة.
 */
const SOURCE_LABELS: Record<string, string> = {
  opening_balance: "اعتماد رصيد افتتاحي",
  custody_approval: "اعتماد عهدة",
  payment_transfer: "تحويل مبلغ لمورّد أو مقاول",
  extract_approval: "اعتماد مستخلص",
  receipt_approval: "استلام أصناف",
  advance_payment: "اعتماد دفعة مقدّمة",
  material_transfer: "نقل مواد بين المواقع",
  loan_disbursement: "صرف سلفة",
};

export function AccountsPage() {
  const accounts = useAccounts();
  const rules = usePostingRules();

  const accountColumns: readonly Column<AccountDto>[] = [
    {
      key: "code",
      header: t.accounts.code,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">{row.code}</span>
      ),
    },
    {
      key: "name",
      header: t.accounts.name,
      render: (row) => (
        // الإزاحة تعكس عمق الحساب في الشجرة
        <span
          className={row.isPostable ? "text-content" : "text-content font-bold"}
          style={{ paddingInlineStart: `${row.depth * 1.25}rem` }}
        >
          {row.name}
        </span>
      ),
    },
    {
      key: "type",
      header: t.accounts.type,
      render: (row) => <Badge tone="neutral">{TYPE_LABELS[row.type]}</Badge>,
    },
    {
      key: "postable",
      header: t.accounts.postable,
      render: (row) => (
        <Badge tone={row.isPostable ? "success" : "neutral"}>
          {row.isPostable ? t.common.yes : t.accounts.aggregate}
        </Badge>
      ),
    },
  ];

  const ruleColumns: readonly Column<PostingRuleDto>[] = [
    {
      key: "source",
      header: t.accounts.sourceType,
      render: (row) => (
        <span className="flex flex-col">
          <span className="text-content text-sm font-medium">
            {SOURCE_LABELS[row.sourceType] ?? row.sourceType}
          </span>
          <span className="text-content-muted font-mono text-[11px]">
            {row.sourceType}
          </span>
        </span>
      ),
    },
    {
      key: "debit",
      header: t.accounts.debitAccount,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">
          {row.debitAccountCode ?? t.accounts.fromDocument}
        </span>
      ),
    },
    {
      key: "credit",
      header: t.accounts.creditAccount,
      render: (row) => (
        <span className="text-content-muted font-mono text-xs">
          {row.creditAccountCode ?? t.accounts.fromDocument}
        </span>
      ),
    },
    {
      key: "description",
      header: t.settingsPage.description,
      render: (row) => (
        <span className="text-content-muted text-sm">{row.description}</span>
      ),
    },
    {
      key: "state",
      header: t.items.state,
      render: (row) => (
        <Badge tone={row.isActive ? "success" : "neutral"}>
          {row.isActive ? t.accounts.ruleActive : t.accounts.ruleDisabled}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-content text-xl font-extrabold">{t.accounts.title}</h1>
        <p className="text-content-muted mt-1 text-sm">{t.accounts.subtitle}</p>
      </header>

      <Card>
        {accounts.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(accounts.error)}
          />
        ) : (
          <DataTable
            columns={accountColumns}
            rows={accounts.data ?? []}
            rowKey={(row) => row.id}
            isLoading={accounts.isPending}
            emptyTitle={t.accounts.empty}
          />
        )}
      </Card>

      <Card title={t.accounts.rulesTitle} description={t.accounts.rulesSubtitle}>
        {rules.isError ? (
          <EmptyState title={t.common.error} description={errorMessage(rules.error)} />
        ) : (
          <DataTable
            columns={ruleColumns}
            rows={rules.data ?? []}
            rowKey={(row) => row.id}
            isLoading={rules.isPending}
          />
        )}
      </Card>
    </div>
  );
}
