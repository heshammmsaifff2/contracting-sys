/**
 * قائمة منسدلة يُبحث فيها من الحقل نفسه.
 *
 * مغلقةً تعرض الخيار المختار كأيّ قائمة. وحين تُفتح يصير الحقل حقل بحث:
 * ما يُكتب يُصفّي الخيارات تحته مباشرة، والأسهم تتنقّل، و Enter يختار،
 * و Esc يُغلق بلا تغيير.
 *
 * القائمة موضوعة `fixed` بقياس الحقل لا `absolute` داخله: النوافذ الحوارية
 * تمرّر محتواها داخل صندوق محدود الارتفاع، والقائمة المطلقة تُقصّ عند حافّته.
 * وتنفتح لأعلى حين لا يتّسع ما تحت الحقل.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { matchesArabic } from "../lib/arabic-search";
import type { SelectOption } from "./Select";

export interface ComboboxProps {
  id?: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** يظهر والحقل فارغ. */
  placeholder: string;
  /** خيار في المقدّمة قيمته "" — مثل «اتركها شاغرة». يُخفى أثناء البحث. */
  emptyOptionLabel?: string;
  noMatchesText: string;
  disabled?: boolean;
  /** يلوّن الحقل تنبيهًا — كخانةٍ شاغرة. */
  hasWarning?: boolean;
  className?: string;
  "aria-label"?: string;
}

type Anchor = { left: number; width: number; maxHeight: number } & (
  { placement: "down"; top: number } | { placement: "up"; bottom: number }
);

const LIST_MAX_HEIGHT = 240;
const GAP = 4;

function measure(element: HTMLElement): Anchor {
  const rect = element.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - 8;
  const above = rect.top - 8;
  const base = { left: rect.left, width: rect.width };

  if (below < 180 && above > below) {
    return {
      ...base,
      placement: "up",
      bottom: window.innerHeight - rect.top + GAP,
      maxHeight: Math.min(LIST_MAX_HEIGHT, above),
    };
  }
  return {
    ...base,
    placement: "down",
    top: rect.bottom + GAP,
    maxHeight: Math.max(120, Math.min(LIST_MAX_HEIGHT, below)),
  };
}

export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  emptyOptionLabel,
  noMatchesText,
  disabled = false,
  hasWarning = false,
  className,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /** null = مغلقة. */
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const isOpen = anchor !== null;
  const selected = options.find((option) => option.value === value) ?? null;
  const emptyOption: SelectOption[] =
    emptyOptionLabel === undefined ? [] : [{ value: "", label: emptyOptionLabel }];

  const items: SelectOption[] = [
    ...(query.trim() === "" ? emptyOption : []),
    ...options.filter((option) => matchesArabic(option.label, query)),
  ];

  function open() {
    if (disabled || wrapperRef.current === null) return;
    setAnchor(measure(wrapperRef.current));
    setQuery("");
    // يبدأ التنقّل من المختار، فيراه المستخدم مظلَّلًا عند الفتح
    const index = [...emptyOption, ...options].findIndex((o) => o.value === value);
    setActive(Math.max(0, index));
  }

  function close() {
    setAnchor(null);
    setQuery("");
  }

  function choose(option: SelectOption) {
    onChange(option.value);
    close();
  }

  // تتبع القائمة الحقلَ حين تُمرَّر النافذة أو تتغيّر أبعادها
  useEffect(() => {
    if (!isOpen) return;
    const update = (event: Event) => {
      if (event.target === listRef.current) return;
      if (wrapperRef.current !== null) setAnchor(measure(wrapperRef.current));
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, isOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) open();
        else setActive((i) => Math.min(i + 1, items.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) open();
        else setActive((i) => Math.max(i - 1, 0));
        return;
      case "Enter": {
        if (!isOpen) return;
        // داخل نموذجٍ، Enter يُرسله — والمقصود هنا اختيار الخيار
        event.preventDefault();
        const item = items[active];
        if (item !== undefined) choose(item);
        return;
      }
      case "Escape":
        if (!isOpen) return;
        // داخل نافذة حوارية، Esc يُغلقها — والمقصود هنا إغلاق القائمة وحدها
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      case "Tab":
        close();
        return;
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          isOpen && items[active] !== undefined ? `${listId}-${active}` : undefined
        }
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        value={isOpen ? query : (selected?.label ?? "")}
        placeholder={isOpen ? (selected?.label ?? placeholder) : placeholder}
        onFocus={open}
        onClick={() => {
          if (!isOpen) open();
        }}
        onChange={(event) => {
          if (!isOpen) open();
          setQuery(event.target.value);
          setActive(0);
        }}
        onBlur={close}
        onKeyDown={handleKeyDown}
        className={cn(
          "bg-surface text-content h-10 w-full rounded-[var(--radius-control)] border ps-3 pe-9 text-sm",
          "placeholder:text-content-muted disabled:bg-surface-sunken disabled:cursor-not-allowed",
          hasWarning && !isOpen
            ? "border-warning bg-warning-soft"
            : "border-border-strong",
        )}
      />
      <ChevronDown
        aria-hidden
        className={cn(
          "text-content-muted pointer-events-none absolute inset-y-0 end-3 my-auto size-4 transition-transform",
          isOpen && "rotate-180",
        )}
      />

      {anchor !== null && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          // يُبقي التركيز في الحقل: بغيره يسبق فقدانُ التركيز الضغطةَ فتُغلق القائمة قبل الاختيار
          onMouseDown={(event) => event.preventDefault()}
          style={{
            position: "fixed",
            left: anchor.left,
            width: anchor.width,
            maxHeight: anchor.maxHeight,
            ...(anchor.placement === "down"
              ? { top: anchor.top }
              : { bottom: anchor.bottom }),
          }}
          className="bg-surface border-border z-50 overflow-y-auto rounded-[var(--radius-control)] border py-1 shadow-lg"
        >
          {items.map((item, index) => (
            <li
              key={item.value === "" ? "__empty__" : item.value}
              id={`${listId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={item.value === value}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(item)}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
                index === active && "bg-surface-sunken",
                item.value === "" ? "text-content-muted" : "text-content",
              )}
            >
              <span className="min-w-0 truncate">{item.label}</span>
              {item.value === value && (
                <Check aria-hidden className="text-brand-600 size-4 shrink-0" />
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li className="text-content-muted px-3 py-2 text-sm">{noMatchesText}</li>
          )}
        </ul>
      )}
    </div>
  );
}
