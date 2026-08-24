/**
 * الخدمة الذاتية [شؤون الموظفين 7].
 * كل ما هنا يصل بهويّة المستخدم لا بصلاحية: سياسات RLS تسمح لصاحب الصف
 * برؤيته وطلب سلفته، فيعمل الحساب ولو كان بلا أي دور.
 */
import { useState, type FormEvent } from "react";
import { CalendarDays, HandCoins, Trophy } from "lucide-react";
import type { AttendanceStatus } from "@core/modules/hr/entities/Attendance";
import { payableDays } from "@core/modules/hr/entities/Attendance";
import { Card } from "@presentation/shared/ui/Card";
import { Badge, type BadgeTone } from "@presentation/shared/ui/Badge";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import {
  formatDate,
  formatMoney,
  formatNumber,
} from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import { useAppSettings } from "@presentation/app/providers/settings-context";
import { useAuth } from "@presentation/app/providers/auth-context";
import {
  useAttendance,
  useAttendanceSettings,
  useLoans,
  useProductionRatings,
  useRequestLoan,
  useWithdrawLoan,
} from "../hooks/useHr";
import { t } from "@i18n/index";

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: t.attendance.present,
  excused: t.attendance.excused,
  absent: t.attendance.absent,
  sick: t.attendance.sick,
};

const STATUS_TONES: Record<AttendanceStatus, BadgeTone> = {
  present: "success",
  excused: "warning",
  absent: "danger",
  sick: "info",
};

function RequestLoanModal({
  workerId,
  onClose,
}: {
  workerId: string;
  onClose: () => void;
}) {
  const request = useRequestLoan();
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await request.mutateAsync({
        workerId,
        projectId: null,
        amount: Number(amount),
        installments: Number(installments),
        reason,
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
      title={t.loans.requestTitle}
      footer={
        <>
          <Button
            type="submit"
            form="self-loan-form"
            isLoading={request.isPending}
            disabled={amount === ""}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="self-loan-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.loans.amount} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0.01"
                step="0.01"
                dir="ltr"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label={t.loans.installments} required>
            {(id) => (
              <Input
                id={id}
                type="number"
                min="1"
                step="1"
                dir="ltr"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                required
              />
            )}
          </FormField>
        </div>

        <FormField label={t.loans.reason}>
          {(id) => (
            <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />
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

export function SelfServicePage() {
  const { user } = useAuth();
  const { currency } = useAppSettings();
  const workerId = user?.profile.id ?? "";

  const settings = useAttendanceSettings();
  const attendance = useAttendance({
    projectId: null,
    workDate: null,
    workerId,
  });
  const loans = useLoans(workerId);
  const ratings = useProductionRatings(workerId, null);
  const withdraw = useWithdrawLoan();

  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayValues = settings.data?.dayValues ?? {
    present: 1,
    sick: 0.5,
    excused: -1,
    absent: -2,
  };

  const period = new Date().toISOString().slice(0, 7);
  const monthRows = (attendance.data ?? []).filter((row) =>
    row.workDate.startsWith(period),
  );
  const monthPayable = payableDays(monthRows, dayValues);

  async function handleWithdraw(id: string) {
    if (!window.confirm(t.loans.withdrawConfirm)) return;
    setError(null);
    try {
      await withdraw.mutateAsync(id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-content text-xl font-extrabold">{t.selfService.title}</h1>
          <p className="text-content-muted mt-1 text-sm">{t.selfService.subtitle}</p>
        </div>
        <Button
          onClick={() => setIsRequestOpen(true)}
          disabled={workerId === ""}
          startIcon={<HandCoins aria-hidden className="size-4" />}
        >
          {t.loans.request}
        </Button>
      </header>

      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <Card
        title={
          <span className="flex items-center gap-2">
            <CalendarDays aria-hidden className="size-4" />
            {t.selfService.myAttendance}
          </span>
        }
        description={`${t.selfService.thisMonth} · ${t.selfService.payableDays}: ${formatNumber(monthPayable)}`}
      >
        {monthRows.length === 0 ? (
          <EmptyState title={t.selfService.noAttendance} />
        ) : (
          <ul className="divide-border divide-y">
            {monthRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-content text-sm">{row.projectName}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={STATUS_TONES[row.status]}>
                    {STATUS_LABELS[row.status]}
                  </Badge>
                  <span className="text-content-muted tabular text-xs">
                    {formatDate(row.workDate)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t.selfService.myLoans}>
        {(loans.data ?? []).length === 0 ? (
          <EmptyState title={t.selfService.noLoans} description={t.loans.emptyHint} />
        ) : (
          <ul className="divide-border divide-y">
            {(loans.data ?? []).map((loan) => (
              <li
                key={loan.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-content block text-sm font-medium">
                    {formatMoney(loan.amount, currency)}
                  </span>
                  <span className="text-content-muted text-xs">
                    {loan.reason} · {formatDate(loan.createdAt)}
                  </span>
                </span>
                <Badge
                  tone={
                    loan.status === "approved"
                      ? "success"
                      : loan.status === "rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {loan.status === "requested"
                    ? t.loans.statusRequested
                    : loan.status === "approved"
                      ? t.loans.statusApproved
                      : loan.status === "rejected"
                        ? t.loans.statusRejected
                        : t.loans.statusPaid}
                </Badge>
                {loan.status === "requested" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleWithdraw(loan.id)}
                  >
                    {t.loans.withdraw}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Trophy aria-hidden className="size-4" />
            {t.selfService.myRatings}
          </span>
        }
      >
        {(ratings.data ?? []).length === 0 ? (
          <EmptyState title={t.selfService.noRatings} />
        ) : (
          <ul className="divide-border divide-y">
            {(ratings.data ?? []).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="text-content text-sm">{row.period}</span>
                <span className="text-content-muted tabular text-xs">
                  {t.workers.ratio}:{" "}
                  {row.ratio === null ? "—" : formatNumber(row.ratio)}
                </span>
                <Badge tone={(row.score ?? 0) >= 60 ? "success" : "warning"}>
                  {row.score === null ? "—" : formatNumber(row.score)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isRequestOpen && workerId !== "" && (
        <RequestLoanModal workerId={workerId} onClose={() => setIsRequestOpen(false)} />
      )}
    </div>
  );
}
