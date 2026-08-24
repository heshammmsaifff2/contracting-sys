-- ═══════════════════════════════════════════════════════════════════════
-- Phase 1 — جدول الإعدادات
-- قاعدة ملزِمة من المواصفات: أي رقم أو نسبة أو مدة يجب أن يكون هنا
-- قابلًا للتعديل من الواجهة، لا ثابتًا في الكود.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  category text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.settings is
  'كل الأرقام والنسب والمدد القابلة للتعديل — لا أرقام سحرية في الكود.';

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

create index if not exists settings_category_idx on public.settings (category);
