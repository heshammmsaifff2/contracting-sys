import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Spinner } from "../ui/Spinner";

/**
 * الهيكل العام: شريط جانبي + شريط علوي + منطقة المحتوى، باتجاه RTL.
 *
 * الشاشات محمَّلة كسولًا (انظر `router/routes.tsx`)، فتحتاج حدَّ Suspense.
 * موضعه هنا حول المحتوى وحده لا حول الصفحة كلها: الشريطان يبقيان ظاهرين
 * أثناء تحميل الشاشة، فلا تومض الواجهة كاملة عند كل تنقّل.
 */
export function AppShell() {
  return (
    <div className="bg-surface-muted flex min-h-screen" dir="rtl">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
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
