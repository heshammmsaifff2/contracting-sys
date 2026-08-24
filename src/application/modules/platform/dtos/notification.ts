/**
 * الإشعارات — شأن عابر للوحدات: المخازن تُطلقها اليوم، وستطلقها الحسابات
 * وشؤون الموظفين لاحقًا، فمكانها طبقة المنصّة لا وحدة بعينها.
 */
export interface NotificationDto {
  id: string;
  kind: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  projectId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationFilter {
  /** غير المقروءة فقط. */
  unreadOnly: boolean;
  limit: number;
}
