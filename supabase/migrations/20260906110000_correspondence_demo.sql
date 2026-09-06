-- ═══════════════════════════════════════════════════════════════════════
-- نسخة تجريبية شاملة لوحدة المراسلات وسير العمل
--
-- شركة مقاولات في شهر عمل: ثلاثة مسارات مختلفة الشكل، ومعاملات في كل
-- حالة (جارية · متأخّرة · مغلقة تنتظر الأرشيف · مؤرشَفة)، ومهامّ يبدؤها
-- النظام بنفسه، وأدوات تشغيل تركت أثرها، وتقييم شهر مضى بقواعده ولقطته.
--
-- الغرض **تجربة يدوية**: كل ما بُني في المراحل ٠١–٠٨ يُرى ويُلمَس في الشاشة.
-- تُبنى بمحرّك العمل نفسه لا بإدراج مباشر: `start_transaction` و
-- `complete_assignment` و`claim_assignment`… فما تراه هو ما سيجري في الإنتاج.
--
-- الحذف بالسجلّ لا بالتخمين: كل صفّ يُسجَّل في `demo_data_objects`.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.seed_correspondence_demo(p_actor uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $seed$
declare
  v_actor uuid := coalesce(p_actor, (select auth.uid()));
  v_u2 uuid; v_u3 uuid; v_u4 uuid;
  v_dep_eng uuid; v_dep_fin uuid; v_dep_adm uuid;
  v_p1 uuid; v_p2 uuid;
  v_def_extract uuid; v_def_circ uuid; v_def_leave uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid; v_s5 uuid;
  v_a1 uuid; v_a2 uuid; v_a3 uuid;
  v_tx uuid; v_asg uuid; v_asg2 uuid; v_log uuid;
  v_task_circ uuid; v_task_notify uuid;
  v_period text := to_char((now() at time zone public.app_timezone()) - interval '1 month', 'YYYY-MM');
  v_when timestamptz := ((v_period || '-15')::date + time '11:00') at time zone public.app_timezone();
  v_txns integer := 0;
begin
  if v_actor is null then
    raise exception 'مرّر معرّف المستخدم الذي تُبنى النسخة باسمه'
      using errcode = 'null_value_not_allowed';
  end if;

  -- المحرّك يقرأ `auth.uid()`، فنُثبّت هوية الفاعل لهذه المعاملة
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_actor::text, 'role', 'authenticated')::text, true);

  -- ثلاثة زملاء غير الفاعل، ليكون للتوازي والحجز والتحويل معنى
  select id into v_u2 from public.profiles
   where is_active and id <> v_actor order by full_name limit 1;
  select id into v_u3 from public.profiles
   where is_active and id <> v_actor and id <> v_u2 order by full_name limit 1;
  select id into v_u4 from public.profiles
   where is_active and id not in (v_actor, coalesce(v_u2, v_actor), coalesce(v_u3, v_actor))
   order by full_name limit 1;
  v_u2 := coalesce(v_u2, v_actor);
  v_u3 := coalesce(v_u3, v_u2);
  v_u4 := coalesce(v_u4, v_u3);

  -- ── ١) الأقسام ───────────────────────────────────────────────────────
  insert into public.departments (name) values ('الهندسة') returning id into v_dep_eng;
  insert into public.departments (name) values ('المالية')  returning id into v_dep_fin;
  insert into public.departments (name) values ('الإدارة')  returning id into v_dep_adm;
  perform public.demo_track('departments', v_dep_eng);
  perform public.demo_track('departments', v_dep_fin);
  perform public.demo_track('departments', v_dep_adm);

  -- التحويل لا يكون إلا لزميل في القسم نفسه، فنضع الفاعل وزميله في الهندسة
  update public.profiles set department_id = v_dep_eng where id in (v_actor, v_u2);
  update public.profiles set department_id = v_dep_fin where id = v_u3;
  update public.profiles set department_id = v_dep_adm where id = v_u4;

  -- ── ٢) المشاريع والتقويم ─────────────────────────────────────────────
  insert into public.projects (code, name, contract_value)
  values ('DEMO-P1', 'برج الإدارة — الرياض', 12500000) returning id into v_p1;
  insert into public.projects (code, name, contract_value)
  values ('DEMO-P2', 'مجمّع سكني — جدة', 8300000) returning id into v_p2;
  perform public.demo_track('projects', v_p1);
  perform public.demo_track('projects', v_p2);

  insert into public.holidays (holiday_date, description, scope)
  values ((date_trunc('month', now())::date + 20), 'إجازة رسمية — تجريبية', 'global');

  -- مدّة معتمدة لكل موظف/نوع [المراسلات ١، ٢، ٦] — تسبق مهلة المرحلة
  insert into public.step_duration_settings (transaction_type, user_id, minutes)
  values ('demo_extract', v_actor, 90), ('demo_extract', v_u2, 150);

  -- ── ٣) المسار الأول: مستخلص مقاول (تفريع متوازٍ + التقاء) ────────────
  insert into public.workflow_definitions (transaction_type, name)
  values ('demo_extract', 'مستخلص مقاول') returning id into v_def_extract;
  perform public.demo_track('workflow_definitions', v_def_extract);

  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, is_start, sla_minutes)
  values (v_def_extract,'preparation','الإعداد',1,true,120) returning id into v_s1;
  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, completion_policy, sla_minutes)
  values (v_def_extract,'tech_review','المراجعة الفنية',2,'all',240) returning id into v_s2;
  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, completion_policy, claim_policy, sla_minutes)
  values (v_def_extract,'pm_review','اعتماد مدير المشروع',3,'any','exclusive',180)
  returning id into v_s3;
  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, join_policy, requires_receive, sla_minutes)
  values (v_def_extract,'audit','التدقيق النهائي',4,'wait_all',true,120) returning id into v_s4;
  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, is_final, is_archive, sla_minutes)
  values (v_def_extract,'archive','الأرشفة',5,true,true,60) returning id into v_s5;

  insert into public.workflow_stage_participants (stage_id, kind, user_id, is_optional, sort_order)
  values (v_s1,'user',v_actor,false,1),
         (v_s2,'user',v_actor,false,1), (v_s2,'user',v_u4,true,2),
         (v_s3,'user',v_actor,false,1), (v_s3,'user',v_u2,false,2),
         (v_s4,'user',v_actor,false,1),
         (v_s5,'user',v_actor,false,1);

  insert into public.workflow_stage_requirements (stage_id, kind, min_attachments, message)
  values (v_s3,'attachment',1,'أرفق صورة المستخلص قبل الموافقة');

  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s1,'send','إرسال للمراجعة','forward',1) returning id into v_a1;
  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s2,'approve','اعتماد فني','forward',1) returning id into v_a2;
  insert into public.workflow_actions
    (stage_id, action_key, label, kind, sort_order, requires_note, return_minutes)
  values (v_s2,'reject','إرجاع للتعديل','backward',2,true,60) returning id into v_a3;
  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s2,'remark','ملاحظة','note',3);

  insert into public.workflow_action_routes (action_id, priority, condition, target_stage_id)
  values (v_a1, 1, '{"op":"is_not_null","field":"project_id"}'::jsonb, v_s2),
         (v_a1, 1, '{"op":"is_not_null","field":"project_id"}'::jsonb, v_s3),
         (v_a1, 9, null, v_s2),
         (v_a2, 10, null, v_s4),
         (v_a3, 10, null, v_s1);

  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s3,'pm_ok','موافقة المدير','forward',1) returning id into v_a1;
  insert into public.workflow_action_routes (action_id, priority, condition, target_stage_id)
  values (v_a1, 10, null, v_s4);

  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s4,'finish','اعتماد وإغلاق','closure',1) returning id into v_a1;
  insert into public.workflow_actions
    (stage_id, action_key, label, kind, sort_order, requires_note)
  values (v_s4,'back_tech','إعادة للفني','backward',2,true) returning id into v_a2;
  insert into public.workflow_action_routes (action_id, priority, condition, target_stage_id)
  values (v_a1, 10, null, v_s5), (v_a2, 10, null, v_s2);

  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s5,'filed','حُفظ في الأرشيف','final',1);

  perform public.publish_workflow_version(v_def_extract);

  -- ── ٤) المسار الثاني: تعميم إداري يبدؤه النظام [القرار ٣] ────────────
  -- مرحلة واحدة، مشاركها **الجمهور**، وسياستها «الكل»:
  -- تعميم على خمسين موظفًا لا يحتاج سطر كود خاصًّا.
  insert into public.workflow_definitions (transaction_type, name)
  values ('demo_circular', 'تعميم إداري') returning id into v_def_circ;
  perform public.demo_track('workflow_definitions', v_def_circ);

  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, is_start, is_final,
     completion_policy, sla_minutes)
  values (v_def_circ,'read_ack','تأكيد القراءة',1,true,true,'all',480)
  returning id into v_s1;
  insert into public.workflow_stage_participants (stage_id, kind, sort_order)
  values (v_s1,'audience',1);
  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s1,'ack','قرأتُ وأقرّ','final',1);

  perform public.publish_workflow_version(v_def_circ);

  -- ── ٥) المسار الثالث: طلب إجازة (نصاب + تأكيد الطالب) ────────────────
  insert into public.workflow_definitions (transaction_type, name)
  values ('demo_leave', 'طلب إجازة') returning id into v_def_leave;
  perform public.demo_track('workflow_definitions', v_def_leave);

  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, is_start, sla_minutes)
  values (v_def_leave,'submitted','تقديم الطلب',1,true,60) returning id into v_s1;
  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, completion_policy, quorum_count, sla_minutes)
  values (v_def_leave,'committee','لجنة الموارد',2,'quorum',2,480) returning id into v_s2;
  insert into public.workflow_stages
    (definition_id, stage_key, name, sort_order, is_final, sla_minutes)
  values (v_def_leave,'confirm','تمام الإنجاز من الطالب',3,true,120) returning id into v_s3;

  -- `requester` = طالب المعاملة نفسه [المراسلات ٩]
  insert into public.workflow_stage_participants (stage_id, kind, user_id, sort_order)
  values (v_s2,'user',v_actor,1), (v_s2,'user',v_u2,2), (v_s2,'user',v_u3,3);
  insert into public.workflow_stage_participants (stage_id, kind, sort_order)
  values (v_s1,'requester',1), (v_s3,'requester',1);

  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s1,'submit','تقديم','forward',1) returning id into v_a1;
  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s2,'grant','موافقة','forward',1) returning id into v_a2;
  insert into public.workflow_actions
    (stage_id, action_key, label, kind, sort_order, requires_note)
  values (v_s2,'deny','رفض','backward',2,true) returning id into v_a3;
  insert into public.workflow_action_routes (action_id, priority, condition, target_stage_id)
  values (v_a1,10,null,v_s2), (v_a2,10,null,v_s3), (v_a3,10,null,v_s1);
  insert into public.workflow_actions (stage_id, action_key, label, kind, sort_order)
  values (v_s3,'confirm_done','أقرّ بتمام الإنجاز','final',1);

  perform public.publish_workflow_version(v_def_leave);

  -- ── ٦) معاملة (أ): جارية — فرعان متوازيان مفتوحان الآن ───────────────
  v_tx := public.start_transaction('demo_extract','مستخلص أعمال حفر — دفعة ٣', v_p1);
  perform public.demo_track('transactions', v_tx);
  v_txns := v_txns + 1;
  select id into v_asg from public.transaction_assignments where transaction_id = v_tx;
  perform public.complete_assignment(v_asg,'send','المستخلص جاهز للمراجعة');

  -- ── ٧) معاملة (ب): متأخّرة، وعليها تحذير ومدّ مهلة وتحويل ────────────
  v_tx := public.start_transaction('demo_extract','مستخلص أعمال خرسانة — دفعة ٧', v_p2);
  perform public.demo_track('transactions', v_tx);
  v_txns := v_txns + 1;
  select id into v_asg from public.transaction_assignments where transaction_id = v_tx;
  -- نُرجِع لحظة الوصول للوراء فيصير العدّاد أحمر [المراسلات ٢٥]
  update public.transaction_assignments
     set arrived_at = now() - interval '6 days' where id = v_asg;
  perform public.send_assignment_alert(v_asg,'warning','تأخّر بلا مبرّر — تحذير رسمي');
  perform public.extend_assignment_deadline(v_asg, 240, 'مدّ لمرّة واحدة لاستكمال المرفقات');

  -- ── ٨) معاملة (ج): مغلقة وتنتظر إيداع الأصل (طابور الأرشيف) ──────────
  v_tx := public.start_transaction('demo_extract','مستخلص أعمال تشطيبات — دفعة ١', v_p1);
  perform public.demo_track('transactions', v_tx);
  v_txns := v_txns + 1;
  select id into v_asg from public.transaction_assignments where transaction_id = v_tx;
  perform public.complete_assignment(v_asg,'send','');
  select ta.id into v_asg from public.transaction_assignments ta
    join public.transaction_stage_instances si on si.id = ta.stage_instance_id
   where si.transaction_id = v_tx and si.stage_key='pm_review' and ta.assignee_id = v_actor;
  perform public.claim_assignment(v_asg);
  perform public.add_transaction_attachment(v_tx,'مستخلص-تشطيبات.pdf',
    '{"public_id":"demo/extract-1","url":"https://example.invalid/extract-1.pdf"}'::jsonb,
    v_asg,'application/pdf',204800);
  perform public.complete_assignment(v_asg,'pm_ok','معتمَد');
  select ta.id into v_asg from public.transaction_assignments ta
    join public.transaction_stage_instances si on si.id = ta.stage_instance_id
   where si.transaction_id = v_tx and si.stage_key='tech_review' and ta.assignee_id = v_actor;
  perform public.complete_assignment(v_asg,'approve','مطابق للمواصفات');
  select ta.id into v_asg from public.transaction_assignments ta
    join public.transaction_stage_instances si on si.id = ta.stage_instance_id
   where si.transaction_id = v_tx and si.stage_key='audit';
  perform public.receive_assignment(v_asg);
  perform public.complete_assignment(v_asg,'finish','اعتماد نهائي');
  select ta.id into v_asg from public.transaction_assignments ta
    join public.transaction_stage_instances si on si.id = ta.stage_instance_id
   where si.transaction_id = v_tx and si.stage_key='archive';
  perform public.complete_assignment(v_asg,'filed','حُفظ ورقيًّا');

  -- ── ٩) معاملة (د): مؤرشَفة بالكامل — المرحلتان تمّتا ─────────────────
  v_tx := public.start_transaction('demo_extract','مستخلص أعمال كهرباء — دفعة ٢', v_p2);
  perform public.demo_track('transactions', v_tx);
  v_txns := v_txns + 1;
  select id into v_asg from public.transaction_assignments where transaction_id = v_tx;
  perform public.complete_assignment(v_asg,'send','');
  select ta.id into v_asg from public.transaction_assignments ta
    join public.transaction_stage_instances si on si.id = ta.stage_instance_id
   where si.transaction_id = v_tx and si.stage_key='pm_review' and ta.assignee_id = v_actor;
  perform public.claim_assignment(v_asg);
  perform public.add_transaction_attachment(v_tx,'مستخلص-كهرباء.pdf',
    '{"public_id":"demo/extract-2","url":"https://example.invalid/extract-2.pdf"}'::jsonb,
    v_asg,'application/pdf',158000);
  perform public.complete_assignment(v_asg,'pm_ok','');
  select ta.id into v_asg from public.transaction_assignments ta
    join public.transaction_stage_instances si on si.id = ta.stage_instance_id
   where si.transaction_id = v_tx and si.stage_key='tech_review' and ta.assignee_id = v_actor;
  perform public.complete_assignment(v_asg,'approve','');
  select ta.id into v_asg from public.transaction_assignments ta
    join public.transaction_stage_instances si on si.id = ta.stage_instance_id
   where si.transaction_id = v_tx and si.stage_key='audit';
  perform public.receive_assignment(v_asg);
  perform public.complete_assignment(v_asg,'finish','');
  select ta.id into v_asg from public.transaction_assignments ta
    join public.transaction_stage_instances si on si.id = ta.stage_instance_id
   where si.transaction_id = v_tx and si.stage_key='archive';
  perform public.complete_assignment(v_asg,'filed','');
  perform public.submit_transaction_original(v_tx,'سُلّم الأصل لأمين الأرشيف');
  perform public.accept_transaction_archive(v_tx,'رفّ ٤ / ملفّ ١٢','نسخة واحدة أصلية');

  -- ── ١٠) معاملة (هـ): طلب إجازة عند اللجنة — نصاب ٢ من ٣ ─────────────
  v_tx := public.start_transaction('demo_leave','إجازة اعتيادية — ٥ أيام', null);
  perform public.demo_track('transactions', v_tx);
  v_txns := v_txns + 1;
  select id into v_asg from public.transaction_assignments where transaction_id = v_tx;
  perform public.complete_assignment(v_asg,'submit','من ١٠ إلى ١٥ الشهر القادم');
  -- عضو واحد وافق: تبقى المرحلة مفتوحة حتى يبلغ النصاب
  select ta.id into v_asg from public.transaction_assignments ta
    join public.transaction_stage_instances si on si.id = ta.stage_instance_id
   where si.transaction_id = v_tx and si.stage_key='committee' and ta.assignee_id = v_actor;
  perform public.complete_assignment(v_asg,'grant','موافق');

  -- ── ١١) المهامّ المجدولة ─────────────────────────────────────────────
  insert into public.scheduled_tasks
    (name, action, transaction_type, subject_template, body_template,
     context, audience, schedule_kind, schedule_spec, shift_to_workday, next_run_at)
  values ('تعميم شهري — سياسة السلامة', 'start_workflow', 'demo_circular',
          -- {{month}} يُملأ من `context` أدناه — القالب بلا سياق يبقى حرفيًّا
          'تعميم السلامة لشهر {{month}}',
          'يُرجى الاطّلاع على تحديث لائحة السلامة وتأكيد القراءة.',
          jsonb_build_object('month',
            to_char(now() at time zone public.app_timezone(), 'YYYY-MM')),
          '{"scope":"company"}'::jsonb, 'monthly',
          '{"time":"08:00","day_of_month":1}'::jsonb, true,
          date_trunc('month', now()) + interval '1 month')
  returning id into v_task_circ;
  perform public.demo_track('scheduled_tasks', v_task_circ);

  insert into public.scheduled_tasks
    (name, action, subject_template, body_template,
     audience, schedule_kind, schedule_spec, next_run_at)
  values ('تذكير أسبوعي — تحديث نسب الإنجاز', 'notify',
          'حدّث نسب الإنجاز قبل نهاية الأسبوع',
          'رجاءً حدّث نسب إنجاز بنود مشروعك قبل الخميس.',
          json_build_object('scope','users','ids',
            json_build_array(v_actor::text, v_u2::text))::jsonb,
          'weekly', '{"time":"09:00","days":[3]}'::jsonb,
          date_trunc('week', now()) + interval '1 week')
  returning id into v_task_notify;
  perform public.demo_track('scheduled_tasks', v_task_notify);

  -- تشغيل التعميم مرّة الآن: معاملة يبدؤها **النظام** بجمهور محلول وقت التشغيل
  perform public.run_scheduled_task_now(v_task_circ);
  insert into public.demo_data_objects (entity, row_id)
  select 'transactions', t.id from public.transactions t
   where t.type = 'demo_circular'
  on conflict do nothing;

  -- ── ١٢) تقييم شهر مضى: مقاييس حقيقية ثم قواعد ثم لقطة ────────────────
  -- تكليفات منتهية بتواريخ الشهر الماضي، لتكون للمقاييس مادّة
  v_tx := public.start_transaction('demo_extract','مستخلص الشهر الماضي — مؤرشَف', v_p1);
  perform public.demo_track('transactions', v_tx);
  v_txns := v_txns + 1;
  select id into v_asg from public.transaction_assignments where transaction_id = v_tx;
  update public.transaction_assignments
     set status='done', completed_at = v_when, arrived_at = v_when - interval '40 minutes',
         score = 95, allocated_minutes = 120
   where id = v_asg;
  update public.transaction_stage_instances
     set status='done', completed_at = v_when
   where transaction_id = v_tx;
  update public.transactions
     set status='completed', is_closed=true, closed_at=v_when where id = v_tx;

  insert into public.evaluation_rules
    (key, name, reason_template, condition, effect, points, per_unit_field, max_points)
  values ('demo_warn_penalty','خصم التحذيرات الرسمية','خُصمت نقاط لتحذيرات رسمية',
          '{"op":"gt","field":"warnings_count","value":0}'::jsonb,'penalty',2,'warnings_count',10);
  insert into public.evaluation_rules (key, name, reason_template, condition, effect, points)
  values ('demo_ontime_bonus','مكافأة الالتزام الكامل','أنجز كل ما لديه في موعده',
          '{"op":"and","args":[{"op":"gte","field":"on_time_ratio","value":1},'
          '{"op":"gt","field":"completed_count","value":0}]}'::jsonb,'bonus',5);
  insert into public.evaluation_rules
    (key, name, reason_template, condition, effect, points, per_unit_field, max_points)
  values ('demo_late_penalty','خصم التأخير','خُصمت نقاط لمعاملات تجاوزت مدّتها',
          '{"op":"gt","field":"late_count","value":0}'::jsonb,'penalty',1,'late_count',8);

  insert into public.demo_data_objects (entity, row_id)
  select 'evaluation_rules', id from public.evaluation_rules where key like 'demo\_%'
  on conflict do nothing;

  -- تقييم يدويّ لبنود السلوك والكفاءة [المراسلات ١١–١٨]
  insert into public.evaluation_scores (user_id, criteria_id, period, score, note, rated_by)
  select v_actor, c.id, v_period,
         case c.key when 'behavior' then 90 when 'efficiency' then 85 else 80 end,
         'تقييم تجريبي', v_actor
  from public.evaluation_criteria c where c.key in ('behavior','efficiency','discipline')
  on conflict do nothing;

  perform public.apply_evaluation_rules(v_period);
  perform public.take_evaluation_snapshot(v_period);

  return jsonb_build_object(
    'seeded', true,
    'actor', v_actor,
    'period', v_period,
    'workflows', 3,
    'transactions', v_txns + (select count(*) from public.transactions where type='demo_circular'),
    'scheduled_tasks', 2
  );
end;
$seed$;

comment on function public.seed_correspondence_demo(uuid) is
  'نسخة تجريبية شاملة لوحدة المراسلات: ثلاثة مسارات ومعاملات في كل حالة '
  'ومهامّ مجدولة وتقييم شهر مضى — تُبنى بمحرّك العمل نفسه.';

revoke all on function public.seed_correspondence_demo(uuid) from public, anon;

-- ── الحذف ──────────────────────────────────────────────────────────────
create or replace function public.clear_correspondence_demo()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $clear$
declare
  v_removed integer := 0;
begin
  delete from public.transactions t
   using public.demo_data_objects d
   where d.entity = 'transactions' and t.id = d.row_id;

  delete from public.scheduled_tasks s
   using public.demo_data_objects d
   where d.entity = 'scheduled_tasks' and s.id = d.row_id;

  -- المسار المنشور مجمَّد، فيُعاد مسودّةً قبل حذف مراحله
  update public.workflow_definitions w
     set status = 'draft', is_active = false
    from public.demo_data_objects d
   where d.entity = 'workflow_definitions' and w.id = d.row_id;
  delete from public.workflow_stages s
   using public.demo_data_objects d
   where d.entity = 'workflow_definitions' and s.definition_id = d.row_id;
  delete from public.workflow_definitions w
   using public.demo_data_objects d
   where d.entity = 'workflow_definitions' and w.id = d.row_id;

  delete from public.evaluation_snapshots where period =
    to_char((now() at time zone public.app_timezone()) - interval '1 month','YYYY-MM');
  delete from public.evaluation_rules r
   using public.demo_data_objects d
   where d.entity = 'evaluation_rules' and r.id = d.row_id;
  delete from public.evaluation_scores where note = 'تقييم تجريبي';

  delete from public.projects p
   using public.demo_data_objects d
   where d.entity = 'projects' and p.id = d.row_id;

  -- القسم مرجعٌ في ملفّ الموظف، فيُفكّ قبل حذفه
  update public.profiles set department_id = null
   where department_id in (
     select row_id from public.demo_data_objects where entity = 'departments');
  delete from public.departments dep
   using public.demo_data_objects d
   where d.entity = 'departments' and dep.id = d.row_id;

  delete from public.holidays where description = 'إجازة رسمية — تجريبية';
  delete from public.step_duration_settings where transaction_type = 'demo_extract';

  select count(*) into v_removed from public.demo_data_objects
   where entity in ('transactions','scheduled_tasks','workflow_definitions',
                    'evaluation_rules','projects','departments');
  delete from public.demo_data_objects
   where entity in ('transactions','scheduled_tasks','workflow_definitions',
                    'evaluation_rules','projects','departments');

  return jsonb_build_object('cleared', true, 'tracked_rows_removed', v_removed);
end;
$clear$;

comment on function public.clear_correspondence_demo is
  'يحذف كل ما ولّدته seed_correspondence_demo بالاعتماد على السجل.';

revoke all on function public.clear_correspondence_demo() from public, anon;
