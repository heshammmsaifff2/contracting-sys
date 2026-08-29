/**
 * نموذج إضافة / تعديل دور وظيفي وتحديد صلاحياته.
 * يتيح إنشاء دور جديد أو تعديل دور قائم مع تحديد الصلاحيات المجمعة حسب الوحدة.
 */
import { useMemo, useState, type FormEvent } from "react";
import { Search, ShieldCheck, CheckSquare, Square } from "lucide-react";
import type { PermissionDto, RoleDto } from "@application/modules/identity/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { FormField } from "@presentation/shared/ui/FormField";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { Modal } from "@presentation/shared/ui/Modal";
import { Badge } from "@presentation/shared/ui/Badge";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useCreateRole,
  usePermissionsCatalog,
  useUpdateRole,
} from "../hooks/useIdentity";
import { t } from "@i18n/index";

export interface RoleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** null = إضافة دور جديد، RoleDto = تعديل دور قائم */
  role: RoleDto | null;
}

const MODULE_ORDER = [
  "core",
  "identity",
  "projects",
  "accounting",
  "procurement",
  "warehouse",
  "workflow",
  "hr",
  "reports",
  "settings",
];

export function RoleFormModal({ isOpen, onClose, role }: RoleFormModalProps) {
  const isEditing = role !== null;
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const catalog = usePermissionsCatalog();

  const [name, setName] = useState(role?.name ?? "");
  const [key, setKey] = useState(role?.key ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const permissions = useMemo(() => catalog.data ?? [], [catalog.data]);

  // تهيئة الصلاحيات المحددة للدور
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (!role) return new Set();
    const active = permissions
      .filter((p) => role.permissionKeys.includes(p.key))
      .map((p) => p.id);
    return new Set(active);
  });

  // تحديث الصلاحيات الأولية بمجرد تحميل الكتالوج إذا كان فارغاً
  const initialPermissionIds = useMemo(() => {
    if (!role || permissions.length === 0) return new Set<string>();
    return new Set(
      permissions
        .filter((p) => role.permissionKeys.includes(p.key))
        .map((p) => p.id),
    );
  }, [role, permissions]);

  // دمج التحديد الأولي إذا كان الدور قيد التعديل
  const activeSelectedIds = useMemo(() => {
    if (!isEditing || selectedIds.size > 0 || initialPermissionIds.size === 0) {
      return selectedIds;
    }
    return initialPermissionIds;
  }, [isEditing, selectedIds, initialPermissionIds]);

  // تصفية وتجميع الصلاحيات حسب الوحدة
  const groupedModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = permissions.filter((p) => {
      if (!q) return true;
      return (
        p.description.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q)
      );
    });

    const map = new Map<string, PermissionDto[]>();
    for (const p of filtered) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }

    // ترتيب الوحدات بترتيب منطقي
    const entries = [...map.entries()];
    entries.sort(([a], [b]) => {
      const ia = MODULE_ORDER.indexOf(a);
      const ib = MODULE_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    return entries;
  }, [permissions, searchQuery]);

  function togglePermission(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const base = new Set(prev.size === 0 && isEditing ? initialPermissionIds : prev);
      if (checked) base.add(id);
      else base.delete(id);
      return base;
    });
  }

  function toggleModule(moduleItems: PermissionDto[], select: boolean) {
    setSelectedIds((prev) => {
      const base = new Set(prev.size === 0 && isEditing ? initialPermissionIds : prev);
      for (const item of moduleItems) {
        if (select) base.add(item.id);
        else base.delete(item.id);
      }
      return base;
    });
  }

  function selectAllGlobal() {
    setSelectedIds(new Set(permissions.map((p) => p.id)));
  }

  function deselectAllGlobal() {
    setSelectedIds(new Set());
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const permissionIds = [...activeSelectedIds];

    try {
      if (isEditing) {
        await updateRole.mutateAsync({
          id: role.id,
          name: name.trim(),
          description: description.trim() || null,
          permissionIds,
        });
      } else {
        await createRole.mutateAsync({
          key: key.trim().toLowerCase(),
          name: name.trim(),
          description: description.trim() || null,
          permissionIds,
        });
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const isPending = createRole.isPending || updateRole.isPending;
  const currentSelectedCount = activeSelectedIds.size;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t.roles.editTitle : t.roles.createTitle}
      {...(isEditing ? { description: role.name } : {})}
      size="lg"
      footer={
        <>
          <Button type="submit" form="role-form" isLoading={isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="role-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* بيانات الدور الأساسية */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.roles.name} required hint={t.roles.nameHint}>
            {(id) => (
              <Input
                id={id}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: مدير مشتريات موقع"
                required
              />
            )}
          </FormField>

          <FormField
            label={t.roles.key}
            required={!isEditing}
            hint={isEditing ? "لا يمكن تعديل المفتاح التعريفي بعد الإنشاء" : t.roles.keyHint}
          >
            {(id) => (
              <Input
                id={id}
                dir="ltr"
                value={key}
                disabled={isEditing}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="site_procurement_manager"
                required={!isEditing}
              />
            )}
          </FormField>
        </div>

        <FormField label={t.roles.description} hint={t.roles.descriptionHint}>
          {(id) => (
            <Input
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر لمسؤوليات هذا الدور وصلاحياته..."
            />
          )}
        </FormField>

        {/* قسم الصلاحيات */}
        <div className="border-border/60 bg-surface-subtle/30 mt-2 flex flex-col gap-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-brand-600 size-5" />
              <span className="text-content font-bold text-sm">{t.roles.permissions}</span>
              <Badge tone="brand">
                {currentSelectedCount} {t.roles.selectedCount}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAllGlobal}
                startIcon={<CheckSquare className="size-3.5" />}
              >
                {t.roles.selectAll}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deselectAllGlobal}
                startIcon={<Square className="size-3.5" />}
              >
                {t.roles.deselectAll}
              </Button>
            </div>
          </div>

          {/* شريط البحث في الصلاحيات */}
          <div className="relative">
            <Search className="text-content-muted absolute right-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.roles.searchPermissions}
              className="pr-9"
            />
          </div>

          {/* قائمة الصلاحيات المجمعة */}
          {catalog.isPending ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : groupedModules.length === 0 ? (
            <p className="text-content-muted py-6 text-center text-sm">
              لا توجد صلاحيات تطابق البحث
            </p>
          ) : (
            <div className="max-h-[380px] space-y-5 overflow-y-auto pr-1">
              {groupedModules.map(([moduleKey, items]) => {
                const moduleLabel =
                  (t.roles.modules as Record<string, string>)[moduleKey] ?? moduleKey;
                const moduleSelectedCount = items.filter((item) =>
                  activeSelectedIds.has(item.id),
                ).length;
                const isAllSelected = moduleSelectedCount === items.length;

                return (
                  <section
                    key={moduleKey}
                    className="border-border/40 bg-surface/50 rounded-lg border p-3"
                  >
                    <div className="mb-3 flex items-center justify-between border-b border-border/30 pb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-content font-bold text-xs">{moduleLabel}</h4>
                        <span className="text-content-muted text-[11px]">
                          ({moduleSelectedCount} / {items.length})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleModule(items, !isAllSelected)}
                      >
                        {isAllSelected ? t.roles.deselectAll : t.roles.selectAll}
                      </Button>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {items.map((permission) => (
                        <Checkbox
                          key={permission.id}
                          label={permission.description}
                          hint={permission.key}
                          checked={activeSelectedIds.has(permission.id)}
                          onChange={(e) =>
                            togglePermission(permission.id, e.target.checked)
                          }
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {error !== null && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
