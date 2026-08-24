/**
 * يقفل هذا الاختبار قاعدة واحدة: **ما يظهر في القائمة هو ما يُفتح بالرابط.**
 *
 * كانت الصلاحية مكتوبة مرّتين — في عنصر القائمة وفي `routes.tsx` — فانفرط
 * التطابق فعلًا: «تنزيل الكميات» و«حالة العمالة» و«ترحيل كشف البنك» كانت
 * مجموعة تحت حارس أوسع من صلاحيتها، فتُخفى من القائمة ويبقى رابطها مفتوحًا
 * لمن يعرفه. والإعدادات كانت بلا حارس أصلًا.
 *
 * الحراسة صارت من `screenPermission` وحدها، وهذا الاختبار يمنع عودة التكرار.
 * يفحص **شجرة المسارات نفسها** لا نصّ الملف: ما يُفحص هو ما يعمل فعلًا.
 *
 * تنبيه: هذه حراسة تجربة استخدام. المنع الحقيقي في سياسات RLS على الخادم.
 */
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@presentation/shared/layouts/nav-items";
import type { ProtectedRouteProps } from "./ProtectedRoute";
import { routeTree } from "./routes";

/** الشاشات المتاحة لكل مستخدم نشط عمدًا — لا تنمو هذه القائمة بلا قرار. */
const OPEN_TO_EVERYONE: readonly string[] = [
  "/", // لوحة المتابعة: بطاقاتها نفسها مشروطة بالصلاحية
  "/projects", // المشاريع: الصفوف مقصورة على المعتمَد عليها بـ RLS
  "/me", // الخدمة الذاتية [المواصفات: شؤون الموظفين 7]
];

/** مسارات ليست عناصر قائمة — تفاصيل تُفتح من شاشة أخرى. */
const NON_MENU_ROUTES: readonly string[] = ["transactions/:id", "login"];

type PermissionValue = string | readonly string[] | undefined;

interface RouteLike {
  path?: string | undefined;
  element?: unknown;
  children?: readonly RouteLike[] | undefined;
}

function permissionOf(element: unknown): PermissionValue {
  if (!isValidElement(element)) return undefined;
  return (element as ReactElement<Partial<ProtectedRouteProps>>).props.permission;
}

/**
 * يمشي على الشجرة ويُسجّل لكل مسار الصلاحية السارية عليه — أي أقرب
 * `ProtectedRoute` فوقه في الشجرة.
 */
function collect(
  routes: readonly RouteLike[],
  inherited: PermissionValue,
  out: Map<string, PermissionValue>,
): Map<string, PermissionValue> {
  for (const route of routes) {
    const own = permissionOf(route.element) ?? inherited;

    if (route.path !== undefined && route.path !== "*" && route.path !== "/") {
      out.set(route.path.replace(/^\//, ""), own);
    }
    if (route.children !== undefined) collect(route.children, own, out);
  }
  return out;
}

const effective = collect(routeTree as readonly RouteLike[], undefined, new Map());

function sameRequirement(a: PermissionValue, b: PermissionValue): boolean {
  const norm = (v: PermissionValue): string =>
    v === undefined ? "" : [...(typeof v === "string" ? [v] : v)].sort().join("|");
  return norm(a) === norm(b);
}

describe("حراسة الشاشات — القائمة والمسارات مصدر واحد", () => {
  it("كل شاشة في القائمة محروسة بصلاحيتها هي", () => {
    const mismatches: string[] = [];

    for (const item of NAV_ITEMS) {
      if (OPEN_TO_EVERYONE.includes(item.to)) continue;

      const guard = effective.get(item.to.replace(/^\//, ""));

      if (guard === undefined) {
        mismatches.push(`${item.to}: بلا حارس`);
      } else if (!sameRequirement(guard, item.permission)) {
        mismatches.push(
          `${item.to}: الحارس (${String(guard)}) يخالف القائمة (${String(item.permission)})`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("كل مسار في الشجرة يقابل شاشة في القائمة", () => {
    const known = new Set(NAV_ITEMS.map((i) => i.to.replace(/^\//, "")));
    for (const extra of NON_MENU_ROUTES) known.add(extra);

    const orphans = [...effective.keys()].filter((path) => !known.has(path));

    expect(orphans).toEqual([]);
  });

  it("الشاشات المفتوحة للجميع محصورة في قائمة معلومة", () => {
    const openInMenu = NAV_ITEMS.filter((i) => i.permission === undefined).map(
      (i) => i.to,
    );

    expect([...openInMenu].sort()).toEqual([...OPEN_TO_EVERYONE].sort());
  });

  it("الإعدادات وفحص التأسيس خلف صلاحية إدارة الإعدادات", () => {
    expect(effective.get("settings")).toBe("settings.manage");
    expect(effective.get("setup")).toBe("settings.manage");
  });

  it("ترحيل كشف البنك أضيق من اليوميات — لا يُجمعان تحت حارس واحد", () => {
    expect(effective.get("payroll")).toBe("payroll.import");
    expect(effective.get("attendance")).toBe("attendance.read");
  });

  it("تنزيل الكميات أضيق من قراءة المخازن", () => {
    expect(effective.get("consumption")).toBe("consumption.record");
    expect(effective.get("facilities")).toBe("warehouse.read");
  });
});
