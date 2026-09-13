/**
 * مطابقة بحثٍ عربيّ متسامحة.
 *
 * الكلمة العربية الواحدة تُكتب بصور عدّة: «مُدير» و«مدير»، «إدارة» و«اداره»،
 * «مصطفى» و«مصطفي». المطابقة الحرفية تُخفي ما يبحث عنه المستخدم فعلًا،
 * فتُطوى الصور إلى صورة واحدة قبل المقارنة.
 */

// التشكيل (ً … ٟ) والألف الخنجرية والتطويل — لا الأرقام الهندية (٠ … ٩) التي تليها
const DIACRITICS = /[ً-ٰٟـ]/g;

export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(DIACRITICS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** البحث الفارغ يطابق كل شيء. */
export function matchesArabic(haystack: string, query: string): boolean {
  const needle = normalizeArabic(query);
  return needle === "" || normalizeArabic(haystack).includes(needle);
}
