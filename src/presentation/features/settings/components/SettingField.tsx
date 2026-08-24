/**
 * حقل إعداد واحد.
 *
 * الفكرة: المستخدم يعدّل **معنى** لا JSON. الشاشة تعرف من شكل القيمة نوع
 * الحقل المناسب — رقم، نسبة، وقت، حساب، جدول درجات — وتتولّى هي بناء
 * القيمة بالشكل الذي يفهمه الخادم عند الحفظ.
 *
 * القيم كلها من قاعدة البيانات؛ ما هنا عرضٌ لها فقط.
 */
import { useState } from "react";
import type { AccountDto } from "@application/modules/accounting/dtos";
import { Input } from "@presentation/shared/ui/Input";
import { Select } from "@presentation/shared/ui/Select";
import { cn } from "@presentation/shared/lib/cn";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS, type FieldSpec } from "./setting-fields";
import { t } from "@i18n/index";

export interface SettingFieldProps {
  spec: FieldSpec;
  value: unknown;
  disabled: boolean;
  accounts: readonly AccountDto[];
  onChange: (next: unknown) => void;
}

/** صف في جدول الدرجات: نسبة + درجة، مهما اختلف اسم مفتاح النسبة. */
interface BandRow {
  ratioKey: string;
  ratio: number | null;
  score: number;
}

function readBands(value: unknown): { rows: BandRow[]; ratioKey: string } | null {
  if (!Array.isArray(value)) return null;

  const rows: BandRow[] = [];
  let ratioKey = "";

  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const record = raw as Record<string, unknown>;
    const key = Object.keys(record).find((k) => k.endsWith("_ratio"));
    if (key === undefined || typeof record["score"] !== "number") return null;
    ratioKey = key;
    const ratio = record[key];
    rows.push({
      ratioKey: key,
      ratio: typeof ratio === "number" ? ratio : null,
      score: record["score"],
    });
  }

  return rows.length === 0 ? null : { rows, ratioKey };
}

export function SettingField({
  spec,
  value,
  disabled,
  accounts,
  onChange,
}: SettingFieldProps) {
  switch (spec.kind) {
    case "text":
      return (
        <Input
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "time":
      return (
        <Input
          type="time"
          className="w-40"
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "currency":
      return (
        <Select
          className="w-56"
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          options={CURRENCY_OPTIONS}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "timezone":
      return (
        <Select
          className="w-56"
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          options={TIMEZONE_OPTIONS}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "account":
      return (
        <Select
          className="w-full max-w-md"
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          // الحسابات التجميعية لا يُسجَّل عليها قيد، فلا تُعرض للاختيار
          options={accounts
            .filter((a) => a.isPostable)
            .map((a) => ({ value: a.code, label: `${a.code} — ${a.name}` }))}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
    case "percent":
      return (
        <span className="flex items-center gap-2">
          <Input
            type="number"
            className="w-40"
            value={typeof value === "number" ? String(value) : ""}
            disabled={disabled}
            {...(spec.min === undefined ? {} : { min: spec.min })}
            {...(spec.max === undefined ? {} : { max: spec.max })}
            {...(spec.step === undefined ? {} : { step: spec.step })}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(parsed)) onChange(parsed);
            }}
          />
          {spec.unit !== undefined && (
            <span className="text-content-muted text-sm">{spec.unit}</span>
          )}
        </span>
      );

    case "numberList":
      return (
        <NumberListField
          spec={spec}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      );

    case "numberMap":
      return (
        <NumberMapField
          spec={spec}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      );

    case "scoreBands":
      return <ScoreBandsField value={value} disabled={disabled} onChange={onChange} />;

    case "json":
      return <JsonField value={value} disabled={disabled} onChange={onChange} />;
  }
}

// ── قائمة أرقام مفصولة بفواصل ──────────────────────────────────────────
function NumberListField({
  spec,
  value,
  disabled,
  onChange,
}: Omit<SettingFieldProps, "accounts">) {
  const current = Array.isArray(value)
    ? value.filter((v) => typeof v === "number")
    : [];
  const [text, setText] = useState(current.join("، "));
  const [invalid, setInvalid] = useState(false);

  return (
    <span className="flex items-center gap-2">
      <Input
        className="w-56"
        value={text}
        disabled={disabled}
        hasError={invalid}
        onChange={(e) => {
          setText(e.target.value);
          const parts = e.target.value
            .split(/[,،]/)
            .map((p) => p.trim())
            .filter((p) => p !== "");
          const numbers = parts.map(Number);
          const ok = numbers.length > 0 && numbers.every(Number.isFinite);
          setInvalid(!ok);
          if (ok) onChange(numbers);
        }}
      />
      {spec.unit !== undefined && (
        <span className="text-content-muted text-sm">{spec.unit}</span>
      )}
    </span>
  );
}

// ── كائن من أرقام: صف لكل مفتاح باسمه العربي ───────────────────────────
function NumberMapField({
  spec,
  value,
  disabled,
  onChange,
}: Omit<SettingFieldProps, "accounts">) {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  // ترتيب ثابت حسب التسميات المعرّفة، ثم أي مفتاح جديد لم يُسمَّ بعد
  const labelled = Object.keys(spec.entryLabels ?? {});
  const keys = [
    ...labelled.filter((k) => k in record),
    ...Object.keys(record).filter((k) => !labelled.includes(k)),
  ];

  return (
    <div className="border-border divide-border grid divide-y rounded-[var(--radius-control)] border sm:max-w-md">
      {keys.map((key) => (
        <label key={key} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-content text-sm">{spec.entryLabels?.[key] ?? key}</span>
          <Input
            type="number"
            className="h-8 w-28"
            value={typeof record[key] === "number" ? String(record[key]) : ""}
            disabled={disabled}
            {...(spec.min === undefined ? {} : { min: spec.min })}
            {...(spec.max === undefined ? {} : { max: spec.max })}
            {...(spec.step === undefined ? {} : { step: spec.step })}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (e.target.value === "" || !Number.isFinite(parsed)) return;
              onChange({ ...record, [key]: parsed });
            }}
          />
        </label>
      ))}
    </div>
  );
}

// ── جدول الدرجات: نسبة ⇐ درجة ──────────────────────────────────────────
function ScoreBandsField({
  value,
  disabled,
  onChange,
}: Omit<SettingFieldProps, "accounts" | "spec">) {
  const parsed = readBands(value);

  // شكل غير متوقّع: نعود إلى المحرّر الخام بدل أن نُفسد القيمة
  if (parsed === null) {
    return <JsonField value={value} disabled={disabled} onChange={onChange} />;
  }

  const { rows, ratioKey } = parsed;
  const isMax = ratioKey.startsWith("max");

  function update(index: number, patch: Partial<BandRow>) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next.map((row) => ({ [ratioKey]: row.ratio, score: row.score })));
  }

  return (
    <div className="border-border overflow-hidden rounded-[var(--radius-control)] border sm:max-w-md">
      <div className="bg-surface-sunken text-content-muted grid grid-cols-2 gap-3 px-3 py-2 text-xs">
        <span>{isMax ? "حتى نسبة" : "من نسبة"}</span>
        <span>الدرجة</span>
      </div>
      <div className="divide-border divide-y">
        {rows.map((row, index) => (
          <div
            key={`${ratioKey}-${index}`}
            className="grid grid-cols-2 gap-3 px-3 py-2"
          >
            {row.ratio === null ? (
              // آخر شريحة مفتوحة الطرف: لا نسبة لها، وتعديلها يفسد الترتيب
              <span className="text-content-muted self-center text-xs">
                {isMax ? "ما زاد عن ذلك" : "ما دون ذلك"}
              </span>
            ) : (
              <Input
                type="number"
                className="h-8"
                step={0.05}
                min={0}
                value={String(row.ratio)}
                disabled={disabled}
                onChange={(e) => {
                  const parsedRatio = Number(e.target.value);
                  if (e.target.value === "" || !Number.isFinite(parsedRatio)) return;
                  update(index, { ratio: parsedRatio });
                }}
              />
            )}
            <Input
              type="number"
              className="h-8"
              min={0}
              max={100}
              value={String(row.score)}
              disabled={disabled}
              onChange={(e) => {
                const parsedScore = Number(e.target.value);
                if (e.target.value === "" || !Number.isFinite(parsedScore)) return;
                update(index, { score: parsedScore });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── الملاذ الأخير: تحرير خام لما لا نعرف شكله ──────────────────────────
function JsonField({
  value,
  disabled,
  onChange,
}: Omit<SettingFieldProps, "accounts" | "spec">) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);

  return (
    <div className="flex flex-col gap-1 sm:max-w-md">
      <textarea
        dir="ltr"
        rows={4}
        value={text}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          "bg-surface text-content rounded-[var(--radius-control)] border p-2 font-mono text-xs",
          invalid ? "border-danger" : "border-border-strong",
        )}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid && <p className="text-danger text-xs">{t.settingsPage.invalidJson}</p>}
    </div>
  );
}
