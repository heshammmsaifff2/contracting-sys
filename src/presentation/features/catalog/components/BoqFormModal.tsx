import { useState, type FormEvent } from "react";
import type { BoqItemDto } from "@application/modules/catalog/dtos";
import { Button } from "@presentation/shared/ui/Button";
import { Input } from "@presentation/shared/ui/Input";
import { Checkbox } from "@presentation/shared/ui/Checkbox";
import { FormField } from "@presentation/shared/ui/FormField";
import { Modal } from "@presentation/shared/ui/Modal";
import { errorMessage } from "@presentation/shared/lib/query";
import { useCreateBoqItem, useUpdateBoqItem } from "../hooks/useCatalog";
import { t } from "@i18n/index";

export interface BoqFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** null = إضافة بند جديد. */
  boqItem: BoqItemDto | null;
}

// يُركَّب بـ key يتغيّر مع البند المعروض، فتُهيَّأ الحقول من الخصائص مباشرة.
export function BoqFormModal({ isOpen, onClose, boqItem }: BoqFormModalProps) {
  const isEditing = boqItem !== null;
  const createBoqItem = useCreateBoqItem();
  const updateBoqItem = useUpdateBoqItem();

  const [code, setCode] = useState(boqItem?.code ?? "");
  const [name, setName] = useState(boqItem?.name ?? "");
  const [unit, setUnit] = useState(boqItem?.unit ?? "");
  const [description, setDescription] = useState(boqItem?.description ?? "");
  const [isActive, setIsActive] = useState(boqItem?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      code,
      name,
      unit,
      description: description.trim() === "" ? null : description,
      isActive,
    };

    try {
      if (isEditing) {
        await updateBoqItem.mutateAsync({ ...payload, id: boqItem.id });
      } else {
        await createBoqItem.mutateAsync(payload);
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const isPending = createBoqItem.isPending || updateBoqItem.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t.boq.editTitle : t.boq.createTitle}
      footer={
        <>
          <Button type="submit" form="boq-form" isLoading={isPending}>
            {t.common.save}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
        </>
      }
    >
      <form id="boq-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <FormField label={t.boq.code} required>
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

        <FormField label={t.boq.unit} required>
          {(id) => (
            <Input
              id={id}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="م2 / م3 / متر طولي"
              required
            />
          )}
        </FormField>

        <FormField label={t.boq.name} required className="sm:col-span-2">
          {(id) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
        </FormField>

        <FormField label={t.boq.description} className="sm:col-span-2">
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
