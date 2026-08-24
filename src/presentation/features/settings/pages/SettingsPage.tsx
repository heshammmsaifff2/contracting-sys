/**
 * إعدادات النظام — تجسيد قاعدة «لا أرقام سحرية»: كل رقم أو نسبة أو مدّة
 * يُعدَّل من هنا لا من الكود.
 *
 * الشاشة تعرض كل إعداد بالحقل المناسب لمعناه — نسبة، وقت، حساب، جدول
 * درجات — لا بصيغة JSON. من يضبط خصم الغياب لا يلزمه أن يعرف ما القوس
 * المعقوف. والصيغة الخام تبقى متاحة خلف مفتاح «العرض المتقدّم» لمن
 * يحتاجها فعلًا.
 */
import { useMemo, useState } from "react";
import { Check, Code2, RotateCcw, Save } from "lucide-react";
import type { SettingDto } from "@application/modules/settings/dtos";
import { Card } from "@presentation/shared/ui/Card";
import { Button } from "@presentation/shared/ui/Button";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { errorMessage } from "@presentation/shared/lib/query";
import { usePermission } from "@presentation/shared/hooks/usePermission";
import { useAccounts } from "@presentation/features/accounting/hooks/useAccounting";
import { DemoDataCard } from "../components/DemoDataCard";
import { SettingField } from "../components/SettingField";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  inferSpec,
} from "../components/setting-fields";
import { useSettingsList, useUpdateSetting } from "../hooks/useSettings";
import { t } from "@i18n/index";

export function SettingsPage() {
  const settings = useSettingsList();
  const accounts = useAccounts();
  const updateSetting = useUpdateSetting();
  const canManage = usePermission("settings.manage");

  /** المسودّات: ما عدّله المستخدم ولم يحفظه بعد. */
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // مرجع ثابت ما لم تتغيّر البيانات فعلًا — وإلا أُعيد تجميع التصنيفات كل رسم
  const rows = useMemo(() => settings.data ?? [], [settings.data]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, SettingDto[]>();
    for (const row of rows) {
      const list = byCategory.get(row.category) ?? [];
      list.push(row);
      byCategory.set(row.category, list);
    }

    // التصنيفات المعروفة بترتيبها، ثم أي تصنيف جديد لم تعرفه الواجهة بعد
    const known = CATEGORY_ORDER.filter((c) => byCategory.has(c));
    const rest = [...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c));
    return [...known, ...rest].map((category) => ({
      category,
      items: byCategory.get(category) ?? [],
    }));
  }, [rows]);

  function valueOf(row: SettingDto): unknown {
    return row.key in drafts ? drafts[row.key] : row.value;
  }

  function isDirty(row: SettingDto): boolean {
    if (!(row.key in drafts)) return false;
    return JSON.stringify(drafts[row.key]) !== JSON.stringify(row.value);
  }

  function discard(key: string) {
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function handleSave(row: SettingDto) {
    setError(null);
    setSavedKey(null);
    try {
      await updateSetting.mutateAsync({ key: row.key, value: valueOf(row) });
      discard(row.key);
      setSavedKey(row.key);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const hasUnsaved = rows.some(isDirty);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">
            {t.settingsPage.title}
          </h1>
          <p className="text-content-muted mt-1 text-sm">{t.settingsPage.subtitle}</p>
        </div>
        <Checkbox
          label={t.settingsPage.showRaw}
          hint={t.settingsPage.showRawHint}
          checked={showRaw}
          onChange={(e) => setShowRaw(e.target.checked)}
        />
      </header>

      {!canManage && (
        <p className="border-border bg-surface-sunken text-content-muted rounded-[var(--radius-control)] border px-4 py-3 text-sm">
          {t.settingsPage.readOnly}
        </p>
      )}

      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      {hasUnsaved && (
        <p className="border-warning/30 bg-warning-soft text-warning rounded-[var(--radius-control)] border px-4 py-2 text-sm">
          {t.settingsPage.unsaved}
        </p>
      )}

      {settings.isPending && <Spinner />}

      {settings.isError && (
        <EmptyState title={t.common.error} description={errorMessage(settings.error)} />
      )}

      {!settings.isPending && !settings.isError && rows.length === 0 && (
        <EmptyState title={t.settingsPage.empty} />
      )}

      {groups.map(({ category, items }) => (
        <Card key={category} title={CATEGORY_LABELS[category] ?? category}>
          <div className="divide-border divide-y">
            {items.map((row) => {
              const spec = inferSpec(row.key, row.value);
              const dirty = isDirty(row);

              return (
                <div key={row.key} className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-content text-sm font-medium">
                      {spec.label}
                    </span>
                    {showRaw && (
                      <span className="text-content-muted font-mono text-[11px]">
                        {row.key}
                      </span>
                    )}
                  </div>

                  {/* وصف قاعدة البيانات هو الشرح الأصلي، وشرح الحقل يكمّله */}
                  <p className="text-content-muted text-xs leading-relaxed">
                    {row.description !== "" ? row.description : spec.help}
                    {row.description !== "" && spec.help !== undefined && (
                      <span className="block">{spec.help}</span>
                    )}
                  </p>

                  <div className="flex flex-wrap items-end gap-3">
                    <SettingField
                      spec={showRaw ? { ...spec, kind: "json" } : spec}
                      value={valueOf(row)}
                      disabled={!canManage}
                      accounts={accounts.data ?? []}
                      onChange={(next) =>
                        setDrafts((previous) => ({ ...previous, [row.key]: next }))
                      }
                    />

                    {dirty && canManage && (
                      <span className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => void handleSave(row)}
                          isLoading={updateSetting.isPending}
                          startIcon={<Save aria-hidden className="size-4" />}
                        >
                          {t.settingsPage.save}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t.settingsPage.discard}
                          onClick={() => discard(row.key)}
                          startIcon={<RotateCcw aria-hidden className="size-4" />}
                        />
                      </span>
                    )}

                    {savedKey === row.key && !dirty && (
                      <span className="text-success flex items-center gap-1 text-xs">
                        <Check aria-hidden className="size-3.5" />
                        {t.settingsPage.saved}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {showRaw && (
        <p className="text-content-muted flex items-center gap-2 text-xs">
          <Code2 aria-hidden className="size-4" />
          {t.settingsPage.rawNote}
        </p>
      )}

      <DemoDataCard />
    </div>
  );
}
