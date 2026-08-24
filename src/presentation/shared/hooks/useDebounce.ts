import { useEffect, useState } from "react";

/**
 * يؤخّر انتشار القيمة — يمنع إرسال طلب بحث مع كل حرف يكتبه المستخدم.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
