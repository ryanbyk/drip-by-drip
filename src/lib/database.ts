/**
 * Tables the app reads through the public anon key.
 * Authorization is RLS on these tables, not columns in the payload.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_snapshots: {
        Row: {
          user_id: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          payload: Json;
          updated_at: string;
        };
        Update: {
          user_id?: string;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type UserSnapshotInsert = Database["public"]["Tables"]["user_snapshots"]["Insert"];
