export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      bets: {
        Row: {
          amount_bet: number;
          amount_returned: number | null;
          bets: Json | null;
          created_at: string;
          id: string;
          image_data: string | null;
          image_path: string | null;
          memo: string | null;
          race_date: string;
          race_name: string | null;
          recovery_rate: number | null;
          source: string | null;
          ticket_type: string;
          track: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_bet: number;
          amount_returned?: number | null;
          bets?: Json | null;
          created_at?: string;
          id?: string;
          image_data?: string | null;
          image_path?: string | null;
          memo?: string | null;
          race_date: string;
          race_name?: string | null;
          recovery_rate?: number | null;
          source?: string | null;
          ticket_type: string;
          track?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_bet?: number;
          amount_returned?: number | null;
          bets?: Json | null;
          created_at?: string;
          id?: string;
          image_data?: string | null;
          image_path?: string | null;
          memo?: string | null;
          race_date?: string;
          race_name?: string | null;
          recovery_rate?: number | null;
          source?: string | null;
          ticket_type?: string;
          track?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ocr_usage_monthly: {
        Row: {
          updated_at: string;
          usage_count: number;
          usage_month: string;
          user_id: string;
        };
        Insert: {
          updated_at?: string;
          usage_count?: number;
          usage_month: string;
          user_id: string;
        };
        Update: {
          updated_at?: string;
          usage_count?: number;
          usage_month?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ocr_usage_monthly_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          user_role: Database["public"]["Enums"]["user_role"];
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          user_role?: Database["public"]["Enums"]["user_role"];
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          user_role?: Database["public"]["Enums"]["user_role"];
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      stats_cache: {
        Row: {
          created_at: string;
          snapshot_date: string;
          stats: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          snapshot_date?: string;
          stats: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          snapshot_date?: string;
          stats?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stats_cache_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          bet_id: string | null;
          created_at: string;
          id: string;
          image_path: string;
          ocr_payload: Json | null;
          user_id: string;
        };
        Insert: {
          bet_id?: string | null;
          created_at?: string;
          id?: string;
          image_path: string;
          ocr_payload?: Json | null;
          user_id: string;
        };
        Update: {
          bet_id?: string | null;
          created_at?: string;
          id?: string;
          image_path?: string;
          ocr_payload?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_bet_id_fkey";
            columns: ["bet_id"];
            isOneToOne: false;
            referencedRelation: "bets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consume_ocr_credit: {
        Args: {
          target_user: string;
          target_month: string;
          usage_limit?: number | null;
        };
        Returns: {
          success: boolean;
          usage_count: number;
        }[];
      };
    };
    Enums: {
      user_role: "free" | "premium" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
