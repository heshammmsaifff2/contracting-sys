/**
 * قواعد التقييم ولقطاته [المرحلة ٠٨].
 *
 * أربعة ألسنة لأربعة أفعال متتابعة، وهذا ترتيبها المقصود:
 *   عرّف القاعدة ← **جرّبها** ← طبّقها ← جمّد الفترة. وسجلّ التدقيق يشهد.
 *
 * والمُختبِر ليس زينة: قاعدة تُطبَّق بلا تجربة تُفاجئ ثلاثين موظفًا بخصمٍ في
 * ملفّاتهم، وسحبُها بعد ذلك لا يمحو ما قيل عنها.
 */
import { useState } from "react";
import { FlaskConical, Pencil, Plus, Snowflake, Trash2 } from "lucide-react";
import type {
  EvaluationRuleDto,
  RulePreviewRowDto,
  SaveEvaluationRuleDto,
} from "@application/modules/workflow/dtos";
import {
  previousPeriod,
  RULE_UNIT_FIELDS,
  type RuleEffect,
} from "@core/modules/workflow/entities/EvaluationRule";
import {
  describeCondition,
  type ConditionOp,
  type WorkflowCondition,
} from "@core/modules/workflow/entities/WorkflowCondition";
import { Card } from "@presentation/shared/ui/Card";
import { Badge } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { DataTable, type Column } from "@presentation/shared/ui/DataTable";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { PermissionGate } from "@presentation/shared/ui/PermissionGate";
import { useConfirm } from "@presentation/shared/ui/useConfirm";
import { formatDateTime, formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { employeeTypeLabel } from "@presentation/shared/lib/employee-type";
import { OP_OPTIONS } from "../components/workflow-admin-options";
import {
  useApplyEvaluationRules,
  useClearSnapshot,
  useEvaluationAudit,
  useEvaluationPeriodReport,
  useEvaluationRules,
  useRemoveEvaluationRule,
  useRevokeEvaluationRule,
  useRulePreview,
  useSaveEvaluationRule,
  useTakeSnapshot,
} from "../hooks/useEvaluation";
import { t } from "@i18n/index";

type Tab = "rules" | "preview" | "report" | "audit";

const EFFECT_OPTIONS = [
  { value: "penalty", label: t.evalRules.effectPenalty },
  { value: "bonus", label: t.evalRules.effectBonus },
];

const TYPE_OPTIONS = [
  { value: "", label: t.evalRules.allTypes },
  ...["administrative", "operational"].map((value) => ({
    value,
    label: employeeTypeLabel(value),
  })),
];

const ACTION_LABELS: Record<string, string> = {
  insert: t.evalRules.actionInsert,
  update: t.evalRules.actionUpdate,
  delete: t.evalRules.actionDelete,
};

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function RuleModal({
  rule,
  nextOrder,
  onClose,
}: {
  rule: EvaluationRuleDto | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const save = useSaveEvaluationRule();

  const [key, setKey] = useState(rule?.key ?? "");
  const [name, setName] = useState(rule?.name ?? "");
  const [reasonTemplate, setReasonTemplate] = useState(rule?.reasonTemplate ?? "");
  const [effect, setEffect] = useState<RuleEffect>(rule?.effect ?? "penalty");
  const [points, setPoints] = useState(String(rule?.points ?? 2));
  const [perUnitField, setPerUnitField] = useState(rule?.perUnitField ?? "");
  const [maxPoints, setMaxPoints] = useState(
    rule?.maxPoints === null || rule?.maxPoints === undefined
      ? ""
      : String(rule.maxPoints),
  );
  const [employeeType, setEmployeeType] = useState(rule?.employeeType ?? "");
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);

  const existing = rule?.condition as { field?: string } | null | undefined;
  const [field, setField] = useState(existing?.field ?? "warnings_count");
  const [op, setOp] = useState<ConditionOp>(
    (rule?.condition?.op as ConditionOp | undefined) ?? "gt",
  );
  const [value, setValue] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const needsValue = op !== "is_null" && op !== "is_not_null";
  const isList = op === "in" || op === "not_in";

  function buildCondition(): WorkflowCondition | null {
    if (!needsValue) return { op: op as "is_null" | "is_not_null", field };
    if (isList) {
      return {
        op: op as "in" | "not_in",
        field,
        value: value
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part !== "")
          .map((part) => (Number.isNaN(Number(part)) ? part : Number(part))),
      };
    }
    const parsed = Number(value);
    return {
      op: op as "eq" | "ne" | "gt" | "gte" | "lt" | "lte",
      field,
      value: value.trim() !== "" && !Number.isNaN(parsed) ? parsed : value,
    };
  }

  async function handleSave() {
    setError(null);
    const payload: SaveEvaluationRuleDto = {
      id: rule?.id ?? null,
      key,
      name,
      reasonTemplate,
      condition: buildCondition(),
      effect,
      points: Number(points),
      perUnitField: perUnitField === "" ? null : perUnitField,
      maxPoints: maxPoints.trim() === "" ? null : Number(maxPoints),
      employeeType: employeeType === "" ? null : employeeType,
      isActive,
      sortOrder: rule?.sortOrder ?? nextOrder,
    };
    try {
      await save.mutateAsync(payload);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={rule === null ? t.evalRules.createTitle : t.evalRules.editTitle}
      description={describeCondition(buildCondition())}
      footer={
        <>
          <Button onClick={() => void handleSave()} isLoading={save.isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t.evalRules.name} required>
          {(id) => (
            <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </FormField>

        <FormField label={t.evalRules.key} hint={t.workflowAdmin.stageKeyHint} required>
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={rule !== null}
            />
          )}
        </FormField>

        <div className="sm:col-span-2">
          <FormField label={t.evalRules.reasonTemplate} hint={t.evalRules.reasonHint}>
            {(id) => (
              <Input
                id={id}
                value={reasonTemplate}
                onChange={(e) => setReasonTemplate(e.target.value)}
              />
            )}
          </FormField>
        </div>

        <FormField label={t.workflowAdmin.conditionField} required>
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={field}
              onChange={(e) => setField(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.workflowAdmin.conditionOp} required>
          {(id) => (
            <Select
              id={id}
              options={OP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={op}
              onChange={(e) => setOp(e.target.value as ConditionOp)}
            />
          )}
        </FormField>

        {needsValue && (
          <FormField label={t.workflowAdmin.conditionValue} required>
            {(id) => (
              <Input id={id} value={value} onChange={(e) => setValue(e.target.value)} />
            )}
          </FormField>
        )}

        <FormField label={t.evalRules.effect} required>
          {(id) => (
            <Select
              id={id}
              options={EFFECT_OPTIONS}
              value={effect}
              onChange={(e) => setEffect(e.target.value as RuleEffect)}
            />
          )}
        </FormField>

        <FormField label={t.evalRules.points} required>
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0.01"
              step="0.5"
              dir="ltr"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.evalRules.perUnitField} hint={t.evalRules.perUnitHint}>
          {(id) => (
            <Select
              id={id}
              options={[
                { value: "", label: t.evalRules.perUnitNone },
                ...RULE_UNIT_FIELDS.map((f) => ({ value: f, label: f })),
              ]}
              value={perUnitField}
              onChange={(e) => setPerUnitField(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label={t.evalRules.maxPoints}
          hint={t.evalRules.maxPointsHint}
          required={perUnitField !== ""}
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              min="0.01"
              step="0.5"
              dir="ltr"
              value={maxPoints}
              onChange={(e) => setMaxPoints(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.evalRules.employeeType}>
          {(id) => (
            <Select
              id={id}
              options={TYPE_OPTIONS}
              value={employeeType}
              onChange={(e) => setEmployeeType(e.target.value)}
            />
          )}
        </FormField>

        <Checkbox
          label={t.evalRules.active}
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function EvaluationRulesPage() {
  const [tab, setTab] = useState<Tab>("rules");
  const [period, setPeriod] = useState(previousPeriod(new Date()));
  const [ruleFilter, setRuleFilter] = useState("");
  const [editing, setEditing] = useState<EvaluationRuleDto | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [clearReason, setClearReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rules = useEvaluationRules();
  const removeRule = useRemoveEvaluationRule();
  const confirm = useConfirm();
  const preview = useRulePreview(
    tab === "preview" ? period : "",
    ruleFilter === "" ? null : ruleFilter,
  );
  const report = useEvaluationPeriodReport(tab === "report" ? period : "");
  const audit = useEvaluationAudit(tab === "audit" ? period : null);
  const apply = useApplyEvaluationRules();
  const revoke = useRevokeEvaluationRule();
  const snapshot = useTakeSnapshot();
  const clear = useClearSnapshot();

  const isFrozen = (report.data ?? []).some((row) => row.isFrozen);

  async function run(action: () => Promise<unknown>, success: string) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const ruleColumns: readonly Column<EvaluationRuleDto>[] = [
    {
      key: "name",
      header: t.evalRules.name,
      render: (row) => (
        <span className="text-content text-sm font-medium">
          {row.name}
          <span className="text-content-muted ms-2 font-mono text-[11px]">
            {row.key}
          </span>
        </span>
      ),
    },
    {
      key: "condition",
      header: t.workflowAdmin.condition,
      render: (row) => (
        <span className="text-content-muted text-xs">
          {describeCondition(row.condition)}
        </span>
      ),
    },
    {
      key: "impact",
      header: t.evalRules.impact,
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={row.effect === "bonus" ? "success" : "danger"}>
            {row.effect === "bonus" ? "+" : "−"}
            {formatNumber(row.points)}
          </Badge>
          {row.perUnitField !== null && (
            <span className="text-content-muted font-mono text-[11px]">
              × {row.perUnitField} ≤ {formatNumber(row.maxPoints ?? 0)}
            </span>
          )}
          {!row.isActive && <Badge tone="neutral">{t.items.inactive}</Badge>}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <PermissionGate permission="evaluation.rules">
          <span className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.edit}
              onClick={() => {
                setEditing(row);
                setIsOpen(true);
              }}
              startIcon={<Pencil aria-hidden className="size-4" />}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={t.common.delete}
              onClick={() =>
                confirm.ask({
                  title: t.evalRules.deleteRule,
                  description: row.name,
                  consequences: [t.evalRules.deleteRuleHint],
                  onConfirm: () => removeRule.mutateAsync(row.id),
                })
              }
              startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
            />
          </span>
        </PermissionGate>
      ),
    },
  ];

  const previewColumns: readonly Column<RulePreviewRowDto>[] = [
    {
      key: "employee",
      header: t.evalRules.employee,
      render: (row) => <span className="text-content text-sm">{row.fullName}</span>,
    },
    {
      key: "rule",
      header: t.evalRules.rule,
      render: (row) => (
        <span className="text-content-muted text-xs">{row.ruleName}</span>
      ),
    },
    {
      key: "impact",
      header: t.evalRules.impact,
      render: (row) => (
        <Badge tone={row.effect === "bonus" ? "success" : "danger"}>
          {row.effect === "bonus" ? "+" : "−"}
          {formatNumber(row.points)}
        </Badge>
      ),
    },
    {
      key: "reason",
      header: t.evalRules.reason,
      render: (row) => (
        <span className="text-content-muted text-xs">
          {row.reason}
          {row.alreadyApplied && (
            <Badge tone="neutral" className="ms-2">
              {t.evalRules.alreadyApplied}
            </Badge>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.evalRules.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.evalRules.subtitle}</p>
        </div>

        <FormField label={t.evalRules.period} hint={t.evalRules.periodHint}>
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              className="w-32"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          )}
        </FormField>
      </header>

      <nav className="border-border flex flex-wrap gap-1 border-b">
        {(
          [
            ["rules", t.evalRules.tabRules],
            ["preview", t.evalRules.tabPreview],
            ["report", t.evalRules.tabReport],
            ["audit", t.evalRules.tabAudit],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === value
                ? "border-brand-500 text-content font-medium"
                : "text-content-muted border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {message !== null && <p className="text-success text-sm">{message}</p>}
      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      {tab === "rules" && (
        <Card
          title={t.evalRules.tabRules}
          description={t.evalRules.noRulesHint}
          actions={
            <PermissionGate permission="evaluation.rules">
              <Button
                onClick={() => {
                  setEditing(null);
                  setIsOpen(true);
                }}
                startIcon={<Plus aria-hidden className="size-4" />}
              >
                {t.evalRules.add}
              </Button>
            </PermissionGate>
          }
        >
          <DataTable
            columns={ruleColumns}
            rows={rules.data ?? []}
            rowKey={(row) => row.id}
            isLoading={rules.isPending}
            emptyTitle={t.evalRules.noRules}
          />
        </Card>
      )}

      {tab === "preview" && (
        <Card
          title={t.evalRules.tabPreview}
          description={t.evalRules.previewHint}
          actions={
            <span className="flex flex-wrap items-end gap-2">
              <Select
                aria-label={t.evalRules.rule}
                options={[
                  { value: "", label: t.evalRules.allRules },
                  ...(rules.data ?? []).map((r) => ({ value: r.id, label: r.name })),
                ]}
                value={ruleFilter}
                onChange={(e) => setRuleFilter(e.target.value)}
              />
              <PermissionGate permission="evaluation.rules">
                <Button
                  isLoading={apply.isPending}
                  onClick={() =>
                    void run(
                      () =>
                        apply.mutateAsync({
                          period,
                          ruleId: ruleFilter === "" ? null : ruleFilter,
                        }),
                      t.evalRules.applied,
                    )
                  }
                  startIcon={<FlaskConical aria-hidden className="size-4" />}
                >
                  {t.evalRules.applyRules}
                </Button>
                {ruleFilter !== "" && (
                  <Button
                    variant="secondary"
                    isLoading={revoke.isPending}
                    onClick={() =>
                      void run(
                        () => revoke.mutateAsync({ period, ruleId: ruleFilter }),
                        t.evalRules.revoked,
                      )
                    }
                  >
                    {t.evalRules.revoke}
                  </Button>
                )}
              </PermissionGate>
            </span>
          }
        >
          <DataTable
            columns={previewColumns}
            rows={preview.data ?? []}
            rowKey={(row) => `${row.userId}-${row.ruleId}`}
            isLoading={preview.isPending}
            emptyTitle={t.evalRules.noPreview}
          />
        </Card>
      )}

      {tab === "report" && (
        <Card
          title={t.evalRules.tabReport}
          description={t.evalRules.snapshotHint}
          actions={
            <PermissionGate permission="evaluation.snapshot">
              {isFrozen ? (
                <span className="flex flex-wrap items-end gap-2">
                  <Input
                    aria-label={t.evalRules.clearReason}
                    placeholder={t.evalRules.clearReason}
                    value={clearReason}
                    onChange={(e) => setClearReason(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    isLoading={clear.isPending}
                    onClick={() =>
                      void run(
                        () => clear.mutateAsync({ period, reason: clearReason }),
                        t.evalRules.cleared,
                      )
                    }
                  >
                    {t.evalRules.clearSnapshot}
                  </Button>
                </span>
              ) : (
                <Button
                  isLoading={snapshot.isPending}
                  onClick={() =>
                    void run(
                      () =>
                        snapshot.mutateAsync({
                          period,
                          currentPeriod: currentPeriod(),
                        }),
                      t.evalRules.snapshotTaken,
                    )
                  }
                  startIcon={<Snowflake aria-hidden className="size-4" />}
                >
                  {t.evalRules.takeSnapshot}
                </Button>
              )}
            </PermissionGate>
          }
        >
          <DataTable
            columns={[
              {
                key: "rank",
                header: t.evalRules.rank,
                render: (row) => (
                  <span className="tabular text-content-muted text-xs">
                    #{row.rankInPeriod ?? "—"}
                  </span>
                ),
              },
              {
                key: "name",
                header: t.evalRules.employee,
                render: (row) => (
                  <span className="text-content text-sm">{row.fullName}</span>
                ),
              },
              {
                key: "base",
                header: t.evalRules.baseScore,
                render: (row) => (
                  <span className="tabular text-content-muted text-sm">
                    {row.baseScore === null ? "—" : formatNumber(row.baseScore)}
                  </span>
                ),
              },
              {
                key: "adj",
                header: t.evalRules.adjustment,
                render: (row) =>
                  row.adjustmentPoints === 0 ? (
                    <span className="text-content-muted text-xs">—</span>
                  ) : (
                    <Badge tone={row.adjustmentPoints > 0 ? "success" : "danger"}>
                      {row.adjustmentPoints > 0 ? "+" : ""}
                      {formatNumber(row.adjustmentPoints)}
                    </Badge>
                  ),
              },
              {
                key: "final",
                header: t.evalRules.finalScore,
                render: (row) => (
                  <span className="tabular text-content text-sm font-bold">
                    {row.finalScore === null ? "—" : formatNumber(row.finalScore)}
                  </span>
                ),
              },
              {
                key: "state",
                header: "",
                render: (row) => (
                  <Badge tone={row.isFrozen ? "info" : "neutral"}>
                    {row.isFrozen ? t.evalRules.frozen : t.evalRules.live}
                  </Badge>
                ),
              },
            ]}
            rows={report.data ?? []}
            rowKey={(row) => row.userId}
            isLoading={report.isPending}
            emptyTitle={t.evalRules.noReport}
          />
        </Card>
      )}

      {tab === "audit" && (
        <PermissionGate
          permission="evaluation.audit"
          fallback={<EmptyState title={t.evalRules.auditHint} />}
        >
          <Card title={t.evalRules.tabAudit} description={t.evalRules.auditHint}>
            <DataTable
              columns={[
                {
                  key: "at",
                  header: t.evalRules.auditAt,
                  render: (row) => (
                    <span className="tabular text-content-muted text-xs">
                      {formatDateTime(row.actedAt)}
                    </span>
                  ),
                },
                {
                  key: "entity",
                  header: t.evalRules.auditEntity,
                  render: (row) => (
                    <span className="text-content-muted font-mono text-[11px]">
                      {row.entity}
                    </span>
                  ),
                },
                {
                  key: "action",
                  header: t.evalRules.auditAction,
                  render: (row) => (
                    <Badge
                      tone={
                        row.action === "delete"
                          ? "danger"
                          : row.action === "update"
                            ? "warning"
                            : "success"
                      }
                    >
                      {ACTION_LABELS[row.action] ?? row.action}
                    </Badge>
                  ),
                },
                {
                  key: "subject",
                  header: t.evalRules.auditSubject,
                  render: (row) => (
                    <span className="text-content text-xs">{row.userName ?? "—"}</span>
                  ),
                },
                {
                  key: "actor",
                  header: t.evalRules.auditActor,
                  render: (row) => (
                    <span className="text-content-muted text-xs">
                      {row.actorName ?? "—"}
                    </span>
                  ),
                },
              ]}
              rows={audit.data ?? []}
              rowKey={(row) => row.id}
              isLoading={audit.isPending}
              emptyTitle={t.evalRules.noAudit}
            />
          </Card>
        </PermissionGate>
      )}

      {confirm.dialog}

      {isOpen && (
        <RuleModal
          key={editing?.id ?? "new-rule"}
          rule={editing}
          nextOrder={(rules.data ?? []).length + 1}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
