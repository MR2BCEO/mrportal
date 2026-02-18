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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_code: string | null
          category: string | null
          created_at: string
          external_id: string | null
          extra_json: Json | null
          id: string
          inventory_no: string | null
          location_id: string
          manufacturer: string | null
          model: string | null
          name: string
          note: string | null
          room: string | null
          serial_number: string | null
          updated_at: string
          year: string | null
        }
        Insert: {
          asset_code?: string | null
          category?: string | null
          created_at?: string
          external_id?: string | null
          extra_json?: Json | null
          id?: string
          inventory_no?: string | null
          location_id: string
          manufacturer?: string | null
          model?: string | null
          name: string
          note?: string | null
          room?: string | null
          serial_number?: string | null
          updated_at?: string
          year?: string | null
        }
        Update: {
          asset_code?: string | null
          category?: string | null
          created_at?: string
          external_id?: string | null
          extra_json?: Json | null
          id?: string
          inventory_no?: string | null
          location_id?: string
          manufacturer?: string | null
          model?: string | null
          name?: string
          note?: string | null
          room?: string | null
          serial_number?: string | null
          updated_at?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          role_title: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role_title?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line: string | null
          billing_address: string | null
          city: string | null
          country: string | null
          created_at: string
          dic: string | null
          email: string | null
          ico: string | null
          id: string
          name: string
          note: string | null
          phone: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["customer_type"]
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address_line?: string | null
          billing_address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          dic?: string | null
          email?: string | null
          ico?: string | null
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address_line?: string | null
          billing_address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          dic?: string | null
          email?: string | null
          ico?: string | null
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          doc_kind: Database["public"]["Enums"]["doc_kind"]
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          obligation_id: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          obligation_id: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          doc_kind?: Database["public"]["Enums"]["doc_kind"]
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          obligation_id?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line: string | null
          city: string | null
          country: string
          created_at: string
          customer_id: string
          id: string
          name: string
          note: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          country?: string
          created_at?: string
          customer_id: string
          id?: string
          name: string
          note?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line?: string | null
          city?: string | null
          country?: string
          created_at?: string
          customer_id?: string
          id?: string
          name?: string
          note?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_history: {
        Row: {
          action: Database["public"]["Enums"]["history_action"]
          actor_user_id: string | null
          created_at: string
          id: string
          obligation_id: string
          payload: Json | null
        }
        Insert: {
          action: Database["public"]["Enums"]["history_action"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          obligation_id: string
          payload?: Json | null
        }
        Update: {
          action?: Database["public"]["Enums"]["history_action"]
          actor_user_id?: string | null
          created_at?: string
          id?: string
          obligation_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "obligation_history_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligation_history_obligation_id_fkey"
            columns: ["obligation_id"]
            isOneToOne: false
            referencedRelation: "obligations"
            referencedColumns: ["id"]
          },
        ]
      }
      obligation_types: {
        Row: {
          code: string
          created_at: string
          default_periodicity_months: number | null
          domain: Database["public"]["Enums"]["obligation_domain"]
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_periodicity_months?: number | null
          domain: Database["public"]["Enums"]["obligation_domain"]
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_periodicity_months?: number | null
          domain?: Database["public"]["Enums"]["obligation_domain"]
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      obligations: {
        Row: {
          asset_id: string | null
          created_at: string
          customer_id: string
          domain: Database["public"]["Enums"]["obligation_domain"]
          findings_summary: string | null
          id: string
          location_id: string
          next_due_date: string | null
          obligation_type_id: string
          performed_date: string | null
          periodicity_months: number | null
          quantity: number | null
          responsible_user_id: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["obligation_status"]
          technician_company: string | null
          technician_email: string | null
          technician_name: string | null
          technician_phone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          customer_id: string
          domain: Database["public"]["Enums"]["obligation_domain"]
          findings_summary?: string | null
          id?: string
          location_id: string
          next_due_date?: string | null
          obligation_type_id: string
          performed_date?: string | null
          periodicity_months?: number | null
          quantity?: number | null
          responsible_user_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          technician_company?: string | null
          technician_email?: string | null
          technician_name?: string | null
          technician_phone?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          customer_id?: string
          domain?: Database["public"]["Enums"]["obligation_domain"]
          findings_summary?: string | null
          id?: string
          location_id?: string
          next_due_date?: string | null
          obligation_type_id?: string
          performed_date?: string | null
          periodicity_months?: number | null
          quantity?: number | null
          responsible_user_id?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["obligation_status"]
          technician_company?: string | null
          technician_email?: string | null
          technician_name?: string | null
          technician_phone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obligations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_obligation_type_id_fkey"
            columns: ["obligation_type_id"]
            isOneToOne: false
            referencedRelation: "obligation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obligations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_catalog: {
        Row: {
          code: string
          created_at: string
          division: string
          group_name: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          division: string
          group_name: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          division?: string
          group_name?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      technicians: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          note: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_pm: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "pm"
      customer_type: "firma" | "instituce" | "fo"
      doc_kind: "REVIZNI_ZPRAVA" | "FOTO" | "JINE" | "PROTOKOL"
      history_action:
        | "CREATED"
        | "UPDATED"
        | "STATUS_CHANGED"
        | "DOCUMENT_ADDED"
        | "COMMENT"
        | "IMPORTED"
      obligation_domain: "REVIZE" | "BOZP" | "PO"
      obligation_status:
        | "DRAFT"
        | "ACTIVE"
        | "DUE_SOON"
        | "OVERDUE"
        | "DONE"
        | "NEEDS_INFO"
        | "ARCHIVED"
        | "PLANNED"
        | "IN_PROGRESS"
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
      app_role: ["admin", "pm"],
      customer_type: ["firma", "instituce", "fo"],
      doc_kind: ["REVIZNI_ZPRAVA", "FOTO", "JINE", "PROTOKOL"],
      history_action: [
        "CREATED",
        "UPDATED",
        "STATUS_CHANGED",
        "DOCUMENT_ADDED",
        "COMMENT",
        "IMPORTED",
      ],
      obligation_domain: ["REVIZE", "BOZP", "PO"],
      obligation_status: [
        "DRAFT",
        "ACTIVE",
        "DUE_SOON",
        "OVERDUE",
        "DONE",
        "NEEDS_INFO",
        "ARCHIVED",
        "PLANNED",
        "IN_PROGRESS",
      ],
    },
  },
} as const
