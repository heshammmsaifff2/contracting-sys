import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Spinner } from "../ui/Spinner";
import { t } from "@i18n/index";

/**
 * الهيكل العام: شريط جانبي + شريط علوي + منطقة المحتوى، باتجاه RTL.
 *
 * الارتفاع `h-screen` لا `min-h-screen` عمدًا: الشريط الجانبي يحتاج ارتفاعًا
 * محدودًا ليمرّر قائمته داخليًا، وإلا طال بطول محتواه وغرقت آخر الشاشات
 * تحت حافة النافذة.
 *
 * وعلى الجوال يظهر الشريط كدرج: قبل ذلك كان `hidden md:block` يعني أن
 * الهاتف بلا أي وسيلة تنقّل إطلاقًا.
 */
export function AppShell() {
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="bg-surface-muted flex h-screen overflow-hidden" dir="rtl">
      <aside className="border-border hidden border-s md:block">
        <Sidebar />
      </aside>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label={t.common.close}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="border-border absolute inset-y-0 end-0 border-s shadow-xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Suspense
            fallback={
              <div className="grid min-h-64 place-items-center">
                <Spinner />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
