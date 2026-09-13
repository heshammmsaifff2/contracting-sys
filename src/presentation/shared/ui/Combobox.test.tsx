import { beforeAll, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox } from "./Combobox";

beforeAll(() => {
  // jsdom لا يحاكي التمرير
  Element.prototype.scrollIntoView = vi.fn();
});

const OPTIONS = [
  { value: "pm", label: "تشغيلي · الإدارة الهندسية — مدير مشروع" },
  { value: "eng", label: "تشغيلي · الإدارة الهندسية — مهندس" },
  { value: "hr", label: "إداري · شؤون الموظفين — موظف إداري" },
];

function Harness({
  initial = "",
  onChange = () => {},
}: {
  initial?: string;
  onChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Combobox
      aria-label="الوظيفة"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      placeholder="اختر الوظيفة"
      emptyOptionLabel="بلا وظيفة"
      noMatchesText="لا نتائج"
    />
  );
}

function input(): HTMLInputElement {
  return screen.getByRole("combobox", { name: "الوظيفة" });
}

describe("Combobox — البحث في الحقل نفسه", () => {
  it("مغلقًا يعرض الخيار المختار", () => {
    render(<Harness initial="eng" />);
    expect(input().value).toBe("تشغيلي · الإدارة الهندسية — مهندس");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("الكتابة تُصفّي الخيارات، والضغط يختار ويُغلق", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(input());
    await user.type(input(), "مهندس");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);

    await user.click(options[0]!);
    expect(onChange).toHaveBeenCalledWith("eng");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input().value).toBe("تشغيلي · الإدارة الهندسية — مهندس");
  });

  it("يطابق مع اختلاف الهمزة، و Enter يختار المظلَّل", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(input());
    await user.type(input(), "شئون");
    expect(screen.queryAllByRole("option")).toHaveLength(0);

    await user.clear(input());
    await user.type(input(), "اداري{Enter}");
    expect(onChange).toHaveBeenCalledWith("hr");
  });

  it("الأسهم تتنقّل بين الخيارات", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(input());
    // الأوّل «بلا وظيفة»، ثم «مدير مشروع»، ثم «مهندس»
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("eng");
  });

  it("Esc يُغلق بلا تغيير ويعيد عرض المختار", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="pm" onChange={onChange} />);

    await user.click(input());
    await user.type(input(), "لا يوجد");
    expect(screen.getByText("لا نتائج")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe("تشغيلي · الإدارة الهندسية — مدير مشروع");
  });

  it("الخيار الفارغ يُفرغ القيمة", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial="pm" onChange={onChange} />);

    await user.click(input());
    await user.click(screen.getByRole("option", { name: "بلا وظيفة" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
