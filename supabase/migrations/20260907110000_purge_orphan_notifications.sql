-- ═══════════════════════════════════════════════════════════════════════
-- الإشعار يموت بموت ما يشير إليه
--
-- `notifications.project_id` مفتاح أجنبيّ بـ `on delete cascade`، فإشعارُ
-- مشروعٍ محذوف يذهب معه. أمّا `entity_type` + `entity_id` فرباطٌ رخو —
-- نصٌّ ومعرّف بلا مفتاح أجنبيّ، لأن الهدف يختلف من صفٍّ لآخر.
--
-- ولا مفتاح أجنبيّ يصلح لعمود يشير إلى سبعة جداول. فالحارس مُشغّل: كل
-- جدول يُشعَر عنه يمسح إشعاراته عند الحذف. وبغيره يبقى الإشعار في الجرس
-- إلى الأبد يشير إلى معاملة لم تعد موجودة — يُفتح فلا يُفتح شيء.
-- ═══════════════════════════════════════════════════════════════════════

/**
 * يمسح إشعارات الصفّ المحذوف. نوع الكيان يأتي وسيطًا للمُشغّل، فالدالّة
 * واحدة لكل الجداول ولا تُكرَّر سبع مرّات.
 *
 * `security definer` لازم: الإشعار قد يكون لموظف آخر، وسياسة الصفّ لا
 * تدع أحدًا يحذف إشعار غيره — وهذا صحيح، والاستثناء هنا للمُشغّل وحده.
 */
create or replace function public.purge_entity_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  delete from public.notifications
   where entity_type = tg_argv[0]
     and entity_id = old.id;
  return old;
end;
$fn$;

-- لا يُستدعى من الواجهة: مُشغّلٌ لا إجراء
revoke all on function public.purge_entity_notifications() from public, anon, authenticated;

/**
 * الجداول التي تُكتب عنها إشعارات ويمكن حذف صفوفها.
 *
 * و`stock_batch` و`consumption_batch` ليسا هنا عمدًا: معرّفهما مولَّد
 * بـ `gen_random_uuid()` ليجمع حركاتٍ متفرّقة، ولا صفَّ له في جدول
 * يُحذف — فلا يُتيَّم إشعارُهما أصلًا.
 */
do $$
declare
  v_map constant text[][] := array[
    ['transactions'    , 'transaction'    ],
    ['scheduled_tasks' , 'scheduled_task' ],
    ['custody_invoices', 'custody_invoice'],
    ['equipment'       , 'equipment'      ],
    ['guarantees'      , 'guarantee'      ]
  ];
  v_table text;
  v_kind  text;
begin
  for i in 1 .. array_length(v_map, 1) loop
    v_table := v_map[i][1];
    v_kind  := v_map[i][2];
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;
    execute format(
      'drop trigger if exists purge_notifications on public.%I', v_table);
    execute format(
      'create trigger purge_notifications after delete on public.%I '
      'for each row execute function public.purge_entity_notifications(%L)',
      v_table, v_kind);
  end loop;
end $$;

-- ── ما تيتّم قبل وجود الحارس ────────────────────────────────────────────
-- يقتصر على الأنواع الخمسة: ما عداها لا جدول له يُسأل عنه.
delete from public.notifications n
 where (n.entity_type, n.entity_id) is distinct from (null, null)
   and case n.entity_type
         when 'transaction'     then not exists (select 1 from public.transactions     x where x.id = n.entity_id)
         when 'scheduled_task'  then not exists (select 1 from public.scheduled_tasks  x where x.id = n.entity_id)
         when 'custody_invoice' then not exists (select 1 from public.custody_invoices x where x.id = n.entity_id)
         when 'equipment'       then not exists (select 1 from public.equipment        x where x.id = n.entity_id)
         when 'guarantee'       then not exists (select 1 from public.guarantees       x where x.id = n.entity_id)
         else false
       end;
