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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      attendance_employees: {
        Row: {
          active: boolean
          cpf: string | null
          created_at: string
          id: string
          name: string
          regime: string
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cpf?: string | null
          created_at?: string
          id?: string
          name: string
          regime?: string
          status?: string
          unit: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cpf?: string | null
          created_at?: string
          id?: string
          name?: string
          regime?: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          created_at: string
          employee_id: string
          entry_date: string
          id: string
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          entry_date: string
          id?: string
          status: string
          unit: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          entry_date?: string
          id?: string
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "attendance_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          device_info: string | null
          freelancer_id: string | null
          freelancer_name: string | null
          gps_coordinates: Json | null
          id: string
          new_status: string | null
          old_status: string | null
          unit: string | null
          user_email: string | null
          user_id: string | null
          user_profile: string | null
        }
        Insert: {
          action: string
          created_at?: string
          device_info?: string | null
          freelancer_id?: string | null
          freelancer_name?: string | null
          gps_coordinates?: Json | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          unit?: string | null
          user_email?: string | null
          user_id?: string | null
          user_profile?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          device_info?: string | null
          freelancer_id?: string | null
          freelancer_name?: string | null
          gps_coordinates?: Json | null
          id?: string
          new_status?: string | null
          old_status?: string | null
          unit?: string | null
          user_email?: string | null
          user_id?: string | null
          user_profile?: string | null
        }
        Relationships: []
      }
      cash_entries: {
        Row: {
          cash_deposited: number
          cash_in: number
          created_at: string
          entry_date: string
          expense_amount: number
          expense_reason: string | null
          id: string
          unit: string
          updated_at: string
        }
        Insert: {
          cash_deposited?: number
          cash_in?: number
          created_at?: string
          entry_date?: string
          expense_amount?: number
          expense_reason?: string | null
          id?: string
          unit: string
          updated_at?: string
        }
        Update: {
          cash_deposited?: number
          cash_in?: number
          created_at?: string
          entry_date?: string
          expense_amount?: number
          expense_reason?: string | null
          id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          accuracy: number | null
          checked_in_at: string
          created_at: string
          device_info: string | null
          freelancer_id: string | null
          id: string
          image_url: string | null
          ip_address: string | null
          latitude: number | null
          longitude: number | null
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          checked_in_at?: string
          created_at?: string
          device_info?: string | null
          freelancer_id?: string | null
          id?: string
          image_url?: string | null
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          status?: string
          unit: string
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          checked_in_at?: string
          created_at?: string
          device_info?: string | null
          freelancer_id?: string | null
          id?: string
          image_url?: string | null
          ip_address?: string | null
          latitude?: number | null
          longitude?: number | null
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_restrictions: {
        Row: {
          created_at: string
          id: string
          is_disabled: boolean
          role: string
          store_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_disabled?: boolean
          role: string
          store_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_disabled?: boolean
          role?: string
          store_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          created_at: string
          daily_rate: number
          expires_at: string | null
          freelancer_cpf: string | null
          freelancer_email: string | null
          freelancer_id: string | null
          freelancer_name: string
          id: string
          issued_at: string
          signed_at: string | null
          signed_file_url: string | null
          status: string
          unit: string | null
          updated_at: string
          zapsign_token: string | null
        }
        Insert: {
          created_at?: string
          daily_rate?: number
          expires_at?: string | null
          freelancer_cpf?: string | null
          freelancer_email?: string | null
          freelancer_id?: string | null
          freelancer_name: string
          id?: string
          issued_at?: string
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          zapsign_token?: string | null
        }
        Update: {
          created_at?: string
          daily_rate?: number
          expires_at?: string | null
          freelancer_cpf?: string | null
          freelancer_email?: string | null
          freelancer_id?: string | null
          freelancer_name?: string
          id?: string
          issued_at?: string
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          zapsign_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer_registry"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_admission_registry: {
        Row: {
          cpf: string
          created_at: string
          email: string
          endereco: string
          estado_civil: string
          funcao: string
          id: string
          loja: string
          nome: string
          pix: string
          rg: string
          role: string
          telefone: string
          updated_at: string
        }
        Insert: {
          cpf?: string
          created_at?: string
          email?: string
          endereco?: string
          estado_civil?: string
          funcao?: string
          id?: string
          loja?: string
          nome: string
          pix?: string
          rg?: string
          role?: string
          telefone?: string
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          email?: string
          endereco?: string
          estado_civil?: string
          funcao?: string
          id?: string
          loja?: string
          nome?: string
          pix?: string
          rg?: string
          role?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      freelancer_registry: {
        Row: {
          active: boolean
          cpf: string
          created_at: string
          email: string
          endereco: string
          estado_civil: string
          id: string
          nome: string
          pix: string
          rg: string
          role: string
          telefone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cpf?: string
          created_at?: string
          email?: string
          endereco?: string
          estado_civil?: string
          id?: string
          nome: string
          pix?: string
          rg?: string
          role?: string
          telefone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cpf?: string
          created_at?: string
          email?: string
          endereco?: string
          estado_civil?: string
          id?: string
          nome?: string
          pix?: string
          rg?: string
          role?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      freelancers: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          checkin_id: string | null
          created_at: string
          daily_rate: number
          deliveries_count: number | null
          deliveries_total: number | null
          entry_date: string
          id: string
          name: string
          paid_at: string | null
          paid_by: string | null
          payment_amount_paid: number | null
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          payment_voucher_url: string | null
          pix: string
          receipt_token: string | null
          rejection_reason: string | null
          role: string
          unit: string
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          validation_status: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          checkin_id?: string | null
          created_at?: string
          daily_rate?: number
          deliveries_count?: number | null
          deliveries_total?: number | null
          entry_date?: string
          id?: string
          name: string
          paid_at?: string | null
          paid_by?: string | null
          payment_amount_paid?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          payment_voucher_url?: string | null
          pix: string
          receipt_token?: string | null
          rejection_reason?: string | null
          role: string
          unit: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          checkin_id?: string | null
          created_at?: string
          daily_rate?: number
          deliveries_count?: number | null
          deliveries_total?: number | null
          entry_date?: string
          id?: string
          name?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_amount_paid?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          payment_voucher_url?: string | null
          pix?: string
          receipt_token?: string | null
          rejection_reason?: string | null
          role?: string
          unit?: string
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          validation_status?: string
        }
        Relationships: []
      }
      password_setup_status: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signed_receipts: {
        Row: {
          amount: number
          created_at: string
          freelancer_cpf: string | null
          freelancer_email: string | null
          freelancer_name: string
          id: string
          reference_period: string | null
          role: string | null
          signed_at: string | null
          signed_file_url: string | null
          status: string
          unit: string | null
          updated_at: string
          worked_dates: string[] | null
          zapsign_token: string
        }
        Insert: {
          amount?: number
          created_at?: string
          freelancer_cpf?: string | null
          freelancer_email?: string | null
          freelancer_name: string
          id?: string
          reference_period?: string | null
          role?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          worked_dates?: string[] | null
          zapsign_token: string
        }
        Update: {
          amount?: number
          created_at?: string
          freelancer_cpf?: string | null
          freelancer_email?: string | null
          freelancer_name?: string
          id?: string
          reference_period?: string | null
          role?: string | null
          signed_at?: string | null
          signed_file_url?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          worked_dates?: string[] | null
          zapsign_token?: string
        }
        Relationships: []
      }
      store_indicators: {
        Row: {
          adt: number | null
          cmv: number | null
          created_at: string
          date: string
          entregas_motoqueiros: number | null
          extremos: number | null
          fat: number
          id: string
          pedidos: number
          store_name: string
          updated_at: string
        }
        Insert: {
          adt?: number | null
          cmv?: number | null
          created_at?: string
          date?: string
          entregas_motoqueiros?: number | null
          extremos?: number | null
          fat: number
          id?: string
          pedidos: number
          store_name: string
          updated_at?: string
        }
        Update: {
          adt?: number | null
          cmv?: number | null
          created_at?: string
          date?: string
          entregas_motoqueiros?: number | null
          extremos?: number | null
          fat?: number
          id?: string
          pedidos?: number
          store_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          updated_at: string
          validation_radius: number
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name: string
          updated_at?: string
          validation_radius?: number
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          updated_at?: string
          validation_radius?: number
        }
        Relationships: []
      }
      termo_adesao_logs: {
        Row: {
          accepted_at: string
          freelancer_cpf: string
          freelancer_id: string | null
          freelancer_nome: string
          id: string
        }
        Insert: {
          accepted_at?: string
          freelancer_cpf: string
          freelancer_id?: string | null
          freelancer_nome: string
          id?: string
        }
        Update: {
          accepted_at?: string
          freelancer_cpf?: string
          freelancer_id?: string | null
          freelancer_nome?: string
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_store_assignments: {
        Row: {
          created_at: string
          id: string
          unit: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          unit: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      vagas_email_settings: {
        Row: {
          id: string
          updated_at: string
          welcome_text: string
        }
        Insert: {
          id?: string
          updated_at?: string
          welcome_text: string
        }
        Update: {
          id?: string
          updated_at?: string
          welcome_text?: string
        }
        Relationships: []
      }
      vagas_welcome_consent: {
        Row: {
          accepted_at: string | null
          email: string
          freelancer_id: string | null
          id: string
          ip_address: string | null
          sent_at: string
          welcome_text: string
        }
        Insert: {
          accepted_at?: string | null
          email: string
          freelancer_id?: string | null
          id?: string
          ip_address?: string | null
          sent_at?: string
          welcome_text: string
        }
        Update: {
          accepted_at?: string | null
          email?: string
          freelancer_id?: string | null
          id?: string
          ip_address?: string | null
          sent_at?: string
          welcome_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "vagas_welcome_consent_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "freelancer_registry"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_zapsign_doc: {
        Args: { api_key: string; doc_token: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_email_allowed: { Args: { check_email: string }; Returns: boolean }
      send_to_zapsign: {
        Args: { api_key: string; payload: Json }
        Returns: Json
      }
      user_has_store_access: {
        Args: { _unit: string; _user_id: string }
        Returns: boolean
      }
      validate_checkin_cpf: { Args: { p_cpf: string }; Returns: Json }
      validate_vaga_cpf: { Args: { p_cpf: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "gestor_loja" | "financeiro" | "rh"
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
      app_role: ["admin", "gestor_loja", "financeiro", "rh"],
    },
  },
} as const
