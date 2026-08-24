export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_postable: boolean
          name: string
          parent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_postable?: boolean
          name: string
          parent_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_postable?: boolean
          name?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      advance_payments: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          boq_item_id: string | null
          contractor_id: string
          created_at: string
          created_by: string | null
          id: string
          no: number
          notes: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          boq_item_id?: string | null
          contractor_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          boq_item_id?: string | null
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_payments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "boq_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_balances"
            referencedColumns: ["contractor_id"]
          },
          {
            foreignKeyName: "advance_payments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "advance_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_receipts: {
        Row: {
          has_original: boolean
          id: string
          notes: string
          received: boolean
          received_at: string | null
          received_by: string | null
          transaction_id: string
        }
        Insert: {
          has_original?: boolean
          id?: string
          notes?: string
          received?: boolean
          received_at?: string | null
          received_by?: string | null
          transaction_id: string
        }
        Update: {
          has_original?: boolean
          id?: string
          notes?: string
          received?: boolean
          received_at?: string | null
          received_by?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archive_receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "archive_pending_report"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "archive_receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "overdue_transactions_report"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "archive_receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transaction_inbox"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "archive_receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          id: string
          is_temp: boolean
          note: string
          project_id: string
          registered_by: string | null
          status: string
          updated_at: string
          work_date: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_temp?: boolean
          note?: string
          project_id: string
          registered_by?: string | null
          status?: string
          updated_at?: string
          work_date?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_temp?: boolean
          note?: string
          project_id?: string
          registered_by?: string | null
          status?: string
          updated_at?: string
          work_date?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_letter_rules: {
        Row: {
          body_template: string
          created_at: string
          created_by: string | null
          id: string
          interval_days: number | null
          is_active: boolean
          last_run_at: string | null
          next_run_at: string
          project_id: string | null
          recipients: string[]
          repeat: boolean
          schedule_cron: string
          subject: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          body_template?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interval_days?: number | null
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string
          project_id?: string | null
          recipients?: string[]
          repeat?: boolean
          schedule_cron?: string
          subject: string
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          created_by?: string | null
          id?: string
          interval_days?: number | null
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string
          project_id?: string | null
          recipients?: string[]
          repeat?: boolean
          schedule_cron?: string
          subject?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_letter_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "auto_letter_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      boq_items: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          searchable: unknown
          unit: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          searchable?: unknown
          unit: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          searchable?: unknown
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      cheques: {
        Row: {
          bank_name: string
          cheque_no: string
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          payment_request_id: string
          signed_at: string | null
        }
        Insert: {
          bank_name?: string
          cheque_no: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          payment_request_id: string
          signed_at?: string | null
        }
        Update: {
          bank_name?: string
          cheque_no?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          payment_request_id?: string
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cheques_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: true
            referencedRelation: "payment_request_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: true
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_boq_contracts: {
        Row: {
          boq_item_id: string
          contractor_id: string
          created_at: string
          created_by: string | null
          id: string
          max_qty: number
          notes: string
          project_id: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          boq_item_id: string
          contractor_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_qty: number
          notes?: string
          project_id: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          boq_item_id?: string
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          max_qty?: number
          notes?: string
          project_id?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_boq_contracts_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "boq_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_boq_contracts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_balances"
            referencedColumns: ["contractor_id"]
          },
          {
            foreignKeyName: "contractor_boq_contracts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_boq_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "contractor_boq_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          bank: Json
          code: string
          contact: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          searchable: unknown
          updated_at: string
        }
        Insert: {
          bank?: Json
          code: string
          contact?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          searchable?: unknown
          updated_at?: string
        }
        Update: {
          bank?: Json
          code?: string
          contact?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          searchable?: unknown
          updated_at?: string
        }
        Relationships: []
      }
      custodies: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          holder_id: string
          id: string
          is_returned_box: boolean
          notes: string
          opened_at: string
          project_id: string
          serial: number
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          holder_id: string
          id?: string
          is_returned_box?: boolean
          notes?: string
          opened_at?: string
          project_id: string
          serial?: never
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          holder_id?: string
          id?: string
          is_returned_box?: boolean
          notes?: string
          opened_at?: string
          project_id?: string
          serial?: never
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodies_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodies_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "custodies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_invoices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          custody_id: string
          duplicate_of: string | null
          duplicate_reviewed: boolean
          id: string
          image_public_id: string | null
          image_url: string | null
          invoice_date: string
          invoice_no: string
          is_duplicate: boolean
          is_returned: boolean
          item_id: string | null
          note: string
          ocr_text: string
          return_reason: string
          seq: number
          supplier_id: string | null
          supplier_seq_no: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          custody_id: string
          duplicate_of?: string | null
          duplicate_reviewed?: boolean
          id?: string
          image_public_id?: string | null
          image_url?: string | null
          invoice_date?: string
          invoice_no: string
          is_duplicate?: boolean
          is_returned?: boolean
          item_id?: string | null
          note?: string
          ocr_text?: string
          return_reason?: string
          seq?: number
          supplier_id?: string | null
          supplier_seq_no?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          custody_id?: string
          duplicate_of?: string | null
          duplicate_reviewed?: boolean
          id?: string
          image_public_id?: string | null
          image_url?: string | null
          invoice_date?: string
          invoice_no?: string
          is_duplicate?: boolean
          is_returned?: boolean
          item_id?: string | null
          note?: string
          ocr_text?: string
          return_reason?: string
          seq?: number
          supplier_id?: string | null
          supplier_seq_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_invoices_custody_id_fkey"
            columns: ["custody_id"]
            isOneToOne: false
            referencedRelation: "custodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_invoices_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "custody_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_invoices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      deduction_types: {
        Row: {
          account_code: string
          applies_to: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          key: string
          name: string
          rate: number
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_code: string
          applies_to?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          key: string
          name: string
          rate?: number
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_code?: string
          applies_to?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          rate?: number
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deduction_types_account_code_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "deduction_types_account_code_fkey"
            columns: ["account_code"]
            isOneToOne: false
            referencedRelation: "party_balances"
            referencedColumns: ["account_code"]
          },
        ]
      }
      demo_data_objects: {
        Row: {
          created_at: string
          entity: string
          id: number
          row_id: string
        }
        Insert: {
          created_at?: string
          entity: string
          id?: never
          row_id: string
        }
        Update: {
          created_at?: string
          entity?: string
          id?: never
          row_id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      duration_change_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_minutes: number
          old_minutes: number | null
          reason: string
          step_instance_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_minutes: number
          old_minutes?: number | null
          reason?: string
          step_instance_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_minutes?: number
          old_minutes?: number | null
          reason?: string
          step_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duration_change_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duration_change_log_step_instance_id_fkey"
            columns: ["step_instance_id"]
            isOneToOne: false
            referencedRelation: "overdue_transactions_report"
            referencedColumns: ["step_instance_id"]
          },
          {
            foreignKeyName: "duration_change_log_step_instance_id_fkey"
            columns: ["step_instance_id"]
            isOneToOne: false
            referencedRelation: "transaction_inbox"
            referencedColumns: ["step_instance_id"]
          },
          {
            foreignKeyName: "duration_change_log_step_instance_id_fkey"
            columns: ["step_instance_id"]
            isOneToOne: false
            referencedRelation: "transaction_step_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          card_no: string | null
          created_at: string
          created_by: string | null
          hired_at: string | null
          id: string
          national_id: string | null
          notes: string
          phone: string | null
          professions: string[]
          salary_type: string
          updated_at: string
        }
        Insert: {
          card_no?: string | null
          created_at?: string
          created_by?: string | null
          hired_at?: string | null
          id: string
          national_id?: string | null
          notes?: string
          phone?: string | null
          professions?: string[]
          salary_type?: string
          updated_at?: string
        }
        Update: {
          card_no?: string | null
          created_at?: string
          created_by?: string | null
          hired_at?: string | null
          id?: string
          national_id?: string | null
          notes?: string
          phone?: string | null
          professions?: string[]
          salary_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          acquired_at: string | null
          category: string
          code: string
          created_at: string
          created_by: string | null
          current_project_id: string | null
          id: string
          is_active: boolean
          name: string
          photo: Json | null
          spec: Json
          status: string
          updated_at: string
        }
        Insert: {
          acquired_at?: string | null
          category?: string
          code: string
          created_at?: string
          created_by?: string | null
          current_project_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          photo?: Json | null
          spec?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          acquired_at?: string | null
          category?: string
          code?: string
          created_at?: string
          created_by?: string | null
          current_project_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          photo?: Json | null
          spec?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_current_project_id_fkey"
            columns: ["current_project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "equipment_current_project_id_fkey"
            columns: ["current_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_maintenance: {
        Row: {
          cost: number
          created_at: string
          created_by: string | null
          equipment_id: string
          id: string
          kind: string
          next_due_at: string | null
          notes: string
          part: string
          performed_at: string
        }
        Insert: {
          cost?: number
          created_at?: string
          created_by?: string | null
          equipment_id: string
          id?: string
          kind?: string
          next_due_at?: string | null
          notes?: string
          part?: string
          performed_at?: string
        }
        Update: {
          cost?: number
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          id?: string
          kind?: string
          next_due_at?: string | null
          notes?: string
          part?: string
          performed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_maintenance_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_movements: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_id: string
          from_date: string
          id: string
          note: string
          project_id: string
          supervisor_id: string | null
          to_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_id: string
          from_date?: string
          id?: string
          note?: string
          project_id: string
          supervisor_id?: string | null
          to_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          from_date?: string
          id?: string
          note?: string
          project_id?: string
          supervisor_id?: string | null
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_movements_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "equipment_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_movements_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_criteria: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key: string
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      evaluation_exclusions: {
        Row: {
          created_at: string
          created_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_scores: {
        Row: {
          created_at: string
          criteria_id: string
          id: string
          note: string
          period: string
          rated_by: string | null
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          criteria_id: string
          id?: string
          note?: string
          period: string
          rated_by?: string | null
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          criteria_id?: string
          id?: string
          note?: string
          period?: string
          rated_by?: string | null
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_scores_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_scores_rated_by_fkey"
            columns: ["rated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_weights: {
        Row: {
          criteria_id: string
          employee_type: string
          weight: number
        }
        Insert: {
          criteria_id: string
          employee_type: string
          weight: number
        }
        Update: {
          criteria_id?: string
          employee_type?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_weights_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      extract_deductions: {
        Row: {
          account_code: string
          amount: number
          deduction_type_id: string | null
          extract_id: string
          id: string
          key: string
          name: string
          rate: number
        }
        Insert: {
          account_code: string
          amount: number
          deduction_type_id?: string | null
          extract_id: string
          id?: string
          key: string
          name: string
          rate: number
        }
        Update: {
          account_code?: string
          amount?: number
          deduction_type_id?: string | null
          extract_id?: string
          id?: string
          key?: string
          name?: string
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "extract_deductions_deduction_type_id_fkey"
            columns: ["deduction_type_id"]
            isOneToOne: false
            referencedRelation: "deduction_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extract_deductions_extract_id_fkey"
            columns: ["extract_id"]
            isOneToOne: false
            referencedRelation: "extracts"
            referencedColumns: ["id"]
          },
        ]
      }
      extract_lines: {
        Row: {
          boq_item_id: string
          current_qty: number
          extract_id: string
          id: string
          max_qty: number
          notes: string
          prev_qty: number
          unit_price: number
        }
        Insert: {
          boq_item_id: string
          current_qty?: number
          extract_id: string
          id?: string
          max_qty: number
          notes?: string
          prev_qty?: number
          unit_price: number
        }
        Update: {
          boq_item_id?: string
          current_qty?: number
          extract_id?: string
          id?: string
          max_qty?: number
          notes?: string
          prev_qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "extract_lines_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "boq_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extract_lines_extract_id_fkey"
            columns: ["extract_id"]
            isOneToOne: false
            referencedRelation: "extracts"
            referencedColumns: ["id"]
          },
        ]
      }
      extract_workers: {
        Row: {
          deduction: number
          extract_id: string
          id: string
          note: string
          share: number
          worker_id: string
        }
        Insert: {
          deduction?: number
          extract_id: string
          id?: string
          note?: string
          share: number
          worker_id: string
        }
        Update: {
          deduction?: number
          extract_id?: string
          id?: string
          note?: string
          share?: number
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extract_workers_extract_id_fkey"
            columns: ["extract_id"]
            isOneToOne: false
            referencedRelation: "extracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extract_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extracts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          contractor_id: string
          created_at: string
          created_by: string | null
          deductions_amount: number
          extract_date: string
          gross_amount: number
          id: string
          is_final: boolean
          net_amount: number
          no: number
          notes: string
          project_id: string
          retention_released: number
          seq: number
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          contractor_id: string
          created_at?: string
          created_by?: string | null
          deductions_amount?: number
          extract_date?: string
          gross_amount?: number
          id?: string
          is_final?: boolean
          net_amount?: number
          no?: never
          notes?: string
          project_id: string
          retention_released?: number
          seq: number
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          contractor_id?: string
          created_at?: string
          created_by?: string | null
          deductions_amount?: number
          extract_date?: string
          gross_amount?: number
          id?: string
          is_final?: boolean
          net_amount?: number
          no?: never
          notes?: string
          project_id?: string
          retention_released?: number
          seq?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_balances"
            referencedColumns: ["contractor_id"]
          },
          {
            foreignKeyName: "extracts_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "extracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          district: string
          group_name: string
          id: string
          is_active: boolean
          name: string
          project_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          district?: string
          group_name?: string
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          district?: string
          group_name?: string
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "facilities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "facilities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_consumption: {
        Row: {
          batch_id: string
          consumed_at: string
          created_at: string
          created_by: string | null
          facility_id: string
          id: string
          item_id: string
          mandoub_id: string | null
          note: string
          photos: Json
          project_id: string
          qty: number
          supervisor_id: string | null
        }
        Insert: {
          batch_id?: string
          consumed_at?: string
          created_at?: string
          created_by?: string | null
          facility_id: string
          id?: string
          item_id: string
          mandoub_id?: string | null
          note?: string
          photos?: Json
          project_id: string
          qty: number
          supervisor_id?: string | null
        }
        Update: {
          batch_id?: string
          consumed_at?: string
          created_at?: string
          created_by?: string | null
          facility_id?: string
          id?: string
          item_id?: string
          mandoub_id?: string | null
          note?: string
          photos?: Json
          project_id?: string
          qty?: number
          supervisor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_consumption_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_mandoub_id_fkey"
            columns: ["mandoub_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guarantees: {
        Row: {
          amount: number
          bank_name: string
          contractor_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          issued_at: string
          kind: string
          note: string
          project_id: string
          reference_no: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_name?: string
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          issued_at?: string
          kind?: string
          note?: string
          project_id: string
          reference_no?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_name?: string
          contractor_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          issued_at?: string
          kind?: string
          note?: string
          project_id?: string
          reference_no?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guarantees_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_balances"
            referencedColumns: ["contractor_id"]
          },
          {
            foreignKeyName: "guarantees_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "guarantees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          description: string
          holiday_date: string
          id: string
          scope: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          holiday_date: string
          id?: string
          scope?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          holiday_date?: string
          id?: string
          scope?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      idle_equipment: {
        Row: {
          available_from: string
          available_to: string | null
          created_at: string
          created_by: string | null
          equipment_id: string
          id: string
          is_closed: boolean
          note: string
        }
        Insert: {
          available_from?: string
          available_to?: string | null
          created_at?: string
          created_by?: string | null
          equipment_id: string
          id?: string
          is_closed?: boolean
          note?: string
        }
        Update: {
          available_from?: string
          available_to?: string | null
          created_at?: string
          created_by?: string | null
          equipment_id?: string
          id?: string
          is_closed?: boolean
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "idle_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      item_boq_map: {
        Row: {
          boq_item_id: string
          created_at: string
          created_by: string | null
          item_id: string
          quantity_per_unit: number
        }
        Insert: {
          boq_item_id: string
          created_at?: string
          created_by?: string | null
          item_id: string
          quantity_per_unit?: number
        }
        Update: {
          boq_item_id?: string
          created_at?: string
          created_by?: string | null
          item_id?: string
          quantity_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_boq_map_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "boq_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_boq_map_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          searchable: unknown
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          searchable?: unknown
          unit: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          searchable?: unknown
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          created_at: string
          description: string
          entry_date: string
          entry_no: number
          id: string
          is_manual: boolean
          posted_by: string | null
          project_id: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          description?: string
          entry_date?: string
          entry_no?: never
          id?: string
          is_manual?: boolean
          posted_by?: string | null
          project_id?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          created_at?: string
          description?: string
          entry_date?: string
          entry_no?: never
          id?: string
          is_manual?: boolean
          posted_by?: string | null
          project_id?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journal_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          boq_item_id: string | null
          credit: number
          debit: number
          description: string
          entry_id: string
          id: string
          item_id: string | null
          party_id: string | null
          party_type: string | null
        }
        Insert: {
          account_id: string
          boq_item_id?: string | null
          credit?: number
          debit?: number
          description?: string
          entry_id: string
          id?: string
          item_id?: string | null
          party_id?: string | null
          party_type?: string | null
        }
        Update: {
          account_id?: string
          boq_item_id?: string | null
          credit?: number
          debit?: number
          description?: string
          entry_id?: string
          id?: string
          item_id?: string | null
          party_id?: string | null
          party_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "boq_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "manual_entries_report"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "journal_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_pool: {
        Row: {
          available_from: string
          available_to: string | null
          created_at: string
          created_by: string | null
          id: string
          is_closed: boolean
          note: string
          project_id: string | null
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          available_from?: string
          available_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          note?: string
          project_id?: string | null
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          available_from?: string
          available_to?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          note?: string
          project_id?: string | null
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_pool_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "labor_pool_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_pool_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string
          id: string
          installments: number
          no: number
          project_id: string | null
          reason: string
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          id?: string
          installments?: number
          no?: never
          project_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string
          id?: string
          installments?: number
          no?: never
          project_id?: string | null
          reason?: string
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "loans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      mandoub_stock: {
        Row: {
          item_id: string
          project_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          item_id: string
          project_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          item_id?: string
          project_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandoub_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandoub_stock_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mandoub_stock_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandoub_stock_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_request_lines: {
        Row: {
          boq_item_id: string | null
          id: string
          item_id: string
          max_qty: number | null
          prev_requested_qty: number
          remaining_balance: number | null
          request_id: string
          requested_qty: number
        }
        Insert: {
          boq_item_id?: string | null
          id?: string
          item_id: string
          max_qty?: number | null
          prev_requested_qty?: number
          remaining_balance?: number | null
          request_id: string
          requested_qty: number
        }
        Update: {
          boq_item_id?: string | null
          id?: string
          item_id?: string
          max_qty?: number | null
          prev_requested_qty?: number
          remaining_balance?: number | null
          request_id?: string
          requested_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_request_lines_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "boq_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_request_lines_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      material_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          merged_group_id: string | null
          no: number
          notes: string
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          merged_group_id?: string | null
          no?: never
          notes?: string
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          merged_group_id?: string | null
          no?: never
          notes?: string
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "material_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          kind: string
          project_id: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          kind: string
          project_id?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          project_id?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balances: {
        Row: {
          account_id: string
          amount: number
          as_of: string
          created_at: string
          created_by: string | null
          id: string
          notes: string
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          as_of?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          as_of?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "opening_balances_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_batch_items: {
        Row: {
          batch_id: string
          payment_request_id: string
        }
        Insert: {
          batch_id: string
          payment_request_id: string
        }
        Update: {
          batch_id?: string
          payment_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "payment_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_batch_items_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_request_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_batch_items_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_batches: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          kind: string
          no: number
          notes: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          kind: string
          no?: never
          notes?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          no?: never
          notes?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          bank_fee_client: number
          bank_fee_company: number
          created_at: string
          created_by: string | null
          id: string
          no: number
          notes: string
          party_id: string
          party_type: string
          project_id: string | null
          source_id: string
          source_type: string
          status: string
          supplier_bank_account_id: string | null
          transferred_at: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          bank_fee_client?: number
          bank_fee_company?: number
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          party_id: string
          party_type: string
          project_id?: string | null
          source_id: string
          source_type: string
          status?: string
          supplier_bank_account_id?: string | null
          transferred_at?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_fee_client?: number
          bank_fee_company?: number
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          party_id?: string
          party_type?: string
          project_id?: string | null
          source_id?: string
          source_type?: string
          status?: string
          supplier_bank_account_id?: string | null
          transferred_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_supplier_bank_account_id_fkey"
            columns: ["supplier_bank_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          id: string
          key: string
          module: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          key: string
          module?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          key?: string
          module?: string
        }
        Relationships: []
      }
      posting_rules: {
        Row: {
          created_at: string
          credit_account_code: string | null
          debit_account_code: string | null
          description: string
          id: string
          is_active: boolean
          source_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_account_code?: string | null
          debit_account_code?: string | null
          description?: string
          id?: string
          is_active?: boolean
          source_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_account_code?: string | null
          debit_account_code?: string | null
          description?: string
          id?: string
          is_active?: boolean
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_rules_credit_account_code_fkey"
            columns: ["credit_account_code"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "posting_rules_credit_account_code_fkey"
            columns: ["credit_account_code"]
            isOneToOne: false
            referencedRelation: "party_balances"
            referencedColumns: ["account_code"]
          },
          {
            foreignKeyName: "posting_rules_debit_account_code_fkey"
            columns: ["debit_account_code"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "posting_rules_debit_account_code_fkey"
            columns: ["debit_account_code"]
            isOneToOne: false
            referencedRelation: "party_balances"
            referencedColumns: ["account_code"]
          },
        ]
      }
      production_ratings: {
        Row: {
          cost: number
          created_at: string
          created_by: string | null
          id: string
          income: number
          note: string
          period: string
          ratio: number | null
          score: number | null
          worker_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          income?: number
          note?: string
          period: string
          ratio?: number | null
          score?: number | null
          worker_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          income?: number
          note?: string
          period?: string
          ratio?: number | null
          score?: number | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_ratings_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_salaries: {
        Row: {
          base_salary: number
          created_at: string
          currency: string
          daily_wage: number
          profile_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_salary?: number
          created_at?: string
          currency?: string
          daily_wage?: number
          profile_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_salary?: number
          created_at?: string
          currency?: string
          daily_wage?: number
          profile_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_salaries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          email: string | null
          employee_type: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          employee_type?: string
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          employee_type?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_frequency_report"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assignments: {
        Row: {
          can_sign: boolean
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          can_sign?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          can_sign?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_item_limits: {
        Row: {
          boq_item_id: string | null
          created_at: string
          created_by: string | null
          item_id: string
          max_qty: number
          project_id: string
          updated_at: string
        }
        Insert: {
          boq_item_id?: string | null
          created_at?: string
          created_by?: string | null
          item_id: string
          max_qty: number
          project_id: string
          updated_at?: string
        }
        Update: {
          boq_item_id?: string | null
          created_at?: string
          created_by?: string | null
          item_id?: string
          max_qty?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_item_limits_boq_item_id_fkey"
            columns: ["boq_item_id"]
            isOneToOne: false
            referencedRelation: "boq_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_item_limits_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_item_limits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_item_limits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          code: string
          contract_value: number
          created_at: string
          created_by: string | null
          extracts_officer_id: string | null
          id: string
          manager_id: string | null
          name: string
          owner_entity: string | null
          received_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          contract_value?: number
          created_at?: string
          created_by?: string | null
          extracts_officer_id?: string | null
          id?: string
          manager_id?: string | null
          name: string
          owner_entity?: string | null
          received_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          contract_value?: number
          created_at?: string
          created_by?: string | null
          extracts_officer_id?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          owner_entity?: string | null
          received_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_extracts_officer_id_fkey"
            columns: ["extracts_officer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_lines: {
        Row: {
          id: string
          item_id: string
          pr_id: string
          project_id: string
          qty: number
        }
        Insert: {
          id?: string
          item_id: string
          pr_id: string
          project_id: string
          qty: number
        }
        Update: {
          id?: string
          item_id?: string
          pr_id?: string
          project_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_lines_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "purchase_request_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_sources: {
        Row: {
          material_request_id: string
          purchase_request_id: string
        }
        Insert: {
          material_request_id: string
          purchase_request_id: string
        }
        Update: {
          material_request_id?: string
          purchase_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_sources_material_request_id_fkey"
            columns: ["material_request_id"]
            isOneToOne: false
            referencedRelation: "material_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_sources_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          no: number
          notes: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipt_request_lines: {
        Row: {
          id: string
          item_id: string
          qty: number
          rr_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          item_id: string
          qty: number
          rr_id: string
          unit_price?: number
        }
        Update: {
          id?: string
          item_id?: string
          qty?: number
          rr_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_request_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_request_lines_rr_id_fkey"
            columns: ["rr_id"]
            isOneToOne: false
            referencedRelation: "receipt_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          no: number
          notes: string
          project_id: string
          received_at: string | null
          status: string
          supply_order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          project_id: string
          received_at?: string | null
          status?: string
          supply_order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          project_id?: string
          received_at?: string | null
          status?: string
          supply_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "receipt_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_requests_supply_order_id_fkey"
            columns: ["supply_order_id"]
            isOneToOne: false
            referencedRelation: "supply_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_changes: {
        Row: {
          approved_by: string | null
          created_at: string
          effective_from: string
          id: string
          new_base: number
          new_daily: number
          old_base: number
          old_daily: number
          reason: string
          worker_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          new_base?: number
          new_daily?: number
          old_base?: number
          old_daily?: number
          reason?: string
          worker_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          new_base?: number
          new_daily?: number
          old_base?: number
          old_daily?: number
          reason?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_changes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_changes_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_item_list_lines: {
        Row: {
          default_qty: number
          item_id: string
          list_id: string
        }
        Insert: {
          default_qty?: number
          item_id: string
          list_id: string
        }
        Update: {
          default_qty?: number
          item_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_item_list_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_item_list_lines_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "saved_item_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_item_lists: {
        Row: {
          created_at: string
          id: string
          is_shared: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_shared?: boolean
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_shared?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_item_lists_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          category: string
          created_at: string
          description: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      site_stock: {
        Row: {
          item_id: string
          project_id: string
          quantity: number
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          item_id: string
          project_id: string
          quantity?: number
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          item_id?: string
          project_id?: string
          quantity?: number
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_stock_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "site_stock_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      step_duration_settings: {
        Row: {
          created_at: string
          created_by: string | null
          duration_scope: string
          id: string
          minutes: number
          role_id: string | null
          transaction_type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_scope?: string
          id?: string
          minutes: number
          role_id?: string | null
          transaction_type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_scope?: string
          id?: string
          minutes?: number
          role_id?: string | null
          transaction_type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "step_duration_settings_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_duration_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string
          created_at: string
          created_by: string | null
          direction: string
          facility_id: string | null
          id: string
          item_id: string
          mandoub_id: string | null
          note: string
          project_id: string
          qty: number
        }
        Insert: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          direction: string
          facility_id?: string | null
          id?: string
          item_id: string
          mandoub_id?: string | null
          note?: string
          project_id: string
          qty: number
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          facility_id?: string | null
          id?: string
          item_id?: string
          mandoub_id?: string | null
          note?: string
          project_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_mandoub_id_fkey"
            columns: ["mandoub_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_bank_accounts: {
        Row: {
          account_no: string | null
          bank_name: string
          created_at: string
          created_by: string | null
          iban: string | null
          id: string
          is_default: boolean
          supplier_id: string
        }
        Insert: {
          account_no?: string | null
          bank_name: string
          created_at?: string
          created_by?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean
          supplier_id: string
        }
        Update: {
          account_no?: string | null
          bank_name?: string
          created_at?: string
          created_by?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bank_accounts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quote_lines: {
        Row: {
          id: string
          item_id: string
          quote_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          item_id: string
          quote_id: string
          unit_price: number
        }
        Update: {
          id?: string
          item_id?: string
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quote_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "supplier_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_quotes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string
          pr_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          pr_id: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string
          pr_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quotes_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          code: string
          contact: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          searchable: unknown
          updated_at: string
        }
        Insert: {
          code: string
          contact?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          searchable?: unknown
          updated_at?: string
        }
        Update: {
          code?: string
          contact?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          searchable?: unknown
          updated_at?: string
        }
        Relationships: []
      }
      supply_order_lines: {
        Row: {
          id: string
          item_id: string
          project_id: string
          qty: number
          so_id: string
          unit_price: number
        }
        Insert: {
          id?: string
          item_id: string
          project_id: string
          qty: number
          so_id: string
          unit_price: number
        }
        Update: {
          id?: string
          item_id?: string
          project_id?: string
          qty?: number
          so_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supply_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_order_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "supply_order_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_order_lines_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "supply_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_orders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          no: number
          notes: string
          pr_id: string
          status: string
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          pr_id: string
          status?: string
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          no?: never
          notes?: string
          pr_id?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "supply_orders_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      surplus_materials: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          note: string
          project_id: string
          qty: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          note?: string
          project_id: string
          qty: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          note?: string
          project_id?: string
          qty?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surplus_materials_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surplus_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "surplus_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_step_instances: {
        Row: {
          allocated_minutes: number | null
          arrived_at: string | null
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          manager_note: string
          manager_note_visible_to: string | null
          name: string
          notes: string
          order_no: number
          score: number | null
          status: string
          step_id: string | null
          transaction_id: string
        }
        Insert: {
          allocated_minutes?: number | null
          arrived_at?: string | null
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          manager_note?: string
          manager_note_visible_to?: string | null
          name?: string
          notes?: string
          order_no: number
          score?: number | null
          status?: string
          step_id?: string | null
          transaction_id: string
        }
        Update: {
          allocated_minutes?: number | null
          arrived_at?: string | null
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          manager_note?: string
          manager_note_visible_to?: string | null
          name?: string
          notes?: string
          order_no?: number
          score?: number | null
          status?: string
          step_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_step_instances_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_step_instances_manager_note_visible_to_fkey"
            columns: ["manager_note_visible_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_step_instances_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_step_instances_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "archive_pending_report"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transaction_step_instances_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "overdue_transactions_report"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transaction_step_instances_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_inbox"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transaction_step_instances_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          current_step_instance_id: string | null
          definition_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_closed: boolean
          no: number
          project_id: string | null
          requested_by: string | null
          status: string
          subject: string
          type: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_step_instance_id?: string | null
          definition_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_closed?: boolean
          no?: never
          project_id?: string | null
          requested_by?: string | null
          status?: string
          subject?: string
          type: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_step_instance_id?: string | null
          definition_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_closed?: boolean
          no?: never
          project_id?: string | null
          requested_by?: string | null
          status?: string
          subject?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_current_step_fkey"
            columns: ["current_step_instance_id"]
            isOneToOne: false
            referencedRelation: "overdue_transactions_report"
            referencedColumns: ["step_instance_id"]
          },
          {
            foreignKeyName: "transactions_current_step_fkey"
            columns: ["current_step_instance_id"]
            isOneToOne: false
            referencedRelation: "transaction_inbox"
            referencedColumns: ["step_instance_id"]
          },
          {
            foreignKeyName: "transactions_current_step_fkey"
            columns: ["current_step_instance_id"]
            isOneToOne: false
            referencedRelation: "transaction_step_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_note_lines: {
        Row: {
          id: string
          item_id: string
          note_id: string
          qty: number
          unit_cost: number
        }
        Insert: {
          id?: string
          item_id: string
          note_id: string
          qty: number
          unit_cost?: number
        }
        Update: {
          id?: string
          item_id?: string
          note_id?: string
          qty?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "transfer_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_note_lines_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "transfer_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_notes: {
        Row: {
          created_at: string
          created_by: string | null
          from_project_id: string
          id: string
          no: number
          notes: string
          status: string
          to_project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_project_id: string
          id?: string
          no?: never
          notes?: string
          status?: string
          to_project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_project_id?: string
          id?: string
          no?: never
          notes?: string
          status?: string
          to_project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_notes_from_project_id_fkey"
            columns: ["from_project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transfer_notes_from_project_id_fkey"
            columns: ["from_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_notes_to_project_id_fkey"
            columns: ["to_project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transfer_notes_to_project_id_fkey"
            columns: ["to_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          scope: string
          start_time: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          scope?: string
          start_time: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          scope?: string
          start_time?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_recommendations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          note: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note: string
          worker_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          note?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_recommendations_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_definitions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      workflow_steps: {
        Row: {
          created_at: string
          default_assignee_id: string | null
          definition_id: string
          department_id: string | null
          id: string
          is_archive: boolean
          is_program_manager: boolean
          name: string
          order_no: number
          role_id: string | null
        }
        Insert: {
          created_at?: string
          default_assignee_id?: string | null
          definition_id: string
          department_id?: string | null
          id?: string
          is_archive?: boolean
          is_program_manager?: boolean
          name: string
          order_no: number
          role_id?: string | null
        }
        Update: {
          created_at?: string
          default_assignee_id?: string | null
          definition_id?: string
          department_id?: string | null
          id?: string
          is_archive?: boolean
          is_program_manager?: boolean
          name?: string
          order_no?: number
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_default_assignee_id_fkey"
            columns: ["default_assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department_frequency_report"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "workflow_steps_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      archive_pending_report: {
        Row: {
          closed_at: string | null
          created_at: string | null
          days_pending: number | null
          has_original: boolean | null
          notes: string | null
          project_id: string | null
          project_name: string | null
          received: boolean | null
          received_at: string | null
          requested_by: string | null
          requested_by_name: string | null
          subject: string | null
          transaction_id: string | null
          transaction_no: number | null
          transaction_status: string | null
          transaction_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_balances: {
        Row: {
          contractor_code: string | null
          contractor_id: string | null
          contractor_name: string | null
          deductions_total: number | null
          extracts_count: number | null
          gross_total: number | null
          net_total: number | null
          paid_total: number | null
          project_id: string | null
          project_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "extracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      department_frequency_report: {
        Row: {
          avg_score: number | null
          department_id: string | null
          department_name: string | null
          done_count: number | null
          transaction_type: string | null
          transactions_count: number | null
          visits_count: number | null
          visits_per_transaction: number | null
        }
        Relationships: []
      }
      duration_change_report: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          change_id: string | null
          changed_after_completion: boolean | null
          changed_at: string | null
          changed_by: string | null
          changed_by_name: string | null
          delta_minutes: number | null
          new_minutes: number | null
          old_minutes: number | null
          order_no: number | null
          project_id: string | null
          project_name: string | null
          reason: string | null
          step_instance_id: string | null
          step_name: string | null
          subject: string | null
          transaction_id: string | null
          transaction_no: number | null
          transaction_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duration_change_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duration_change_log_step_instance_id_fkey"
            columns: ["step_instance_id"]
            isOneToOne: false
            referencedRelation: "overdue_transactions_report"
            referencedColumns: ["step_instance_id"]
          },
          {
            foreignKeyName: "duration_change_log_step_instance_id_fkey"
            columns: ["step_instance_id"]
            isOneToOne: false
            referencedRelation: "transaction_inbox"
            referencedColumns: ["step_instance_id"]
          },
          {
            foreignKeyName: "duration_change_log_step_instance_id_fkey"
            columns: ["step_instance_id"]
            isOneToOne: false
            referencedRelation: "transaction_step_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_step_instances_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_step_instances_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "archive_pending_report"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transaction_step_instances_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "overdue_transactions_report"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transaction_step_instances_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transaction_inbox"
            referencedColumns: ["transaction_id"]
          },
          {
            foreignKeyName: "transaction_step_instances_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_evaluation_summary: {
        Row: {
          completed_steps: number | null
          employee_type: string | null
          full_name: string | null
          period: string | null
          rank_in_period: number | null
          user_id: string | null
          weighted_score: number | null
        }
        Relationships: []
      }
      expiring_guarantees: {
        Row: {
          amount: number | null
          bank_name: string | null
          contractor_id: string | null
          contractor_name: string | null
          days_left: number | null
          expires_at: string | null
          id: string | null
          is_expired: boolean | null
          issued_at: string | null
          kind: string | null
          note: string | null
          project_id: string | null
          project_name: string | null
          reference_no: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guarantees_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractor_balances"
            referencedColumns: ["contractor_id"]
          },
          {
            foreignKeyName: "guarantees_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guarantees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "guarantees_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_consumption_view: {
        Row: {
          batch_id: string | null
          consumed_at: string | null
          district: string | null
          facility_code: string | null
          facility_id: string | null
          facility_name: string | null
          facility_weight: number | null
          group_name: string | null
          id: string | null
          item_code: string | null
          item_id: string | null
          item_name: string | null
          item_unit: string | null
          mandoub_id: string | null
          mandoub_name: string | null
          note: string | null
          photos: Json | null
          project_id: string | null
          project_name: string | null
          qty: number | null
          supervisor_id: string | null
          supervisor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_consumption_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_mandoub_id_fkey"
            columns: ["mandoub_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_waste_report: {
        Row: {
          avg_qty_per_weight: number | null
          deviation_ratio: number | null
          district: string | null
          facility_id: string | null
          facility_name: string | null
          group_name: string | null
          is_wasteful: boolean | null
          item_code: string | null
          item_id: string | null
          item_name: string | null
          item_unit: string | null
          last_consumed_at: string | null
          project_id: string | null
          project_name: string | null
          qty: number | null
          qty_per_weight: number | null
          weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_consumption_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mandoub_stock_view: {
        Row: {
          item_code: string | null
          item_id: string | null
          item_name: string | null
          item_unit: string | null
          mandoub_id: string | null
          mandoub_name: string | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          quantity: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandoub_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandoub_stock_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "mandoub_stock_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandoub_stock_user_id_fkey"
            columns: ["mandoub_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_entries_report: {
        Row: {
          created_at: string | null
          description: string | null
          entry_date: string | null
          entry_id: string | null
          entry_no: number | null
          moves_receivable_to_expense: boolean | null
          posted_by: string | null
          posted_by_name: string | null
          project_id: string | null
          project_name: string | null
          source_type: string | null
          total_credit: number | null
          total_debit: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "journal_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      overdue_transactions_report: {
        Row: {
          allocated_minutes: number | null
          arrived_at: string | null
          assignee_id: string | null
          assignee_name: string | null
          due_at: string | null
          elapsed_minutes: number | null
          elapsed_ratio: number | null
          order_no: number | null
          project_id: string | null
          project_name: string | null
          remaining_minutes: number | null
          step_instance_id: string | null
          step_name: string | null
          subject: string | null
          transaction_id: string | null
          transaction_no: number | null
          transaction_type: string | null
          was_completed_late: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_step_instances_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      party_balances: {
        Row: {
          account_code: string | null
          account_name: string | null
          account_type: string | null
          balance: number | null
          credit_total: number | null
          debit_total: number | null
          last_entry_date: string | null
          lines_count: number | null
          party_code: string | null
          party_id: string | null
          party_name: string | null
          party_type: string | null
        }
        Relationships: []
      }
      payment_request_details: {
        Row: {
          account_no: string | null
          amount: number | null
          bank_fee_client: number | null
          bank_fee_company: number | null
          bank_name: string | null
          created_at: string | null
          id: string | null
          no: number | null
          notes: string | null
          party_code: string | null
          party_id: string | null
          party_name: string | null
          party_type: string | null
          project_id: string | null
          project_name: string | null
          source_id: string | null
          source_type: string | null
          status: string | null
          supplier_bank_account_id: string | null
          transferred_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "payment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_supplier_bank_account_id_fkey"
            columns: ["supplier_bank_account_id"]
            isOneToOne: false
            referencedRelation: "supplier_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      price_comparison: {
        Row: {
          item_code: string | null
          item_id: string | null
          item_name: string | null
          item_unit: string | null
          line_total: number | null
          pr_id: string | null
          price_rank: number | null
          required_qty: number | null
          supplier_code: string | null
          supplier_id: string | null
          supplier_name: string | null
          unit_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_quote_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotes_pr_id_fkey"
            columns: ["pr_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_quotes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_consumption_summary: {
        Row: {
          downloads_count: number | null
          facilities_count: number | null
          item_code: string | null
          item_id: string | null
          item_name: string | null
          item_unit: string | null
          last_consumed_at: string | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          qty: number | null
          qty_per_weight: number | null
          total_weight: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_consumption_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_cost_summary: {
        Row: {
          advance_total: number | null
          committed_total: number | null
          consumed_ratio: number | null
          contract_value: number | null
          custody_total: number | null
          extract_total: number | null
          paid_total: number | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          project_status: string | null
          remaining_budget: number | null
          supply_total: number | null
        }
        Relationships: []
      }
      project_labor_cost: {
        Row: {
          cost: number | null
          daily_wage: number | null
          payable_days: number | null
          period: string | null
          project_id: string | null
          project_name: string | null
          worker_id: string | null
          worker_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_labor_days: {
        Row: {
          absent_days: number | null
          excused_days: number | null
          payable_days: number | null
          period: string | null
          present_days: number | null
          project_code: string | null
          project_id: string | null
          project_name: string | null
          sick_days: number | null
          workers_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_consumption_summary: {
        Row: {
          downloads_count: number | null
          facilities_count: number | null
          last_consumed_at: string | null
          project_id: string | null
          project_name: string | null
          supervisor_id: string | null
          supervisor_name: string | null
          total_qty: number | null
          with_photos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "facility_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_consumption_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_inbox: {
        Row: {
          allocated_minutes: number | null
          arrived_at: string | null
          assignee_id: string | null
          assignee_name: string | null
          awaiting_duration: boolean | null
          color: string | null
          completed_at: string | null
          due_at: string | null
          elapsed_minutes: number | null
          elapsed_ratio: number | null
          manager_note: string | null
          order_no: number | null
          project_id: string | null
          project_name: string | null
          remaining_minutes: number | null
          requested_by: string | null
          score: number | null
          step_instance_id: string | null
          step_name: string | null
          step_status: string | null
          subject: string | null
          transaction_id: string | null
          transaction_no: number | null
          transaction_status: string | null
          transaction_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_step_instances_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_cost_summary"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      account_id_by_setting: { Args: { p_key: string }; Returns: string }
      add_business_minutes: {
        Args: { p_from: string; p_minutes: number; p_user_id?: string }
        Returns: string
      }
      app_timezone: { Args: never; Returns: string }
      approve_advance_payment: {
        Args: { p_advance_id: string }
        Returns: string
      }
      approve_custody: { Args: { p_custody_id: string }; Returns: string }
      approve_extract: { Args: { p_extract_id: string }; Returns: string }
      attendance_day_value: { Args: { p_status: string }; Returns: number }
      business_minutes_between: {
        Args: { p_from: string; p_to: string; p_user_id?: string }
        Returns: number
      }
      can_access_purchase_request: {
        Args: { p_pr_id: string }
        Returns: boolean
      }
      can_access_supply_order: { Args: { p_so_id: string }; Returns: boolean }
      can_read_financial_reports: { Args: never; Returns: boolean }
      can_read_operational_reports: { Args: never; Returns: boolean }
      can_sign_project: { Args: { p_project_id: string }; Returns: boolean }
      cancel_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      change_worker_salary: {
        Args: {
          p_effective_from?: string
          p_new_base: number
          p_new_daily: number
          p_reason?: string
          p_worker_id: string
        }
        Returns: string
      }
      clear_demo_data: { Args: never; Returns: Json }
      close_transaction: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      complete_step: {
        Args: { p_notes?: string; p_step_instance_id: string }
        Returns: string
      }
      confirm_receipt: { Args: { p_rr_id: string }; Returns: string }
      consumption_trend: {
        Args: { p_item_id?: string; p_months?: number; p_project_id?: string }
        Returns: {
          cumulative_qty: number
          downloads_count: number
          period: string
          qty: number
        }[]
      }
      current_permissions: { Args: never; Returns: string[] }
      current_project_ids: { Args: never; Returns: string[] }
      current_vat_rate: { Args: never; Returns: number }
      decide_loan: {
        Args: { p_approve: boolean; p_loan_id: string; p_note?: string }
        Returns: string
      }
      demo_data_status: {
        Args: never
        Returns: {
          entity: string
          rows_count: number
        }[]
      }
      demo_track: { Args: { p_entity: string; p_id: string }; Returns: string }
      generate_extract: {
        Args: {
          p_contractor_id: string
          p_extract_date?: string
          p_project_id: string
        }
        Returns: string
      }
      generate_payment_request: { Args: { p_so_id: string }; Returns: string }
      generate_purchase_request: {
        Args: { p_material_request_ids: string[] }
        Returns: string
      }
      generate_receipt_requests: { Args: { p_so_id: string }; Returns: number }
      generate_supply_order: {
        Args: { p_pr_id: string; p_supplier_id: string }
        Returns: string
      }
      has_permission: { Args: { permission_key: string }; Returns: boolean }
      is_active_user: { Args: never; Returns: boolean }
      is_assigned_to_project: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      is_transaction_participant: {
        Args: { p_transaction_id: string }
        Returns: boolean
      }
      issue_stock_to_mandoub: {
        Args: {
          p_lines: Json
          p_mandoub_id: string
          p_note?: string
          p_project_id: string
        }
        Returns: string
      }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      move_equipment: {
        Args: {
          p_equipment_id: string
          p_from_date?: string
          p_note?: string
          p_project_id: string
          p_supervisor_id?: string
        }
        Returns: string
      }
      normalize_ar: { Args: { input: string }; Returns: string }
      normalize_doc_no: { Args: { p_value: string }; Returns: string }
      notify_expiring_guarantees: { Args: never; Returns: number }
      notify_users: {
        Args: {
          p_body?: string
          p_entity_id?: string
          p_entity_type?: string
          p_kind: string
          p_project_id?: string
          p_title: string
          p_user_ids: string[]
        }
        Returns: number
      }
      open_step_instance: {
        Args: {
          p_order_no: number
          p_step_id: string
          p_transaction_id: string
        }
        Returns: string
      }
      post_accounting_entry: {
        Args: { p_source_id: string; p_source_type: string }
        Returns: string
      }
      post_manual_entry: {
        Args: {
          p_description: string
          p_entry_date: string
          p_lines: Json
          p_project_id: string
        }
        Returns: string
      }
      production_score: { Args: { p_ratio: number }; Returns: number }
      project_members: {
        Args: { p_project_id?: string }
        Returns: {
          can_sign: boolean
          employee_type: string
          full_name: string
          project_id: string
          user_id: string
        }[]
      }
      rate_worker_production: {
        Args: {
          p_income: number
          p_note?: string
          p_period: string
          p_worker_id: string
        }
        Returns: string
      }
      record_facility_consumption: {
        Args: {
          p_consumed_at?: string
          p_facility_id: string
          p_lines: Json
          p_mandoub_id: string
          p_note?: string
          p_photos?: Json
        }
        Returns: string
      }
      register_attendance: {
        Args: { p_date: string; p_entries: Json; p_project_id: string }
        Returns: number
      }
      release_equipment: {
        Args: {
          p_available_to?: string
          p_equipment_id: string
          p_note?: string
          p_to_date?: string
        }
        Returns: string
      }
      rescan_custody_duplicates: {
        Args: { p_custody_id: string }
        Returns: number
      }
      resolve_step_assignee: { Args: { p_step_id: string }; Returns: string }
      resolve_step_duration: {
        Args: { p_transaction_type: string; p_user_id: string }
        Returns: {
          created_at: string
          created_by: string | null
          duration_scope: string
          id: string
          minutes: number
          role_id: string | null
          transaction_type: string
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "step_duration_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      return_custody_invoice: {
        Args: { p_invoice_id: string; p_reason?: string }
        Returns: string
      }
      return_mandoub_stock: {
        Args: {
          p_lines: Json
          p_mandoub_id: string
          p_note?: string
          p_project_id: string
        }
        Returns: string
      }
      run_auto_letters: { Args: never; Returns: number }
      score_for_completion: {
        Args: { p_actual_minutes: number; p_allocated_minutes: number }
        Returns: number
      }
      search_boq_items: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          searchable: unknown
          unit: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "boq_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_contractors: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          bank: Json
          code: string
          contact: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          searchable: unknown
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "contractors"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_items: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          category: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          searchable: unknown
          unit: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_suppliers: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          code: string
          contact: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          searchable: unknown
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "suppliers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_transactions_brief: {
        Args: { p_query: string }
        Returns: {
          created_at: string
          is_participant: boolean
          status: string
          transaction_no: number
          transaction_type: string
        }[]
      }
      search_workers: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          card_no: string
          code: string
          employee_type: string
          full_name: string
          id: string
          is_active: boolean
          professions: string[]
          salary_type: string
        }[]
      }
      seed_demo_data: { Args: { p_actor?: string }; Returns: Json }
      set_step_duration: {
        Args: {
          p_minutes: number
          p_reason?: string
          p_scope?: string
          p_step_instance_id: string
        }
        Returns: undefined
      }
      set_worker_status: {
        Args: {
          p_available_from?: string
          p_available_to?: string
          p_note?: string
          p_project_id?: string
          p_status: string
          p_worker_id: string
        }
        Returns: string
      }
      start_transaction: {
        Args: {
          p_entity_id?: string
          p_entity_type?: string
          p_project_id?: string
          p_subject: string
          p_type: string
        }
        Returns: string
      }
      suggest_attendance: {
        Args: { p_date?: string; p_project_id: string }
        Returns: {
          already_registered: boolean
          card_no: string
          full_name: string
          last_date: string
          last_status: string
          professions: string[]
          worker_id: string
        }[]
      }
      users_to_notify: {
        Args: { p_permission_key: string; p_project_id?: string }
        Returns: string[]
      }
      waste_deviation_ratio: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
