-- Phase 8 — فهارس المفاتيح الأجنبية المستخدَمة فعليًا
--
-- مصدر القائمة هو مدقّق أداء Supabase: 127 مفتاحًا أجنبيًا بلا فهرس مغطٍّ.
-- لم نفهرسها كلها عمدًا. الفهرس ليس مجانيًا: كل صف مُدرَج أو محدَّث يدفع
-- ثمنه. فاستُبعدت أعمدة التدقيق (`created_by`, `approved_by`, `updated_by` …)
-- لأنها تُكتَب دائمًا ولا يُبحث بها تقريبًا، واستُبقي منها ما تجمّع عليه
-- تقارير المرحلة فعلًا: من رحّل قيدًا يدويًا، ومن عدّل مدّة.
--
-- الباقي أعمدة يُرشَّح بها في كل شاشة: المشروع، الصنف، البند، المورّد،
-- المقاول، ومفاتيح ربط السطور برؤوسها.

create index if not exists advance_payments_boq_item_id_idx
  on public.advance_payments (boq_item_id);

create index if not exists advance_payments_project_id_idx
  on public.advance_payments (project_id);

create index if not exists auto_letter_rules_project_id_idx
  on public.auto_letter_rules (project_id);

create index if not exists contractor_boq_contracts_boq_item_id_idx
  on public.contractor_boq_contracts (boq_item_id);

create index if not exists custody_invoices_duplicate_of_idx
  on public.custody_invoices (duplicate_of);

create index if not exists custody_invoices_item_id_idx
  on public.custody_invoices (item_id);

create index if not exists custody_invoices_supplier_id_idx
  on public.custody_invoices (supplier_id);

create index if not exists deduction_types_account_code_idx
  on public.deduction_types (account_code);

create index if not exists duration_change_log_changed_by_idx
  on public.duration_change_log (changed_by);

create index if not exists equipment_movements_supervisor_id_idx
  on public.equipment_movements (supervisor_id);

create index if not exists evaluation_scores_criteria_id_idx
  on public.evaluation_scores (criteria_id);

create index if not exists extract_deductions_deduction_type_id_idx
  on public.extract_deductions (deduction_type_id);

create index if not exists extract_lines_boq_item_id_idx
  on public.extract_lines (boq_item_id);

create index if not exists extract_workers_worker_id_idx
  on public.extract_workers (worker_id);

create index if not exists facility_consumption_item_id_idx
  on public.facility_consumption (item_id);

create index if not exists facility_consumption_mandoub_id_idx
  on public.facility_consumption (mandoub_id);

create index if not exists guarantees_contractor_id_idx
  on public.guarantees (contractor_id);

create index if not exists guarantees_project_id_idx
  on public.guarantees (project_id);

create index if not exists idle_equipment_equipment_id_idx
  on public.idle_equipment (equipment_id);

create index if not exists journal_entries_posted_by_idx
  on public.journal_entries (posted_by);

create index if not exists journal_lines_boq_item_id_idx
  on public.journal_lines (boq_item_id);

create index if not exists journal_lines_item_id_idx
  on public.journal_lines (item_id);

create index if not exists labor_pool_project_id_idx
  on public.labor_pool (project_id);

create index if not exists loans_project_id_idx
  on public.loans (project_id);

create index if not exists mandoub_stock_item_id_idx
  on public.mandoub_stock (item_id);

create index if not exists material_request_lines_boq_item_id_idx
  on public.material_request_lines (boq_item_id);

create index if not exists notifications_project_id_idx
  on public.notifications (project_id);

create index if not exists opening_balances_account_id_idx
  on public.opening_balances (account_id);

create index if not exists opening_balances_project_id_idx
  on public.opening_balances (project_id);

create index if not exists payment_batch_items_payment_request_id_idx
  on public.payment_batch_items (payment_request_id);

create index if not exists payment_requests_project_id_idx
  on public.payment_requests (project_id);

create index if not exists payment_requests_supplier_bank_account_id_idx
  on public.payment_requests (supplier_bank_account_id);

create index if not exists posting_rules_credit_account_code_idx
  on public.posting_rules (credit_account_code);

create index if not exists posting_rules_debit_account_code_idx
  on public.posting_rules (debit_account_code);

create index if not exists profiles_department_id_idx
  on public.profiles (department_id);

create index if not exists project_item_limits_boq_item_id_idx
  on public.project_item_limits (boq_item_id);

create index if not exists project_item_limits_item_id_idx
  on public.project_item_limits (item_id);

create index if not exists projects_extracts_officer_id_idx
  on public.projects (extracts_officer_id);

create index if not exists purchase_request_lines_item_id_idx
  on public.purchase_request_lines (item_id);

create index if not exists purchase_request_lines_project_id_idx
  on public.purchase_request_lines (project_id);

create index if not exists purchase_request_sources_material_request_id_idx
  on public.purchase_request_sources (material_request_id);

create index if not exists receipt_request_lines_item_id_idx
  on public.receipt_request_lines (item_id);

create index if not exists receipt_requests_project_id_idx
  on public.receipt_requests (project_id);

create index if not exists saved_item_list_lines_item_id_idx
  on public.saved_item_list_lines (item_id);

create index if not exists site_stock_item_id_idx
  on public.site_stock (item_id);

create index if not exists step_duration_settings_role_id_idx
  on public.step_duration_settings (role_id);

create index if not exists step_duration_settings_user_id_idx
  on public.step_duration_settings (user_id);

create index if not exists stock_movements_facility_id_idx
  on public.stock_movements (facility_id);

create index if not exists stock_movements_item_id_idx
  on public.stock_movements (item_id);

create index if not exists supplier_quote_lines_item_id_idx
  on public.supplier_quote_lines (item_id);

create index if not exists supplier_quotes_supplier_id_idx
  on public.supplier_quotes (supplier_id);

create index if not exists supply_order_lines_item_id_idx
  on public.supply_order_lines (item_id);

create index if not exists supply_order_lines_project_id_idx
  on public.supply_order_lines (project_id);

create index if not exists supply_orders_pr_id_idx
  on public.supply_orders (pr_id);

create index if not exists supply_orders_supplier_id_idx
  on public.supply_orders (supplier_id);

create index if not exists surplus_materials_item_id_idx
  on public.surplus_materials (item_id);

create index if not exists transaction_step_instances_manager_note_visible_to_idx
  on public.transaction_step_instances (manager_note_visible_to);

create index if not exists transaction_step_instances_step_id_idx
  on public.transaction_step_instances (step_id);

create index if not exists transactions_current_step_instance_idx
  on public.transactions (current_step_instance_id);

create index if not exists transactions_definition_id_idx
  on public.transactions (definition_id);

create index if not exists transactions_requested_by_idx
  on public.transactions (requested_by);

create index if not exists transfer_note_lines_item_id_idx
  on public.transfer_note_lines (item_id);

create index if not exists transfer_notes_from_project_id_idx
  on public.transfer_notes (from_project_id);

create index if not exists transfer_notes_to_project_id_idx
  on public.transfer_notes (to_project_id);

create index if not exists workflow_steps_default_assignee_id_idx
  on public.workflow_steps (default_assignee_id);

create index if not exists workflow_steps_department_id_idx
  on public.workflow_steps (department_id);

create index if not exists workflow_steps_role_id_idx
  on public.workflow_steps (role_id);
