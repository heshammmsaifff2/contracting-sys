/**
 * إضافة/تعديل قسم، ومعه زرّ «إخفاء مرفقات القسم عن الكل».
 *
 * «الإخفاء» حجبٌ في القاعدة لا تشفيرٌ للملفّ: سياسة الصفوف لا تُرجع المرفق
 * لغير رافعه وزملائه في القسم ومن استُثني — فلا يظهر في القائمة ولا يُطلب
 * رابطه أصلًا.
 *
 * الاستثناءات تُقرأ من القاعدة قبل تركيب النموذج، فتُهيَّأ الحالة مرّةً من
 * بيانات مكتملة بلا مزامنة عبر أثر جانبيّ.
 */
import { useMemo, useState, type FormEvent } from "react";
import { Check, Lock, LockOpen, Search } from "lucide-react";
import type {
  AttachmentAccessEntry,
  Classification,
  DepartmentDto,
} from "@application/modules/organization/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { FormField } from "@presentation/shared/ui/FormField";
import { Input } from "@presentation/shared/ui/Input";
import { Modal } from "@presentation/shared/ui/Modal";
import { Select } from "@presentation/shared/ui/Select";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { cn } from "@presentation/shared/lib/cn";
import { errorMessage } from "@presentation/shared/lib/query";
import { EMPLOYEE_TYPE_OPTIONS } from "@presentation/shared/lib/employee-type";
import { useProfiles } from "@presentation/features/identity/hooks/useIdentity";
import { useAttachmentAccess, useSaveDepartment } from "../hooks/useOrganization";
import { departmentLabel } from "../lib/org-options";
import { t } from "@i18n/index";

interface DepartmentModalProps {
  department: DepartmentDto | null;
  defaultClassification: Classification;
  departments: readonly DepartmentDto[];
  onClose: () => void;
}

export function DepartmentModal(props: DepartmentModalProps) {
  const access = useAttachmentAccess(props.department?.id ?? null);
  const isLoading = props.department !== null && access.isPending;

  return (
    <Modal
      isOpen
      onClose={props.onClose}
      title={props.department === null ? t.org.addDepartment : t.org.editDepartment}
      size="lg"
      footer={
        <>
          <Button
            type="submit"
            form="department-form"
            disabled={isLoading || access.isError}
          >
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={props.onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Spinner />
      ) : access.isError ? (
        <p role="alert" className="text-danger text-sm">
          {errorMessage(access.error)}
        </p>
      ) : (
        <DepartmentForm {...props} initialAccess={access.data ?? []} />
      )}
    </Modal>
  );
}

function DepartmentForm({
  department,
  defaultClassification,
  departments,
  onClose,
  initialAccess,
}: DepartmentModalProps & { initialAccess: readonly AttachmentAccessEntry[] }) {
  const save = useSaveDepartment();
  const profiles = useProfiles();

  const [name, setName] = useState(department?.name ?? "");
  const [classification, setClassification] = useState<Classification>(
    department?.classification ?? defaultClassification,
  );
  const [description, setDescription] = useState(department?.description ?? "");
  const [restrict, setRestrict] = useState(department?.restrictAttachments ?? false);
  const [userIds, setUserIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        initialAccess.flatMap((a) =>
          a.kind === "user" && a.userId !== null ? [a.userId] : [],
        ),
      ),
  );
  const [departmentIds, setDepartmentIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        initialAccess.flatMap((a) =>
          a.kind === "department" && a.departmentId !== null ? [a.departmentId] : [],
        ),
      ),
  );
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const otherDepartments = departments.filter((d) => d.id !== department?.id);

  // موظفو القسم يرون مرفقاته دائمًا، فلا يُعرضون للاستثناء
  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (profiles.data ?? [])
      .filter(
        (p) => p.isActive && (department === null || p.departmentId !== department.id),
      )
      .filter(
        (p) =>
          needle === "" ||
          p.fullName.toLowerCase().includes(needle) ||
          (p.jobName ?? "").toLowerCase().includes(needle),
      );
  }, [profiles.data, query, department]);

  function toggle(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const sameClass = departments.filter((d) => d.classification === classification);
    try {
      await save.mutateAsync({
        id: department?.id ?? null,
        name,
        classification,
        description,
        restrictAttachments: restrict,
        sortOrder:
          department !== null && department.classification === classification
            ? department.sortOrder
            : sameClass.length + 1,
        access: [
          ...[...userIds].map((userId): AttachmentAccessEntry => ({
            kind: "user",
            userId,
            departmentId: null,
          })),
          ...[...departmentIds].map((departmentId): AttachmentAccessEntry => ({
            kind: "department",
            userId: null,
            departmentId,
          })),
        ],
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const classificationChanged =
    department !== null &&
    department.classification !== classification &&
    department.employeeCount > 0;

  return (
    <form id="department-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t.org.departmentName} required>
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField
          label={t.org.classification}
          hint={t.org.classificationHint}
          required
        >
          {(id) => (
            <Select
              id={id}
              options={EMPLOYEE_TYPE_OPTIONS}
              value={classification}
              onChange={(e) => setClassification(e.target.value as Classification)}
            />
          )}
        </FormField>
      </div>

      <FormField label={t.org.description}>
        {(id) => (
          <Input
            id={id}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </FormField>

      {classificationChanged && (
        <p className="text-warning bg-warning-soft rounded-[var(--radius-control)] p-3 text-xs">
          {t.org.classificationChangeWarning(department.employeeCount)}
        </p>
      )}

      {/* المفتاح الواضح: البطاقة كلها تُضغط، ولونها يقول الحالة قبل قراءة النصّ */}
      <button
        type="button"
        role="switch"
        aria-checked={restrict}
        onClick={() => setRestrict(!restrict)}
        className={cn(
          "flex w-full items-start gap-3 rounded-[var(--radius-card)] border-2 p-4 text-start transition-colors",
          restrict
            ? "border-warning bg-warning-soft"
            : "border-border hover:bg-surface-sunken",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            restrict ? "bg-warning text-white" : "bg-surface-sunken text-content-muted",
          )}
        >
          {restrict ? <Lock className="size-5" /> : <LockOpen className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-content block font-bold">{t.org.restrictTitle}</span>
          <span className="text-content-muted mt-0.5 block text-xs leading-relaxed">
            {restrict ? t.org.restrictOnHint : t.org.restrictOffHint}
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "relative mt-2 h-6 w-11 shrink-0 rounded-full transition-colors",
            restrict ? "bg-warning" : "bg-border-strong",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
              restrict ? "start-[1.375rem]" : "start-0.5",
            )}
          />
        </span>
      </button>

      {restrict && (
        <fieldset className="border-border flex flex-col gap-4 rounded-[var(--radius-card)] border p-4">
          <legend className="text-content px-1 text-sm font-bold">
            {t.org.exceptions}
          </legend>
          <p className="text-content-muted -mt-2 text-xs">
            {userIds.size + departmentIds.size === 0
              ? t.org.noExceptions
              : t.org.exceptionsSummary(userIds.size, departmentIds.size)}
          </p>

          <div className="flex flex-col gap-2">
            <h4 className="text-content text-sm font-medium">
              {t.org.exceptDepartments}
            </h4>
            {otherDepartments.length === 0 ? (
              <p className="text-content-muted text-xs">{t.org.noOtherDepartments}</p>
            ) : (
              <ul className="grid gap-1 sm:grid-cols-2">
                {otherDepartments.map((d) => (
                  <li key={d.id}>
                    <ToggleRow
                      checked={departmentIds.has(d.id)}
                      onToggle={() => setDepartmentIds((s) => toggle(s, d.id))}
                      label={departmentLabel(d)}
                      hint={t.org.employeesCount(d.employeeCount)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="text-content text-sm font-medium">{t.org.exceptUsers}</h4>
            <div className="relative">
              <Search
                aria-hidden
                className="text-content-muted pointer-events-none absolute inset-y-0 start-3 my-auto size-4"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.org.searchEmployees}
                className="ps-9"
              />
            </div>
            {profiles.isPending ? (
              <Spinner />
            ) : (
              <ul className="border-border divide-border max-h-60 divide-y overflow-y-auto rounded-[var(--radius-control)] border">
                {candidates.map((p) => (
                  <li key={p.id}>
                    <ToggleRow
                      checked={userIds.has(p.id)}
                      onToggle={() => setUserIds((s) => toggle(s, p.id))}
                      label={p.fullName}
                      hint={
                        p.jobName === null
                          ? t.org.noJob
                          : `${p.departmentName ?? "—"} — ${p.jobName}`
                      }
                      flat
                    />
                  </li>
                ))}
                {candidates.length === 0 && (
                  <li className="text-content-muted p-3 text-center text-xs">
                    {t.org.noEmployeeMatches}
                  </li>
                )}
              </ul>
            )}
          </div>
        </fieldset>
      )}

      {error !== null && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </form>
  );
}

function ToggleRow({
  checked,
  onToggle,
  label,
  hint,
  flat = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  hint: string;
  flat?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "hover:bg-surface-sunken flex w-full items-start gap-2.5 p-2.5 text-start",
        flat ? "" : "border-border rounded-[var(--radius-control)] border",
        checked ? "bg-brand-500/5" : "",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded border",
          checked ? "border-brand-600 bg-brand-600 text-white" : "border-border-strong",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-content text-sm">{label}</span>
        <span className="text-content-muted text-xs">{hint}</span>
      </span>
    </button>
  );
}
