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
      partnerships: {
        Row: {
          id: string;
          user_low: string;
          user_high: string;
          invited_by: string;
          status: string;
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          user_low: string;
          user_high: string;
          invited_by: string;
          status?: string;
          created_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          user_low?: string;
          user_high?: string;
          invited_by?: string;
          status?: string;
          created_at?: string;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      partner_invites: {
        Row: {
          id: string;
          inviter_id: string;
          code: string;
          status: string;
          expires_at: string;
          accepted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inviter_id: string;
          code: string;
          status?: string;
          expires_at: string;
          accepted_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          inviter_id?: string;
          code?: string;
          status?: string;
          expires_at?: string;
          accepted_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      partner_nudges: {
        Row: {
          id: string;
          partnership_id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          day: string;
          created_at: string;
          seen_at: string | null;
        };
        Insert: {
          id?: string;
          partnership_id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          day: string;
          created_at?: string;
          seen_at?: string | null;
        };
        Update: {
          id?: string;
          partnership_id?: string;
          sender_id?: string;
          recipient_id?: string;
          body?: string;
          day?: string;
          created_at?: string;
          seen_at?: string | null;
        };
        Relationships: [];
      };
      partner_read_days: {
        Row: {
          user_id: string;
          day: string;
        };
        Insert: {
          user_id: string;
          day: string;
        };
        Update: {
          user_id?: string;
          day?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_partner_invite: {
        Args: Record<string, never>;
        Returns: Json;
      };
      lookup_partner_invite: {
        Args: { invite_code: string };
        Returns: Json;
      };
      accept_partner_invite: {
        Args: { invite_code: string };
        Returns: Json;
      };
      decline_partner_invite: {
        Args: { invite_code: string };
        Returns: Json;
      };
      revoke_partner_invite: {
        Args: Record<string, never>;
        Returns: Json;
      };
      unlink_partner: {
        Args: Record<string, never>;
        Returns: Json;
      };
      send_partner_nudge: {
        Args: { message: string; local_day: string };
        Returns: Json;
      };
      see_partner_nudge: {
        Args: { nudge_id: string };
        Returns: Json;
      };
      set_partner_read_day: {
        Args: { local_day: string; did_read: boolean };
        Returns: Json;
      };
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
