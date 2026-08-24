/**
 * ثوابت التطبيق غير القابلة للتغيير من الواجهة.
 * تنبيه: أي رقم عملي (مدد، نسب، حدود عهدة، درجات تقييم) لا يُكتب هنا —
 * مكانه جدول `settings` في قاعدة البيانات ليبقى قابلًا للتعديل من الواجهة.
 */
import type { CurrencyCode } from "@core/shared/value-objects/money";

export const APP_NAME = "نظام إدارة شركات المقاولات";
export const APP_LOCALE = "ar" as const;
export const APP_DIRECTION = "rtl" as const;

/** المرحلة الحالية من خارطة الطريق في CONTEXT.md. */
export const CURRENT_PHASE = 8;

/**
 * قيم احتياطية فقط — المصدر الفعلي هو جدول `settings` في قاعدة البيانات.
 * تُستخدم قبل اكتمال تحميل الإعدادات أو عند تعذّر قراءتها.
 */
export const FALLBACK_CURRENCY: CurrencyCode = "EGP";
export const FALLBACK_VAT_RATE = 14;

/** جذر مجلّدات التخزين لدى مزوّد الملفّات. */
export const STORAGE_ROOT = "erp";

export const MODULES = [
  { key: "procurement", nameAr: "المشتريات", phase: 3 },
  { key: "correspondence", nameAr: "المراسلات والتقييم", phase: 4 },
  { key: "warehouse", nameAr: "المخازن", phase: 5 },
  { key: "accounting", nameAr: "الحسابات", phase: 6 },
  { key: "hr", nameAr: "شؤون الموظفين", phase: 7 },
] as const;
