-- ═══════════════════════════════════════════════════════════════════════
-- Phase 2 — الأصناف والبنود والبحث العربي
-- ═══════════════════════════════════════════════════════════════════════

-- تُنقل لاحقًا إلى schema extensions في هجرة مستقلّة (انظر 130400)
create extension if not exists pg_trgm;

-- تطبيع النص العربي: حذف التشكيل والتطويل، وتوحيد صور الألف والهمزة والتاء المربوطة
-- والألف المقصورة. بدونه لا يجد المستخدم «إسمنت» عند كتابة «اسمنت».
-- immutable لأنها تُستخدم في عمود مولَّد وفهارس تعبيرية.
create or replace function public.normalize_ar(input text)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select lower(
    translate(
      regexp_replace(input, '[ًٌٍَُِّْـٰ]', '', 'g'),
      'أإآٱؤئةى',
      'ااااويهي'
    )
  );
$$;

comment on function public.normalize_ar(text) is
  'توحيد صور الحروف العربية ليعمل البحث بأي كلمة مهما اختلف الرسم.';

-- ── items ──────────────────────────────────────────────────────────────
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null,
  category text,
  description text,
  is_active boolean not null default true,
  searchable tsvector generated always as (
    to_tsvector(
      'simple',
      public.normalize_ar(
        coalesce(code, '') || ' ' || coalesce(name, '') || ' ' ||
        coalesce(category, '') || ' ' || coalesce(description, '')
      )
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.items is
  'الأصناف — تُدخَل مرة واحدة وتُستدعى بالكود في كل مستند لاحق.';

create index if not exists items_searchable_idx on public.items using gin (searchable);
create index if not exists items_name_trgm_idx
  on public.items using gin (public.normalize_ar(name) gin_trgm_ops);
create index if not exists items_category_idx on public.items (category);

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at before update on public.items
  for each row execute function public.set_updated_at();

drop trigger if exists items_set_created_by on public.items;
create trigger items_set_created_by before insert on public.items
  for each row execute function public.set_created_by();

-- ── boq_items — البنود ─────────────────────────────────────────────────
create table if not exists public.boq_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null,
  description text,
  is_active boolean not null default true,
  searchable tsvector generated always as (
    to_tsvector(
      'simple',
      public.normalize_ar(
        coalesce(code, '') || ' ' || coalesce(name, '') || ' ' || coalesce(description, '')
      )
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists boq_items_searchable_idx
  on public.boq_items using gin (searchable);
create index if not exists boq_items_name_trgm_idx
  on public.boq_items using gin (public.normalize_ar(name) gin_trgm_ops);

drop trigger if exists boq_items_set_updated_at on public.boq_items;
create trigger boq_items_set_updated_at before update on public.boq_items
  for each row execute function public.set_updated_at();

drop trigger if exists boq_items_set_created_by on public.boq_items;
create trigger boq_items_set_created_by before insert on public.boq_items
  for each row execute function public.set_created_by();

-- ── item_boq_map — تكوين البند من أصناف ────────────────────────────────
create table if not exists public.item_boq_map (
  boq_item_id uuid not null references public.boq_items (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete restrict,
  quantity_per_unit numeric(16, 4) not null default 1
    check (quantity_per_unit > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  primary key (boq_item_id, item_id)
);

comment on column public.item_boq_map.quantity_per_unit is
  'كمية الصنف اللازمة لوحدة واحدة من البند';

create index if not exists item_boq_map_item_idx on public.item_boq_map (item_id);

drop trigger if exists item_boq_map_set_created_by on public.item_boq_map;
create trigger item_boq_map_set_created_by before insert on public.item_boq_map
  for each row execute function public.set_created_by();

-- ── القوائم المحفوظة — قوائم افتراضية للمخازن ──────────────────────────
create table if not exists public.saved_item_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

drop trigger if exists saved_item_lists_set_updated_at on public.saved_item_lists;
create trigger saved_item_lists_set_updated_at before update on public.saved_item_lists
  for each row execute function public.set_updated_at();

create table if not exists public.saved_item_list_lines (
  list_id uuid not null references public.saved_item_lists (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  default_qty numeric(16, 3) not null default 0 check (default_qty >= 0),
  primary key (list_id, item_id)
);

-- ── البحث بأي كلمة ─────────────────────────────────────────────────────
-- SECURITY INVOKER: تسري عليها سياسات RLS الخاصة بجدول items.
create or replace function public.search_items(p_query text, p_limit int default 50)
returns setof public.items
language sql
stable
set search_path = public, pg_temp
as $$
  select i.*
  from public.items i
  where
    coalesce(btrim(p_query), '') = ''
    or i.searchable @@ plainto_tsquery('simple', public.normalize_ar(p_query))
    or public.normalize_ar(i.name) like '%' || public.normalize_ar(p_query) || '%'
    or public.normalize_ar(i.code) like '%' || public.normalize_ar(p_query) || '%'
  order by
    case
      when public.normalize_ar(i.code) = public.normalize_ar(coalesce(p_query, ''))
      then 0 else 1
    end,
    ts_rank(i.searchable, plainto_tsquery('simple', public.normalize_ar(coalesce(p_query, '')))) desc,
    i.name
  limit least(coalesce(p_limit, 50), 200);
$$;

comment on function public.search_items(text, int) is
  'بحث فوري في الأصناف بأي كلمة: tsvector للكلمات الكاملة + trigram للأجزاء، بعد تطبيع الحروف.';

create or replace function public.search_boq_items(p_query text, p_limit int default 50)
returns setof public.boq_items
language sql
stable
set search_path = public, pg_temp
as $$
  select b.*
  from public.boq_items b
  where
    coalesce(btrim(p_query), '') = ''
    or b.searchable @@ plainto_tsquery('simple', public.normalize_ar(p_query))
    or public.normalize_ar(b.name) like '%' || public.normalize_ar(p_query) || '%'
    or public.normalize_ar(b.code) like '%' || public.normalize_ar(p_query) || '%'
  order by
    case
      when public.normalize_ar(b.code) = public.normalize_ar(coalesce(p_query, ''))
      then 0 else 1
    end,
    b.name
  limit least(coalesce(p_limit, 50), 200);
$$;
