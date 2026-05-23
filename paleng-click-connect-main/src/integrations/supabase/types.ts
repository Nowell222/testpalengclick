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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string
          created_at: string
          id: string
          published_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          published_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          published_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cashier_shifts: {
        Row: {
          actual_ending_cash: number | null
          cashier_id: string
          closed_at: string | null
          id: string
          notes: string | null
          opened_at: string
          starting_cash: number
          status: string
          system_computed_cash: number | null
        }
        Insert: {
          actual_ending_cash?: number | null
          cashier_id: string
          closed_at?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          starting_cash?: number
          status?: string
          system_computed_cash?: number | null
        }
        Update: {
          actual_ending_cash?: number | null
          cashier_id?: string
          closed_at?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          starting_cash?: number
          status?: string
          system_computed_cash?: number | null
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          paid_date: string | null
          schedule_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          paid_date?: string | null
          schedule_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          paid_date?: string | null
          schedule_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "payment_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          last_at: string | null
          last_message: string | null
          vendor_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          last_at?: string | null
          last_message?: string | null
          vendor_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          last_at?: string | null
          last_message?: string | null
          vendor_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
          thread_id: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
          thread_id: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          thread_id?: string
          type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read_status: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_status?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_status?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_schedules: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          payment_type: string
          stall_id: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          payment_type?: string
          stall_id?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          payment_type?: string
          stall_id?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_submissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          ocr_amount: number | null
          ocr_datetime: string | null
          ocr_raw: string | null
          ocr_recipient: string | null
          ocr_reference: string | null
          payment_id: string | null
          payment_method: string
          payment_type: string
          period_month: number
          period_year: number
          processed_at: string | null
          processed_by: string | null
          receipt_path: string
          receipt_url: string
          rejection_reason: string | null
          stall_id: string | null
          status: string
          updated_at: string
          vendor_id: string
          vendor_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          ocr_amount?: number | null
          ocr_datetime?: string | null
          ocr_raw?: string | null
          ocr_recipient?: string | null
          ocr_reference?: string | null
          payment_id?: string | null
          payment_method?: string
          payment_type?: string
          period_month: number
          period_year: number
          processed_at?: string | null
          processed_by?: string | null
          receipt_path: string
          receipt_url: string
          rejection_reason?: string | null
          stall_id?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
          vendor_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          ocr_amount?: number | null
          ocr_datetime?: string | null
          ocr_raw?: string | null
          ocr_recipient?: string | null
          ocr_reference?: string | null
          payment_id?: string | null
          payment_method?: string
          payment_type?: string
          period_month?: number
          period_year?: number
          processed_at?: string | null
          processed_by?: string | null
          receipt_path?: string
          receipt_url?: string
          rejection_reason?: string | null
          stall_id?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
          vendor_user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          payment_method: string
          payment_type: string
          paymongo_source_id: string | null
          period_month: number | null
          period_year: number | null
          processed_by: string | null
          receipt_number: string | null
          reference_number: string | null
          shift_id: string | null
          stall_id: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method: string
          payment_type?: string
          paymongo_source_id?: string | null
          period_month?: number | null
          period_year?: number | null
          processed_by?: string | null
          receipt_number?: string | null
          reference_number?: string | null
          shift_id?: string | null
          stall_id?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_method?: string
          payment_type?: string
          paymongo_source_id?: string | null
          period_month?: number | null
          period_year?: number | null
          processed_by?: string | null
          receipt_number?: string | null
          reference_number?: string | null
          shift_id?: string | null
          stall_id?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          contact_number: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          middle_name: string | null
          status: string
          updated_at: string
          user_id: string
          avatar_url: string | null
        }
        Insert: {
          address?: string | null
          contact_number?: string | null
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          middle_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
          avatar_url?: string | null
        }
        Update: {
          address?: string | null
          contact_number?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          middle_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          avatar_url?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          subscription: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          subscription: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          subscription?: Json
          user_id?: string
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          id: string
          message: string
          recipient: string
          recipient_user_id: string | null
          sent_at: string
          sent_by: string | null
          status: string
          type: string
        }
        Insert: {
          id?: string
          message: string
          recipient: string
          recipient_user_id?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          type: string
        }
        Update: {
          id?: string
          message?: string
          recipient?: string
          recipient_user_id?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      stall_fee_schedules: {
        Row: {
          amount: number
          created_at: string
          id: string
          month: number
          note: string | null
          stall_id: string
          updated_at: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          month: number
          note?: string | null
          stall_id: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          month?: number
          note?: string | null
          stall_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "stall_fee_schedules_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
        ]
      }
      stalls: {
        Row: {
          created_at: string
          id: string
          location: string | null
          monthly_rate: number
          monthly_rate_2026: number | null
          monthly_rate_2027: number | null
          monthly_rate_2028: number | null
          section: string
          stall_number: string
          status: string
          updated_at: string
          area_measurement: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          monthly_rate?: number
          monthly_rate_2026?: number | null
          monthly_rate_2027?: number | null
          monthly_rate_2028?: number | null
          section?: string
          stall_number: string
          status?: string
          updated_at?: string
          area_measurement?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          monthly_rate?: number
          monthly_rate_2026?: number | null
          monthly_rate_2027?: number | null
          monthly_rate_2028?: number | null
          section?: string
          stall_number?: string
          status?: string
          updated_at?: string
          area_measurement?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          award_date: string | null
          created_at: string
          documents: string | null
          id: string
          qr_code: string | null
          stall_id: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
          business_permit_number: string | null
          award_receipt_number: string | null
          award_payment_date: string | null
        }
        Insert: {
          award_date?: string | null
          created_at?: string
          documents?: string | null
          id?: string
          qr_code?: string | null
          stall_id?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
          business_permit_number?: string | null
          award_receipt_number?: string | null
          award_payment_date?: string | null
        }
        Update: {
          award_date?: string | null
          created_at?: string
          documents?: string | null
          id?: string
          qr_code?: string | null
          stall_id?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
          business_permit_number?: string | null
          award_receipt_number?: string | null
          award_payment_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_stall_id_fkey"
            columns: ["stall_id"]
            isOneToOne: false
            referencedRelation: "stalls"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_applications: {
        Row: {
          admin_notes: string | null
          applicant_user_id: string | null
          application_date: string
          applied_at: string
          business_name: string | null
          documents: Json | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone_number: string | null
          preferred_section: string | null
          reviewed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          applicant_user_id?: string | null
          application_date?: string
          applied_at?: string
          business_name?: string | null
          documents?: Json | null
          email: string
          first_name: string
          id?: string
          last_name: string
          phone_number?: string | null
          preferred_section?: string | null
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          applicant_user_id?: string | null
          application_date?: string
          applied_at?: string
          business_name?: string | null
          documents?: Json | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone_number?: string | null
          preferred_section?: string | null
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendor_documents: {
        Row: {
          created_at: string
          document_type: string
          expiry_date: string | null
          file_url: string
          id: string
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          expiry_date?: string | null
          file_url: string
          id?: string
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          expiry_date?: string | null
          file_url?: string
          id?: string
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_landing_page_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_vendor_dashboard_data: { Args: { _user_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_stall_area: {
        Args: { p_stall_id: string; p_area_measurement: string | null }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "cashier" | "vendor" | "bplo" | "eemo"
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
    Enums: {
      app_role: ["admin", "cashier", "vendor", "bplo", "eemo"],
    },
  },
} as const
