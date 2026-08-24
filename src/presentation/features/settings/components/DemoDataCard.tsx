/**
 * النسخة الاختبارية من البيانات [الحسابات 1].
 *
 * الغرض أن يتدرّب المحاسب والموظف الجديد على نظام يتصرّف كالنظام الحقيقي:
 * البيانات تمرّ بمحرّك الترحيل نفسه وتخضع للقيود نفسها. لذلك التوليد
 * والحذف دالّتان في Postgres، وهذه البطاقة زرّان وحالة لا أكثر.
 *
 * كل ما يُولَّد مسجَّل في `demo_data_objects`، والحذف يمرّ على ذلك السجل
 * وحده — فلا يمكن أن يمسّ صفًّا حقيقيًا مهما تشابهت الأكواد.
 */
import { useState } from "react";
import { Database, Trash2, TriangleAlert } from "lucide-react";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { errorMessage } from "@presentation/shared/lib/query";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { usePermission } from "@presentation/shared/hooks/usePermission";
import {
  useClearDemoData,
  useDemoDataStatus,
  useSeedDemoData,
} from "../hooks/useSettings";
import { t } from "@i18n/index";

export function DemoDataCard() {
  const canManage = usePermission("demo_data.manage");
  const status = useDemoDataStatus(canManage);
  const seed = useSeedDemoData();
  const clear = useClearDemoData();

  const [error, setError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  // الشاشة تُخفى لمن لا يملك الصلاحية؛ الدوال في الخادم ترفضه على أي حال
  if (!canManage) return null;

  const exists = status.data?.exists ?? false;
  const busy = seed.isPending || clear.isPending;

  async function run(action: "seed" | "clear") {
    setError(null);
    try {
      if (action === "seed") await seed.mutateAsync();
      else await clear.mutateAsync();
      setConfirmingClear(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Card
      title={t.demoData.title}
      description={t.demoData.subtitle}
      actions={
        exists ? (
          <Badge tone="warning">{t.demoData.active}</Badge>
        ) : (
          <Badge tone="neutral">{t.demoData.inactive}</Badge>
        )
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <p className="text-content-muted text-xs leading-relaxed">
          {t.demoData.explain}
        </p>

        {status.isPending ? (
          <Spinner />
        ) : status.isError ? (
          <p className="text-danger text-sm">{errorMessage(status.error)}</p>
        ) : exists ? (
          <ul className="border-border divide-border divide-y rounded-[var(--radius-control)] border text-sm">
            {(status.data?.entries ?? []).map((entry) => (
              <li key={entry.entity} className="flex justify-between px-3 py-2">
                <span className="text-content-muted font-mono text-xs">
                  {entry.entity}
                </span>
                <span className="text-content">{formatNumber(entry.rowsCount)}</span>
              </li>
            ))}
            <li className="bg-surface-sunken flex justify-between px-3 py-2 font-medium">
              <span>{t.demoData.total}</span>
              <span>{formatNumber(status.data?.totalRows ?? 0)}</span>
            </li>
          </ul>
        ) : (
          <p className="text-content-muted text-sm">{t.demoData.empty}</p>
        )}

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}

        {confirmingClear && (
          <p className="border-warning/30 bg-warning-soft text-warning flex items-start gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-xs">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t.demoData.confirmClear}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!exists && (
            <Button
              onClick={() => void run("seed")}
              disabled={busy}
              startIcon={<Database aria-hidden className="size-4" />}
            >
              {seed.isPending ? t.demoData.seeding : t.demoData.seed}
            </Button>
          )}

          {exists &&
            (confirmingClear ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => void run("clear")}
                  disabled={busy}
                  startIcon={<Trash2 aria-hidden className="size-4" />}
                >
                  {clear.isPending
                    ? t.demoData.clearing
                    : t.demoData.confirmClearAction}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingClear(false)}
                  disabled={busy}
                >
                  {t.common.cancel}
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setConfirmingClear(true)}
                disabled={busy}
                startIcon={<Trash2 aria-hidden className="size-4" />}
              >
                {t.demoData.clear}
              </Button>
            ))}
        </div>
      </div>
    </Card>
  );
}
