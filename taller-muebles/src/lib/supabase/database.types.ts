export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          order_id: string | null
          profile_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string | null
          profile_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          category: string
          created_at: string
          current_quantity: number
          id: string
          minimum_quantity: number
          name: string
          store_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          current_quantity?: number
          id?: string
          minimum_quantity?: number
          name: string
          store_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          current_quantity?: number
          id?: string
          minimum_quantity?: number
          name?: string
          store_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_type: string
          id: string
          order_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_type: string
          id?: string
          order_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          id?: string
          order_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          order_id: string
          profile_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          order_id: string
          profile_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_comments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_to: string | null
          client_name: string
          color: string | null
          completed_at: string | null
          condition: Database["public"]["Enums"]["order_condition"]
          created_at: string
          created_by: string | null
          delivery_date: string | null
          entry_date: string
          id: string
          internal_code: string
          is_warranty: boolean
          material: string | null
          observations: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          product_name: string
          sales_note_number: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_name: string
          color?: string | null
          completed_at?: string | null
          condition?: Database["public"]["Enums"]["order_condition"]
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          entry_date?: string
          id?: string
          internal_code: string
          is_warranty?: boolean
          material?: string | null
          observations?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          product_name: string
          sales_note_number?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_name?: string
          color?: string | null
          completed_at?: string | null
          condition?: Database["public"]["Enums"]["order_condition"]
          created_at?: string
          created_by?: string | null
          delivery_date?: string | null
          entry_date?: string
          id?: string
          internal_code?: string
          is_warranty?: boolean
          material?: string | null
          observations?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          product_name?: string
          sales_note_number?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      production_steps: {
        Row: {
          assigned_to: string | null
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string
          sort_order: number
          started_at: string | null
          status: Database["public"]["Enums"]["step_status"]
          step: string
          step_label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          sort_order: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step: string
          step_label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          sort_order?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step?: string
          step_label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_steps_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_steps_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_steps_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          area: string | null
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          area?: string | null
          created_at?: string
          full_name: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          area?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          material_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes: string | null
          order_id: string | null
          quantity: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          material_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          order_id?: string | null
          quantity: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          material_id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          notes?: string | null
          order_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          code: Database["public"]["Enums"]["store_code"]
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: Database["public"]["Enums"]["store_code"]
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: Database["public"]["Enums"]["store_code"]
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: boolean
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
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
      record_stock_movement: {
        Args: {
          p_material_id: string
          p_movement_type: Database["public"]["Enums"]["stock_movement_type"]
          p_notes?: string
          p_order_id?: string
          p_quantity: number
        }
        Returns: number
      }
    }
    Enums: {
      order_condition:
        | "none"
        | "warehouse"
        | "showroom"
        | "loaned"
        | "quality_control"
        | "delivered"
      order_status:
        | "draft"
        | "scheduled"
        | "in_production"
        | "blocked"
        | "urgent"
        | "quality_control"
        | "completed"
        | "cancelled"
      priority_level: "normal" | "high" | "critical"
      step_status: "pending" | "active" | "done" | "blocked"
      stock_movement_type: "in" | "out" | "adjustment" | "reserved" | "released"
      store_code: "LH" | "LR"
      user_role: "admin" | "manager" | "operator" | "viewer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      order_condition: [
        "none",
        "warehouse",
        "showroom",
        "loaned",
        "quality_control",
        "delivered",
      ],
      order_status: [
        "draft",
        "scheduled",
        "in_production",
        "blocked",
        "urgent",
        "quality_control",
        "completed",
        "cancelled",
      ],
      priority_level: ["normal", "high", "critical"],
      step_status: ["pending", "active", "done", "blocked"],
      stock_movement_type: ["in", "out", "adjustment", "reserved", "released"],
      store_code: ["LH", "LR"],
      user_role: ["admin", "manager", "operator", "viewer"],
    },
  },
} as const
