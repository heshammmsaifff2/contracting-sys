/**
 * ملفات العمالة: البطاقة والمهن والأجر وسجل تعديله والتوصيات وتقييم الإنتاج.
 * الأجر يُعدَّل بدالة تسجّل الأثر (قبل/بعد/من)، والتوصيات لا يراها إلا HR.
 */
import { useState, type FormEvent } from "react";
import { HardHat, IdCard, Pencil, Star, TrendingUp } from "lucide-react";
import type { WorkerDto } from "@application/modules/hr/dtos";
import type { SalaryType } from "@core/modules/hr/entities/Worker";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import {
  formatDate,
  formatMoney,
  formatNumber,
} from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import {
  useAddRecommendation,
  useChangeSalary,
  useProductionRatings,
  useRateProduction,
  useRecommendations,
  useSalaryHistory,
  useSaveWorker,
  useWorkerSearch,
} from "../hooks/useHr";
import { t } from "@i18n/index";

const SALARY_LABELS: Record<SalaryType, string> = {
  monthly: t.workers.salaryMonthly,
  daily: t.workers.salaryDaily,
  production: t.workers.salaryProduction,
};

const STATUS_LABELS: Record<string, string> = {
  available: t.laborPool.available,
  seconded: t.laborPool.seconded,
  problem: t.laborPool.problem,
};

const STATUS_TONES: Record<string, BadgeTone> = {
  available: "success",
  seconded: "info",
  problem: "danger",
};

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function WorkerFileModal({
  worker,
  onClose,
}: {
  worker: WorkerDto;
  onClose: () => void;
}) {
  const { currency } = useAppSettings();
  const save = useSaveWorker();
  const salaryHistory = useSalaryHistory(worker.id);
  const changeSalary = useChangeSalary();
  const recommendations = useRecommendations(worker.id);
  const addRecommendation = useAddRecommendation();
  const ratings = useProductionRatings(worker.id, null);
  const rate = useRateProduction();

  const [cardNo, setCardNo] = useState(worker.cardNo ?? "");
  const [professions, setProfessions] = useState(worker.professions.join("، "));
  const [salaryType, setSalaryType] = useState<SalaryType>(worker.salaryType);

  const [newBase, setNewBase] = useState("0");
  const [newDaily, setNewDaily] = useState("0");
  const [salaryReason, setSalaryReason] = useState("");

  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"note" | "praise" | "warning">("note");

  const [period, setPeriod] = useState(currentPeriod());
  const [income, setIncome] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: worker.id,
        cardNo: cardNo === "" ? null : cardNo,
        professions: professions
          .split(/[،,]/)
          .map((item) => item.trim())
          .filter((item) => item !== ""),
        salaryType,
        hiredAt: null,
        nationalId: null,
        phone: null,
        notes: "",
      });
      setMessage(t.workers.saved);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleSalary() {
    setError(null);
    try {
      await changeSalary.mutateAsync({
        workerId: worker.id,
        newBase: Number(newBase),
        newDaily: Number(newDaily),
        effectiveFrom: new Date().toISOString().slice(0, 10),
        reason: salaryReason,
      });
      setMessage(t.workers.salaryChanged);
      setSalaryReason("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleRecommendation() {
    setError(null);
    try {
      await addRecommendation.mutateAsync({ workerId: worker.id, kind, note });
      setNote("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleRate() {
    setError(null);
    try {
      await rate.mutateAsync({
        workerId: worker.id,
        period,
        income: Number(income),
        note: "",
      });
      setMessage(t.workers.rated);
      setIncome("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${t.workers.editTitle} — ${worker.fullName}`}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <form onSubmit={handleSaveFile} className="flex flex-col gap-4">
          <h3 className="text-content text-sm font-bold">{t.workers.file}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t.workers.cardNo}>
              {(id) => (
                <Input
                  id={id}
                  dir="ltr"
                  value={cardNo}
                  onChange={(e) => setCardNo(e.target.value)}
                />
              )}
            </FormField>

            <FormField label={t.workers.salaryType}>
              {(id) => (
                <Select
                  id={id}
                  options={(Object.keys(SALARY_LABELS) as SalaryType[]).map((key) => ({
                    value: key,
                    label: SALARY_LABELS[key],
                  }))}
                  value={salaryType}
                  onChange={(e) => setSalaryType(e.target.value as SalaryType)}
                />
              )}
            </FormField>
          </div>

          <FormField label={t.workers.professions} hint={t.workers.professionsHint}>
            {(id) => (
              <Input
                id={id}
                value={professions}
                onChange={(e) => setProfessions(e.target.value)}
              />
            )}
          </FormField>

          <div>
            <PermissionGate permission="worker.manage">
              <Button type="submit" isLoading={save.isPending}>
                {t.common.save}
              </Button>
            </PermissionGate>
          </div>
        </form>

        <PermissionGate permission="user.manage_salary">
          <section className="border-border flex flex-col gap-3 border-t pt-4">
            <h3 className="text-content text-sm font-bold">{t.workers.salary}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label={t.workers.baseSalary}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    step="0.01"
                    dir="ltr"
                    value={newBase}
                    onChange={(e) => setNewBase(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label={t.workers.dailyWage}>
                {(id) => (
                  <Input
                    id={id}
                    type="number"
                    min="0"
                    step="0.01"
                    dir="ltr"
                    value={newDaily}
                    onChange={(e) => setNewDaily(e.target.value)}
                  />
                )}
              </FormField>
              <FormField label={t.workers.changeReason}>
                {(id) => (
                  <Input
                    id={id}
                    value={salaryReason}
                    onChange={(e) => setSalaryReason(e.target.value)}
                  />
                )}
              </FormField>
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() => void handleSalary()}
                isLoading={changeSalary.isPending}
              >
                {t.workers.changeSalary}
              </Button>
            </div>

            <ul className="divide-border divide-y text-xs">
              {(salaryHistory.data ?? []).map((row) => (
                <li key={row.id} className="flex justify-between py-1.5">
                  <span className="text-content-muted">
                    {formatDate(row.effectiveFrom)} · {row.reason}
                  </span>
                  <span className="tabular">
                    {formatMoney(row.oldDaily, currency)} →{" "}
                    {formatMoney(row.newDaily, currency)}
                  </span>
                </li>
              ))}
              {(salaryHistory.data ?? []).length === 0 && (
                <li className="text-content-muted py-1.5">
                  {t.workers.noSalaryHistory}
                </li>
              )}
            </ul>
          </section>
        </PermissionGate>

        <PermissionGate permission="worker.rate">
          <section className="border-border flex flex-col gap-3 border-t pt-4">
            <h3 className="text-content text-sm font-bold">{t.workers.production}</h3>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                type="month"
                dir="ltr"
                className="w-40"
                aria-label={t.workers.period}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className="w-40"
                placeholder={t.workers.income}
                aria-label={t.workers.income}
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => void handleRate()}
                isLoading={rate.isPending}
                disabled={income === ""}
                startIcon={<TrendingUp aria-hidden className="size-4" />}
              >
                {t.workers.rate}
              </Button>
            </div>

            <ul className="divide-border divide-y text-xs">
              {(ratings.data ?? []).map((row) => (
                <li key={row.id} className="flex justify-between py-1.5">
                  <span className="text-content-muted">{row.period}</span>
                  <span className="tabular">
                    {t.workers.income}: {formatMoney(row.income, currency)} ·{" "}
                    {t.workers.cost}: {formatMoney(row.cost, currency)} ·{" "}
                    {t.workers.ratio}:{" "}
                    {row.ratio === null ? "—" : formatNumber(row.ratio)}
                  </span>
                  <Badge tone={(row.score ?? 0) >= 60 ? "success" : "warning"}>
                    {row.score === null ? "—" : formatNumber(row.score)}
                  </Badge>
                </li>
              ))}
              {(ratings.data ?? []).length === 0 && (
                <li className="text-content-muted py-1.5">{t.workers.noRatings}</li>
              )}
            </ul>
          </section>
        </PermissionGate>

        <PermissionGate permission="worker.recommend">
          <section className="border-border flex flex-col gap-3 border-t pt-4">
            <h3 className="text-content text-sm font-bold">
              {t.workers.recommendations}
            </h3>
            <p className="text-content-muted text-xs">
              {t.workers.recommendationsHint}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-36">
                <Select
                  options={[
                    { value: "note", label: t.workers.kindNote },
                    { value: "praise", label: t.workers.kindPraise },
                    { value: "warning", label: t.workers.kindWarning },
                  ]}
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as "note" | "praise" | "warning")
                  }
                  aria-label={t.workers.recommendations}
                />
              </div>
              <Input
                className="min-w-56 flex-1"
                placeholder={t.workers.addRecommendation}
                aria-label={t.workers.addRecommendation}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => void handleRecommendation()}
                isLoading={addRecommendation.isPending}
                disabled={note.trim() === ""}
                startIcon={<Star aria-hidden className="size-4" />}
              >
                {t.common.add}
              </Button>
            </div>

            <ul className="divide-border divide-y text-xs">
              {(recommendations.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center gap-2 py-1.5">
                  <Badge
                    tone={
                      row.kind === "warning"
                        ? "danger"
                        : row.kind === "praise"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {row.kind === "warning"
                      ? t.workers.kindWarning
                      : row.kind === "praise"
                        ? t.workers.kindPraise
                        : t.workers.kindNote}
                  </Badge>
                  <span className="text-content flex-1">{row.note}</span>
                  <span className="text-content-muted tabular">
                    {formatDate(row.createdAt)}
                  </span>
                </li>
              ))}
              {(recommendations.data ?? []).length === 0 && (
                <li className="text-content-muted py-1.5">
                  {t.workers.noRecommendations}
                </li>
              )}
            </ul>
          </section>
        </PermissionGate>

        {message !== null && (
          <p role="status" className="text-success text-sm">
            {message}
          </p>
        )}
        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function WorkersPage() {
  const [query, setQuery] = useState("");
  const workers = useWorkerSearch(useDebounce(query, 250));
  const [selected, setSelected] = useState<WorkerDto | null>(null);

  const columns: readonly Column<WorkerDto>[] = [
    {
      key: "name",
      header: t.workers.name,
      render: (row) => (
        <span>
          <span className="text-content block text-sm font-medium">{row.fullName}</span>
          <span className="text-content-muted font-mono text-xs">
            {row.code ?? "—"}
          </span>
        </span>
      ),
    },
    {
      key: "card",
      header: t.workers.cardNo,
      render: (row) => <span className="font-mono text-xs">{row.cardNo ?? "—"}</span>,
    },
    {
      key: "professions",
      header: t.workers.professions,
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.professions.map((profession) => (
            <Badge key={profession} tone="neutral">
              {profession}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: "salaryType",
      header: t.workers.salaryType,
      render: (row) => <span className="text-sm">{SALARY_LABELS[row.salaryType]}</span>,
    },
    {
      key: "status",
      header: t.workers.status,
      render: (row) =>
        row.status === null ? (
          <span className="text-content-muted text-xs">—</span>
        ) : (
          <Badge tone={STATUS_TONES[row.status] ?? "neutral"}>
            {STATUS_LABELS[row.status] ?? row.status}
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          aria-label={t.workers.file}
          onClick={() => setSelected(row)}
          startIcon={<Pencil aria-hidden className="size-4" />}
        />
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.workers.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.workers.subtitle}</p>
        </div>
        <span className="text-content-muted flex items-center gap-2 text-xs">
          <HardHat aria-hidden className="size-4" />
          {t.workers.emptyHint}
        </span>
      </header>

      <Card>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.workers.search}
          aria-label={t.common.search}
          className="max-w-md"
        />
        <p className="text-content-muted mt-2 flex items-center gap-2 text-xs">
          <IdCard aria-hidden className="size-4" />
          {t.workers.searchHint}
        </p>
      </Card>

      <Card>
        {workers.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(workers.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={workers.data ?? []}
            rowKey={(row) => row.id}
            isLoading={workers.isLoading}
            emptyTitle={t.workers.empty}
            emptyDescription={t.workers.emptyHint}
          />
        )}
      </Card>

      {selected !== null && (
        <WorkerFileModal worker={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
