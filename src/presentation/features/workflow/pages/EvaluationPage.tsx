/**
 * التقييم والترتيب [المراسلات 11–18].
 * درجة الإنجاز تُحتسب آليًا من زمن المراحل داخل الدوام؛ باقي البنود تُقيَّم
 * يدويًا، والأوزان تختلف حسب فئة الموظف.
 */
import { useState } from "react";
import { Star, Trophy } from "lucide-react";
import type {
  EvaluationCriterionDto,
  EvaluationSummaryDto,
} from "@application/modules/workflow/dtos";
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
import { formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useProfiles } from "@presentation/features/identity/hooks/useIdentity";
import {
  useEvaluationCriteria,
  useEvaluationSummary,
  useSaveEvaluationScore,
  useSetCriterionWeight,
} from "../hooks/useWorkflow";
import { t } from "@i18n/index";

const TYPE_LABELS: Record<string, string> = {
  admin: t.evaluation.typeAdmin,
  engineer: t.evaluation.typeEngineer,
  supervisor: t.evaluation.typeSupervisor,
};

/** الأول ذهبي، والثاني والثالث مميّزان، والبقية محايدون. */
function rankTone(rank: number): BadgeTone {
  if (rank === 1) return "success";
  if (rank <= 3) return "info";
  return "neutral";
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function RateModal({ onClose }: { onClose: () => void }) {
  const profiles = useProfiles();
  const criteria = useEvaluationCriteria();
  const save = useSaveEvaluationScore();

  const [userId, setUserId] = useState("");
  const [criteriaId, setCriteriaId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // البنود الآلية لا تُقيَّم يدويًا — درجتها تأتي من زمن الإنجاز
  const manualCriteria = (criteria.data ?? []).filter(
    (criterion) => criterion.kind === "manual" && criterion.isActive,
  );

  async function handleSave() {
    setError(null);
    try {
      await save.mutateAsync({
        userId,
        criteriaId,
        period,
        score: Number(score),
        note,
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t.evaluation.rateTitle}
      footer={
        <>
          <Button
            onClick={() => void handleSave()}
            isLoading={save.isPending}
            disabled={userId === "" || criteriaId === "" || score === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t.evaluation.employee} required className="sm:col-span-2">
          {(id) => (
            <Select
              id={id}
              options={(profiles.data ?? [])
                .filter((profile) => profile.isActive)
                .map((profile) => ({ value: profile.id, label: profile.fullName }))}
              placeholder={t.evaluation.employee}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.evaluation.criterion} required>
          {(id) => (
            <Select
              id={id}
              options={manualCriteria.map((criterion) => ({
                value: criterion.id,
                label: criterion.name,
              }))}
              placeholder={t.evaluation.criterion}
              value={criteriaId}
              onChange={(e) => setCriteriaId(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.evaluation.period} required>
          {(id) => (
            <Input
              id={id}
              type="month"
              dir="ltr"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.evaluation.scoreValue} required>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0"
              max="100"
              dir="ltr"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.evaluation.note}>
          {(id) => (
            <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />
          )}
        </FormField>

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function CriteriaCard() {
  const criteria = useEvaluationCriteria();
  const setWeight = useSetCriterionWeight();

  const columns: readonly Column<EvaluationCriterionDto>[] = [
    {
      key: "name",
      header: t.evaluation.criterion,
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="text-content text-sm font-medium">{row.name}</span>
          <Badge tone={row.kind === "completion" ? "brand" : "neutral"}>
            {row.kind === "completion"
              ? t.evaluation.kindAuto
              : t.evaluation.kindManual}
          </Badge>
        </span>
      ),
    },
    ...(["admin", "engineer", "supervisor"] as const).map((employeeType) => ({
      key: employeeType,
      header:
        employeeType === "admin"
          ? t.evaluation.weightAdmin
          : employeeType === "engineer"
            ? t.evaluation.weightEngineer
            : t.evaluation.weightSupervisor,
      numeric: true,
      render: (row: EvaluationCriterionDto) => (
        <Input
          type="number"
          min="0"
          dir="ltr"
          className="h-8 w-20"
          aria-label={`${row.name} — ${employeeType}`}
          defaultValue={String(row.weights[employeeType] ?? 0)}
          onBlur={(e) =>
            setWeight.mutate({
              criteriaId: row.id,
              employeeType,
              weight: Number(e.target.value),
            })
          }
        />
      ),
    })),
  ];

  return (
    <Card title={t.evaluation.criteria} description={t.evaluation.subtitle}>
      <DataTable
        columns={columns}
        rows={criteria.data ?? []}
        rowKey={(row) => row.id}
        isLoading={criteria.isPending}
      />
    </Card>
  );
}

export function EvaluationPage() {
  const [period, setPeriod] = useState<string>(currentPeriod());
  const summary = useEvaluationSummary(period === "" ? null : period);
  const [isRateOpen, setIsRateOpen] = useState(false);

  const columns: readonly Column<EvaluationSummaryDto>[] = [
    {
      key: "rank",
      header: t.evaluation.rank,
      render: (row) => (
        <Badge tone={rankTone(row.rankInPeriod)}>
          {row.rankInPeriod === 1 && <Trophy aria-hidden className="size-3.5" />}
          {formatNumber(row.rankInPeriod)}
        </Badge>
      ),
    },
    {
      key: "name",
      header: t.evaluation.employee,
      render: (row) => <span className="text-content font-medium">{row.fullName}</span>,
    },
    {
      key: "type",
      header: t.evaluation.type,
      render: (row) => (
        <Badge tone="neutral">
          {TYPE_LABELS[row.employeeType] ?? row.employeeType}
        </Badge>
      ),
    },
    {
      key: "period",
      header: t.evaluation.period,
      render: (row) => (
        <span className="tabular text-content-muted font-mono text-xs">
          {row.period}
        </span>
      ),
    },
    {
      key: "steps",
      header: t.evaluation.completedSteps,
      numeric: true,
      render: (row) => formatNumber(row.completedSteps),
    },
    {
      key: "score",
      header: t.evaluation.score,
      numeric: true,
      render: (row) => (
        <span className="text-content font-bold">
          {formatNumber(row.weightedScore)}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.evaluation.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.evaluation.subtitle}</p>
        </div>

        <PermissionGate permission="evaluation.rate">
          <Button
            onClick={() => setIsRateOpen(true)}
            startIcon={<Star aria-hidden className="size-4" />}
          >
            {t.evaluation.rate}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        <div className="mb-4 max-w-xs">
          <FormField label={t.evaluation.period}>
            {(id) => (
              <Input
                id={id}
                type="month"
                dir="ltr"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            )}
          </FormField>
        </div>

        {summary.isError ? (
          <EmptyState
            title={t.common.error}
            description={errorMessage(summary.error)}
          />
        ) : (
          <DataTable
            columns={columns}
            rows={summary.data ?? []}
            rowKey={(row) => `${row.userId}-${row.period}`}
            isLoading={summary.isPending}
            emptyTitle={t.evaluation.empty}
            emptyDescription={t.evaluation.emptyHint}
          />
        )}
      </Card>

      <PermissionGate permission="evaluation.manage">
        <CriteriaCard />
      </PermissionGate>

      {isRateOpen && <RateModal onClose={() => setIsRateOpen(false)} />}
    </div>
  );
}
