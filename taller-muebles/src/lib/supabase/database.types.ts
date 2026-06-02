export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          code: "LH" | "LR";
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: "LH" | "LR";
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: "LH" | "LR";
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          store_id: string | null;
          full_name: string;
          role: "admin" | "manager" | "operator" | "viewer";
          area: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          store_id?: string | null;
          full_name: string;
          role?: "admin" | "manager" | "operator" | "viewer";
          area?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          store_id?: string | null;
          full_name?: string;
          role?: "admin" | "manager" | "operator" | "viewer";
          area?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          store_id: string;
          internal_code: string;
          sales_note_number: string | null;
          client_name: string;
          product_name: string;
          material: string | null;
          color: string | null;
          status: string;
          condition: string;
          priority: string;
          is_warranty: boolean;
          entry_date: string;
          delivery_date: string | null;
          completed_at: string | null;
          assigned_to: string | null;
          observations: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          internal_code: string;
          sales_note_number?: string | null;
          client_name: string;
          product_name: string;
          material?: string | null;
          color?: string | null;
          status?: string;
          condition?: string;
          priority?: string;
          is_warranty?: boolean;
          entry_date: string;
          delivery_date?: string | null;
          completed_at?: string | null;
          assigned_to?: string | null;
          observations?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          internal_code?: string;
          sales_note_number?: string | null;
          client_name?: string;
          product_name?: string;
          material?: string | null;
          color?: string | null;
          status?: string;
          condition?: string;
          priority?: string;
          is_warranty?: boolean;
          entry_date?: string;
          delivery_date?: string | null;
          completed_at?: string | null;
          assigned_to?: string | null;
          observations?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      production_steps: {
        Row: {
          id: string;
          order_id: string;
          step: "structure" | "cutting" | "sewing" | "upholstery" | "quality";
          sort_order: number;
          status: "pending" | "active" | "done" | "blocked";
          assigned_to: string | null;
          started_at: string | null;
          completed_at: string | null;
          blocked_reason: string | null;
          notes: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          step: "structure" | "cutting" | "sewing" | "upholstery" | "quality";
          sort_order: number;
          status?: "pending" | "active" | "done" | "blocked";
          assigned_to?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          blocked_reason?: string | null;
          notes?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          step?: "structure" | "cutting" | "sewing" | "upholstery" | "quality";
          sort_order?: number;
          status?: "pending" | "active" | "done" | "blocked";
          assigned_to?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          blocked_reason?: string | null;
          notes?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          store_id: string | null;
          name: string;
          category: string;
          unit: string;
          current_quantity: number;
          minimum_quantity: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id?: string | null;
          name: string;
          category: string;
          unit: string;
          current_quantity?: number;
          minimum_quantity?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string | null;
          name?: string;
          category?: string;
          unit?: string;
          current_quantity?: number;
          minimum_quantity?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          order_id: string | null;
          profile_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          field_name: string | null;
          old_value: string | null;
          new_value: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          profile_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          profile_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          field_name?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
