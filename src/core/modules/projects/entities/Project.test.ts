import { describe, expect, it } from "vitest";
import { Project } from "./Project";

const BASE = {
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  code: "PRJ-01",
  name: "مشروع تجريبي",
  contractValue: 1_500_000,
  currency: "EGP" as const,
};

describe("Project", () => {
  it("ينشئ مشروعًا صالحًا ويطبّع الكود", () => {
    const project = Project.create({ ...BASE, code: "prj-01" });

    expect(project.ok).toBe(true);
    if (!project.ok) return;
    expect(project.value.code.value).toBe("PRJ-01");
    expect(project.value.contractValue.amount).toBe(1_500_000);
    expect(project.value.contractValue.currency).toBe("EGP");
  });

  it("يرفض قيمة عقد سالبة", () => {
    const project = Project.create({ ...BASE, contractValue: -1 });

    expect(project.ok).toBe(false);
    if (project.ok) return;
    expect(project.error.code).toBe("VALIDATION");
  });

  it("يرفض اسمًا فارغًا وكودًا غير صالح", () => {
    expect(Project.create({ ...BASE, name: " " }).ok).toBe(false);
    expect(Project.create({ ...BASE, code: "مشروع ١" }).ok).toBe(false);
  });

  it("المشروع غير القائم لا يقبل مستندات جديدة", () => {
    const active = Project.create({ ...BASE, status: "active" });
    const completed = Project.create({ ...BASE, status: "completed" });

    expect(active.ok && active.value.acceptsNewDocuments).toBe(true);
    expect(completed.ok && completed.value.acceptsNewDocuments).toBe(false);
  });
});
