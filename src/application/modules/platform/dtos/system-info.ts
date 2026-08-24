/** ملخّص حالة النظام — يُستخدم في صفحة التحقق من التأسيس (Phase 0). */
export interface ModuleStatusDto {
  key: "procurement" | "correspondence" | "warehouse" | "accounting" | "hr";
  nameAr: string;
  /** المرحلة التي تُنفَّذ فيها هذه الوحدة حسب خارطة الطريق. */
  phase: number;
  status: "planned" | "in_progress" | "ready";
}

export interface SystemInfoDto {
  appName: string;
  environment: string;
  /** المرحلة الحالية من خارطة الطريق. */
  currentPhase: number;
  serverTime: Date;
  modules: readonly ModuleStatusDto[];
}
