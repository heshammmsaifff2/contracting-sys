import { useState, type FormEvent } from "react";
import type { ItemDto } from "@application/modules/catalog/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { errorMessage } from "@presentation/shared/lib/query";
import { useCreateItem, useUpdateItem } from "../hooks/useCatalog";
import { t } from "@i18n/index";

export interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** null = إضافة صنف جديد. */
  item: ItemDto | null;
}

// يُركَّب بـ key يتغيّر مع الصنف المعروض، فتُهيَّأ الحقول من الخصائص مباشرة.
export function ItemFormModal({ isOpen, onClose, item }: ItemFormModalProps) {
  const isEditing = item !== null;
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      code,
      name,
      unit,
      category: category.trim() === "" ? null : category,
      description: description.trim() === "" ? null : description,
      isActive,
    };

    try {
      if (isEditing) {
        await updateItem.mutateAsync({ ...payload, id: item.id });
      } else {
        await createItem.mutateAsync(payload);
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const isPending = createItem.isPending || updateItem.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t.items.editTitle : t.items.createTitle}
      footer={
        <>
          <Button type="submit" form="item-form" isLoading={isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form
        id="item-form"
        onSubmit={handleSubmit}
        className="grid gap-4 sm:grid-cols-2"
      >
        <FormField label={t.items.code} required>
          {(id) => (
            <Input
              id={id}
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.items.unit} required>
          {(id) => (
            <Input
              id={id}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="طن / م3 / عدد"
              required
            />
          )}
        </FormField>

        <FormField label={t.items.name} required className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.items.category}>
          {(id) => (
            <Input
              id={id}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          )}
        </FormField>

        <FormField label={t.items.description}>
          {(id) => (
            <Input
              id={id}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </FormField>

        <div className="sm:col-span-2">
          <Checkbox
            label={t.items.active}
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </div>

        {error !== null && (
          <p role="alert" className="text-danger text-sm sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
