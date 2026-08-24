/**
 * محرّر تكوين البند من الأصناف.
 * هذا التكوين هو ما يجعل النظام يحسب احتياج الأصناف من كمية البند لاحقًا،
 * فلا يُعاد إدخال الكميات يدويًا في طلبات الاحتياج.
 */
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { BoqItemDto } from "@application/modules/catalog/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { Modal } from "@presentation/shared/ui/Modal";
import { Spinner } from "@presentation/shared/ui/Spinner";
import { EmptyState } from "@presentation/shared/ui/EmptyState";
import { useDebounce } from "@presentation/shared/hooks/useDebounce";
import { formatNumber } from "@presentation/shared/lib/formatters";
import { errorMessage } from "@presentation/shared/lib/query";
import {
  useBoqComponents,
  useItemSearch,
  useSetBoqComponents,
} from "../hooks/useCatalog";
import { t } from "@i18n/index";

interface DraftComponent {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit: string;
  quantityPerUnit: number;
}

export interface BoqCompositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  boqItem: BoqItemDto;
}

/** كمية توضيحية لعرض أثر التكوين. */
const PREVIEW_QUANTITY = 10;

export function BoqCompositionModal({
  isOpen,
  onClose,
  boqItem,
}: BoqCompositionModalProps) {
  const saved = useBoqComponents(boqItem.id);
  const save = useSetBoqComponents(boqItem.id);

  const [itemQuery, setItemQuery] = useState("");
  const itemSearch = useItemSearch(useDebounce(itemQuery, 250));

  /**
   * المسودّة تبدأ من المحفوظ ثم تُعدَّل محليًا.
   * null = لم يلمس المستخدم شيئًا بعد، فنعرض المحفوظ كما هو.
   */
  const [draft, setDraft] = useState<DraftComponent[] | null>(null);
  const [pickedItemId, setPickedItemId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const components: DraftComponent[] = useMemo(
    () => draft ?? (saved.data ?? []).map((c) => ({ ...c })),
    [draft, saved.data],
  );

  const usedIds = new Set(components.map((c) => c.itemId));
  const itemOptions = (itemSearch.data ?? [])
    .filter((item) => item.isActive && !usedIds.has(item.id))
    .map((item) => ({ value: item.id, label: `${item.code} — ${item.name}` }));

  function addComponent() {
    const item = (itemSearch.data ?? []).find((i) => i.id === pickedItemId);
    if (item === undefined) return;

    setDraft([
      ...components,
      {
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        itemUnit: item.unit,
        quantityPerUnit: 1,
      },
    ]);
    setPickedItemId("");
  }

  function updateQuantity(itemId: string, quantity: number) {
    setDraft(
      components.map((c) =>
        c.itemId === itemId ? { ...c, quantityPerUnit: quantity } : c,
      ),
    );
  }

  function removeComponent(itemId: string) {
    setDraft(components.filter((c) => c.itemId !== itemId));
  }

  async function handleSave() {
    setError(null);
    try {
      await save.mutateAsync({
        boqItemId: boqItem.id,
        components: components.map((c) => ({
          itemId: c.itemId,
          quantityPerUnit: c.quantityPerUnit,
        })),
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.boq.compositionTitle}
      description={`${boqItem.code} — ${boqItem.name}`}
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
      {saved.isPending ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="bg-surface-sunken flex flex-wrap items-end gap-3 rounded-[var(--radius-control)] p-3">
            <div className="min-w-56 flex-1">
              <Input
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder={t.items.searchPlaceholder}
                aria-label={t.common.search}
                className="mb-2"
              />
              <Select
                options={itemOptions}
                placeholder={t.boq.pickItem}
                value={pickedItemId}
                onChange={(e) => setPickedItemId(e.target.value)}
                aria-label={t.boq.pickItem}
              />
            </div>

            <Button
              onClick={addComponent}
              disabled={pickedItemId === ""}
              startIcon={<Plus aria-hidden className="size-4" />}
            >
              {t.boq.addComponent}
            </Button>
          </div>

          {components.length === 0 ? (
            <EmptyState title={t.boq.noComponents} />
          ) : (
            <>
              <ul className="divide-border divide-y">
                {components.map((component) => (
                  <li
                    key={component.itemId}
                    className="flex flex-wrap items-center gap-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-content block text-sm font-medium">
                        {component.itemName}
                      </span>
                      <span className="text-content-muted font-mono text-xs">
                        {component.itemCode}
                      </span>
                    </span>

                    <label className="flex items-center gap-2">
                      <span className="text-content-muted text-xs">
                        {t.boq.quantityPerUnit}
                      </span>
                      <Input
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        dir="ltr"
                        className="h-8 w-28"
                        value={String(component.quantityPerUnit)}
                        onChange={(e) =>
                          updateQuantity(component.itemId, Number(e.target.value))
                        }
                      />
                      <span className="text-content-muted text-xs">
                        {component.itemUnit}
                      </span>
                    </label>

                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t.boq.removeComponent}
                      onClick={() => removeComponent(component.itemId)}
                      startIcon={<Trash2 aria-hidden className="text-danger size-4" />}
                    />
                  </li>
                ))}
              </ul>

              <div className="border-border rounded-[var(--radius-control)] border border-dashed p-3">
                <p className="text-content-muted mb-2 text-xs">{t.boq.explodeHint}</p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {components.map((component) => (
                    <li key={component.itemId} className="text-content text-xs">
                      {component.itemName}:{" "}
                      <span className="tabular font-medium">
                        {formatNumber(component.quantityPerUnit * PREVIEW_QUANTITY)}{" "}
                        {component.itemUnit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {error !== null && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
