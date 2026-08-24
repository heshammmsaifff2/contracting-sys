/**
 * النسخة الاختبارية [الحسابات 1] — بيانات يتدرّب عليها الموظف الجديد
 * بلا خوف من إفساد بيانات حقيقية.
 */
export interface DemoDataEntryDto {
  /** اسم الجدول كما سُجّل في `demo_data_objects`. */
  entity: string;
  rowsCount: number;
}

export interface DemoDataStatusDto {
  exists: boolean;
  totalRows: number;
  entries: readonly DemoDataEntryDto[];
}
