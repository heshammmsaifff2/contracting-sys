/**
 * إسناد الأدوار لموظف. تغيير الأدوار يغيّر صلاحياته فورًا في RLS،
 * فلا حاجة لأي مزامنة يدوية.
 *
 * **والنافذة تقرأ الموظف حيًّا لا نسخةً منه.** كانت تتلقّى `profile` جاهزًا
 * من الشاشة، وهو صورةٌ التُقطت لحظة فتح النافذة. فيؤشَّر الدور، ويُحفظ في
 * القاعدة، ثم تعود العلامة كما كانت لأن النسخة لم تتغيّر — فيظنّ المستخدم
 * أن الحفظ فشل ويؤشّر ثانيةً. ولذلك صار المُمرَّر **معرّفًا** يُقرأ به الصفّ
 * الحيّ من قائمة الموظفين، فتتحرّك العلامة حين يتحرّك الواقع.
 */
import { useMemo, useState } from "react";
import { Check, Search, ShieldAlert } from "lucide-react";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Modal } from "@presentation/shared/ui/Modal";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useAssignRole,
  useProfiles,
  useRemoveRole,
  useRoles,
} from "../hooks/useIdentity";
import { t } from "@i18n/index";

export interface UserRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** المعرّف وحده — الصفّ يُقرأ حيًّا فلا تتجمّد العلامة على قيمة قديمة. */
  profileId: string;
}

export function UserRolesModal({ isOpen, onClose, profileId }: UserRolesModalProps) {
  const profiles = useProfiles();
  const roles = useRoles();
  const assignRole = useAssignRole();
  const removeRole = useRemoveRole();

  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** الدور الجاري حفظه — يُعطَّل صفّه ويُظهر دورانًا فلا يُضغط مرّتين. */
  const [busyRoleId, setBusyRoleId] = useState<string | null>(null);

  const profile = (profiles.data ?? []).find((p) => p.id === profileId) ?? null;
  const assigned = useMemo(() => new Set(profile?.roleKeys ?? []), [profile?.roleKeys]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = roles.data ?? [];
    if (needle === "") return all;
    return all.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.key.toLowerCase().includes(needle) ||
        (r.description ?? "").toLowerCase().includes(needle),
    );
  }, [roles.data, query]);

  async function toggle(roleId: string, roleName: string, next: boolean) {
    setError(null);
    setBusyRoleId(roleId);
    try {
      if (next) {
        await assignRole.mutateAsync({ userId: profileId, roleId });
      } else {
        await removeRole.mutateAsync({ userId: profileId, roleId });
      }
    } catch (e) {
      setError(`${roleName}: ${errorMessage(e)}`);
    } finally {
      setBusyRoleId(null);
    }
  }

  const isLoading = profiles.isPending || roles.isPending;
  const manyRoles = (roles.data ?? []).length > 8;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.users.manageRolesFor}
      description={profile?.fullName ?? ""}
      size="md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.common.close}
        </Button>
      }
    >
      {isLoading || profile === null ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="text-content-muted flex flex-wrap items-baseline gap-x-2 text-sm">
            <span>{t.users.rolesChosen(assigned.size)}</span>
            <span className="text-content-muted/70 text-xs">
              {t.users.rolesSaveHint}
            </span>
          </div>

          {assigned.size === 0 && (
            <p className="text-warning bg-warning-soft flex items-start gap-2 rounded-[var(--radius-control)] p-2 text-xs">
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {t.users.noRolesWarning}
            </p>
          )}

          {manyRoles && (
            <div className="relative">
              <Search
                aria-hidden
                className="text-content-muted pointer-events-none absolute inset-y-0 start-3 my-auto size-4"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.users.searchRoles}
                className="ps-9"
              />
            </div>
          )}

          {/* صفٌّ كامل قابل للضغط: مربّع الاختيار وحده هدفٌ صغير يصعب إصابته */}
          <ul className="border-border divide-border max-h-[22rem] divide-y overflow-y-auto rounded-[var(--radius-control)] border">
            {visible.map((role) => {
              const isOn = assigned.has(role.key);
              const isBusy = busyRoleId === role.id;
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    disabled={isBusy}
                    onClick={() => void toggle(role.id, role.name, !isOn)}
                    className={[
                      "flex w-full items-start gap-3 p-3 text-start",
                      "hover:bg-surface-sunken disabled:opacity-60",
                      isOn ? "bg-brand-500/5" : "",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden
                      className={[
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded",
                        "border transition-colors",
                        isOn
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-border-strong",
                      ].join(" ")}
                    >
                      {isBusy ? (
                        <span className="border-content-muted size-3 animate-spin rounded-full border-2 border-t-transparent" />
                      ) : isOn ? (
                        <Check className="size-3.5" strokeWidth={3} />
                      ) : null}
                    </span>

                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-content text-sm font-medium">
                        {role.name}
                      </span>
                      <span className="text-content-muted text-xs">
                        {role.description ?? role.key}
                      </span>
                      <span className="text-content-muted/80 text-xs">
                        {t.users.permissionCount(role.permissionKeys.length)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}

            {visible.length === 0 && (
              <li className="text-content-muted p-4 text-center text-sm">
                {t.users.noRoleMatches}
              </li>
            )}
          </ul>
        </div>
      )}

      {error !== null && (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      )}
    </Modal>
  );
}
