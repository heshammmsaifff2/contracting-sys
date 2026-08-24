/**
 * المستخلصات.
 * ما يُدخله المهندس هنا كمية هذا المستخلص لا غير: الرقم والسعر وحد العقد
 * والكميات السابقة كلها مستدعاة، والاستقطاعات والصافي يحسبها الخادم عند
 * الاعتماد ويُسجَّل معها قيد الاستحقاق آليًا [الحسابات 18، 19].
 */
import { useState, type FormEvent } from "react";
import { CheckCircle2, FileSpreadsheet, Plus } from "lucide-react";
import type { ExtractDto } from "@application/modules/accounting/dtos/documents";
import type { ExtractStatus } from "@core/modules/accounting/entities/Extract";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
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
import { useProjects } from "@presentation/features/projects/hooks/useProjects";
import {
  useApproveExtract,
  useContractorSearch,
  useExtracts,
  useGenerateExtract,
  useSetExtractFinal,
  useSetExtractLineQty,
} from "../hooks/useAccountingDocs";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<ExtractStatus, string> = {
  draft: t.extracts.statusDraft,
  submitted: t.extracts.statusSubmitted,
  approved: t.extracts.statusApproved,
  paid: t.extracts.statusPaid,
  cancelled: t.extracts.statusCancelled,
};

const STATUS_TONES: Record<ExtractStatus, BadgeTone> = {
  draft: "neutral",
  submitted: "info",
  approved: "success",
  paid: "brand",
  cancelled: "danger",
};

function GenerateModal({ onClose }: { onClose: () => void }) {
  const projects = useProjects();
  const [contractorQuery, setContractorQuery] = useState("");
  const contractors = useContractorSearch(useDebounce(contractorQuery, 250));
  const generate = useGenerateExtract();

  const [projectId, setProjectId] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [extractDate, setExtractDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await generate.mutateAsync({ projectId, contractorId, extractDate });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t.extracts.generateTitle}
      footer={
        <>
          <Button
            type="submit"
            form="generate-extract"
            isLoading={generate.isPending}
            disabled={projectId === "" || contractorId === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="generate-extract"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <FormField label={t.extracts.project} required>
          {(id) => (
            <Select
              id={id}
              options={(projects.data ?? []).map((project) => ({
                value: project.id,
                label: `${project.code} — ${project.name}`,
              }))}
              placeholder={t.limits.pickProject}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.extracts.contractor} required>
          {(id) => (
            <div className="flex flex-col gap-2">
              <Input
                value={contractorQuery}
                onChange={(e) => setContractorQuery(e.target.value)}
                placeholder={t.contractors.search}
                aria-label={t.common.search}
              />
              <Select
                id={id}
                options={(contractors.data ?? [])
                  .filter((c) => c.isActive)
                  .map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))}
                placeholder={t.extracts.pickContractor}
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                required
              />
            </div>
          )}
        </FormField>

        <FormField label={t.extracts.extractDate} required>
          {(id) => (
            <Input
              id={id}
              type="date"
              dir="ltr"
              value={extractDate}
              onChange={(e) => setExtractDate(e.target.value)}
              required
            />
          )}
        </FormField>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function ExtractCard({ extract }: { extract: ExtractDto }) {
  const { currency } = useAppSettings();
  const setQty = useSetExtractLineQty();
  const setFinal = useSetExtractFinal();
  const approve = useApproveExtract();

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEditable = extract.status === "draft" || extract.status === "submitted";

  async function handleQty(
    lineId: string,
    value: number,
    maxQty: number,
    prevQty: number,
  ) {
    setError(null);
    try {
      await setQty.mutateAsync({
        lineId,
        extractId: extract.id,
        currentQty: value,
        maxQty,
        prevQty,
      });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function handleApprove() {
    if (!window.confirm(t.extracts.approveHint)) return;
    setError(null);
    setMessage(null);
    try {
      const result = await approve.mutateAsync(extract.id);
      setMessage(`${t.extracts.approved} ${result.entryId.slice(0, 8)}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="tabular font-mono">#{extract.seq}</span>
          <span className="text-sm">{extract.contractorName}</span>
          <Badge tone={STATUS_TONES[extract.status]}>
            {STATUS_LABELS[extract.status]}
          </Badge>
          {extract.isFinal && <Badge tone="brand">{t.extracts.isFinal}</Badge>}
        </span>
      }
      description={`${extract.projectName} · ${formatDate(extract.extractDate)}`}
      actions={
        isEditable ? (
          <PermissionGate permission="extract.approve">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleApprove()}
              isLoading={approve.isPending}
              startIcon={<CheckCircle2 aria-hidden className="size-4" />}
            >
              {t.extracts.approve}
            </Button>
          </PermissionGate>
        ) : undefined
      }
    >
      {isEditable && (
        <PermissionGate permission="extract.create">
          <Checkbox
            label={t.extracts.isFinal}
            hint={t.extracts.isFinalHint}
            checked={extract.isFinal}
            onChange={(e) =>
              void setFinal.mutateAsync({ id: extract.id, isFinal: e.target.checked })
            }
            className="mb-3"
          />
        </PermissionGate>
      )}

      <ul className="divide-border divide-y">
        {extract.lines.map((line) => (
          <li key={line.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="text-content block text-sm font-medium">
                {line.boqName}
              </span>
              <span className="text-content-muted font-mono text-xs">
                {line.boqCode} · {formatMoney(line.unitPrice, currency)} /{" "}
                {line.boqUnit}
              </span>
            </span>

            <span className="tabular text-content-muted text-xs">
              {t.extracts.prevQty}: {formatNumber(line.prevQty)} · {t.extracts.maxQty}:{" "}
              {formatNumber(line.maxQty)}
            </span>

            {isEditable ? (
              <Input
                type="number"
                min="0"
                step="0.001"
                dir="ltr"
                className="h-8 w-28"
                aria-label={t.extracts.currentQty}
                defaultValue={String(line.currentQty)}
                onBlur={(e) =>
                  void handleQty(
                    line.id,
                    Number(e.target.value),
                    line.maxQty,
                    line.prevQty,
                  )
                }
              />
            ) : (
              <span className="tabular text-sm font-medium">
                {formatNumber(line.currentQty)}
              </span>
            )}

            <span className="tabular text-content w-28 text-end text-sm">
              {formatMoney(line.amount, currency)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="border-border mt-3 grid gap-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-content-muted">{t.extracts.gross}</dt>
          <dd className="tabular font-medium">
            {formatMoney(extract.grossAmount, currency)}
          </dd>
        </div>
        {extract.deductions.map((deduction) => (
          <div key={deduction.id} className="flex justify-between">
            <dt className="text-content-muted">
              {deduction.name} ({formatNumber(deduction.rate)}٪)
            </dt>
            <dd className="tabular text-danger">
              − {formatMoney(deduction.amount, currency)}
            </dd>
          </div>
        ))}
        {extract.retentionReleased > 0 && (
          <div className="flex justify-between">
            <dt className="text-content-muted">{t.extracts.retentionReleased}</dt>
            <dd className="tabular text-success">
              + {formatMoney(extract.retentionReleased, currency)}
            </dd>
          </div>
        )}
        <div className="border-border flex justify-between border-t pt-1">
          <dt className="text-content font-bold">{t.extracts.net}</dt>
          <dd className="tabular text-content font-bold">
            {formatMoney(extract.netAmount, currency)}
          </dd>
        </div>
      </dl>

      {message !== null && (
        <p role="status" className="text-success mt-2 text-sm">
          {message}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}

export function ExtractsPage() {
  const projects = useProjects();
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<string>("");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  const extracts = useExtracts({
    projectId: projectId === "" ? null : projectId,
    status: status === "" ? null : (status as ExtractStatus),
  });

  const rows = extracts.data ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.extracts.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.extracts.subtitle}</p>
        </div>
        <PermissionGate permission="extract.create">
          <Button
            onClick={() => setIsGenerateOpen(true)}
            startIcon={<Plus aria-hidden className="size-4" />}
          >
            {t.extracts.generate}
          </Button>
        </PermissionGate>
      </header>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            options={[
              { value: "", label: t.facilities.allProjects },
              ...(projects.data ?? []).map((project) => ({
                value: project.id,
                label: `${project.code} — ${project.name}`,
              })),
            ]}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label={t.extracts.project}
          />
          <Select
            options={[
              { value: "", label: t.extracts.allStatuses },
              ...(Object.keys(STATUS_LABELS) as ExtractStatus[]).map((key) => ({
                value: key,
                label: STATUS_LABELS[key],
              })),
            ]}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label={t.extracts.status}
          />
        </div>
      </Card>

      {extracts.isError && (
        <Card>
          <EmptyState
            title={t.common.error}
            description={errorMessage(extracts.error)}
          />
        </Card>
      )}

      {!extracts.isError && rows.length === 0 && (
        <Card>
          <EmptyState title={t.extracts.empty} description={t.extracts.emptyHint} />
        </Card>
      )}

      {rows.map((extract) => (
        <ExtractCard key={extract.id} extract={extract} />
      ))}

      {isGenerateOpen && <GenerateModal onClose={() => setIsGenerateOpen(false)} />}

      {rows.length > 0 && (
        <p className="text-content-muted flex items-center gap-2 text-xs">
          <FileSpreadsheet aria-hidden className="size-4" />
          {t.extracts.subtitle}
        </p>
      )}
    </div>
  );
}
