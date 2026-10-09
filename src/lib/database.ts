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
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          time_zone: string | null;
          last_sent_on: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          time_zone?: string | null;
          last_sent_on?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          time_zone?: string | null;
          last_sent_on?: string | null;
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
          invitee_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inviter_id: string;
          code: string;
          status?: string;
          expires_at: string;
          accepted_by?: string | null;
          invitee_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          inviter_id?: string;
          code?: string;
          status?: string;
          expires_at?: string;
          accepted_by?: string | null;
          invitee_id?: string | null;
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
      groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      group_invites: {
        Row: {
          id: string;
          group_id: string;
          created_by: string;
          code: string;
          status: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          created_by: string;
          code: string;
          status?: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          created_by?: string;
          code?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      drops: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          body: string | null;
          day: string;
          created_at: string;
          seen_at: string | null;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          body?: string | null;
          day: string;
          created_at?: string;
          seen_at?: string | null;
        };
        Update: {
          id?: string;
          sender_id?: string;
          recipient_id?: string;
          body?: string | null;
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
      group_plans: {
        Row: {
          id: string;
          group_id: string;
          book_id: string;
          start_chapter: number;
          end_chapter: number;
          pace: string;
          reading_days: number;
          start_date: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          book_id: string;
          start_chapter: number;
          end_chapter: number;
          pace: string;
          reading_days: number;
          start_date: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          book_id?: string;
          start_chapter?: number;
          end_chapter?: number;
          pace?: string;
          reading_days?: number;
          start_date?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      group_plan_follows: {
        Row: {
          plan_id: string;
          user_id: string;
          mode: string;
          started_on: string;
        };
        Insert: {
          plan_id: string;
          user_id: string;
          mode: string;
          started_on: string;
        };
        Update: {
          plan_id?: string;
          user_id?: string;
          mode?: string;
          started_on?: string;
        };
        Relationships: [];
      };
      group_plan_reads: {
        Row: {
          plan_id: string;
          user_id: string;
          day: string;
        };
        Insert: {
          plan_id: string;
          user_id: string;
          day: string;
        };
        Update: {
          plan_id?: string;
          user_id?: string;
          day?: string;
        };
        Relationships: [];
      };
      shared_notes: {
        Row: {
          id: string;
          author_id: string;
          day: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          day: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          day?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shared_note_groups: {
        Row: {
          note_id: string;
          group_id: string;
        };
        Insert: {
          note_id: string;
          group_id: string;
        };
        Update: {
          note_id?: string;
          group_id?: string;
        };
        Relationships: [];
      };
      shared_note_partners: {
        Row: {
          note_id: string;
          recipient_id: string;
        };
        Insert: {
          note_id: string;
          recipient_id: string;
        };
        Update: {
          note_id?: string;
          recipient_id?: string;
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
      create_group: {
        Args: { group_name: string; group_description: string };
        Returns: Json;
      };
      rename_group: {
        Args: { target_group: string; group_name: string };
        Returns: Json;
      };
      leave_group: {
        Args: { target_group: string };
        Returns: Json;
      };
      remove_group_member: {
        Args: { target_group: string; member_user: string };
        Returns: Json;
      };
      create_group_invite: {
        Args: { target_group: string };
        Returns: Json;
      };
      lookup_group_invite: {
        Args: { invite_code: string };
        Returns: Json;
      };
      join_group: {
        Args: { invite_code: string };
        Returns: Json;
      };
      invite_reading_partner: {
        Args: { invitee: string };
        Returns: Json;
      };
      unlink_one_partner: {
        Args: { partner_user: string };
        Returns: Json;
      };
      send_drop: {
        Args: { recipient: string; message: string; local_day: string };
        Returns: Json;
      };
      see_drop: {
        Args: { drop_id: string };
        Returns: Json;
      };
      set_group_plan: {
        Args: {
          target_group: string;
          book_id: string;
          start_chapter: number;
          end_chapter: number;
          plan_pace: string;
          reading_days: number;
          start_on: string;
        };
        Returns: Json;
      };
      end_group_plan: {
        Args: { target_group: string };
        Returns: Json;
      };
      follow_group_plan: {
        Args: { target_group: string; follow_mode: string; local_day: string };
        Returns: Json;
      };
      leave_group_plan: {
        Args: { target_group: string };
        Returns: Json;
      };
      record_plan_read: {
        Args: { target_group: string; local_day: string };
        Returns: Json;
      };
      share_note: {
        Args: { local_day: string; note_body: string; group_ids: string[]; partner_ids: string[] };
        Returns: Json;
      };
      delete_shared_note: {
        Args: { target: string };
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
