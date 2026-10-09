import { parseActionError, parseInviteResult, parseLookupResult } from "../domain/partner";
import {
  assemblePartners,
  visibleDrops,
  type PersonSignal,
  type VisibleDrop,
} from "../domain/social";
import { supabase } from "./supabaseClient";

const LOAD_ERROR = "Couldn’t load your partner just now.";

export type PartnerRequest = {
  code: string;
  inviterName: string;
};

export type PartnerBundle = {
  partners: PersonSignal[];
  invite: { code: string; expiresAt: string } | null;
  requests: PartnerRequest[];
  drops: VisibleDrop[];
};

export type PartnerIO = {
  load(today: string): Promise<PartnerBundle>;
  createInvite(): Promise<{ code: string; expiresAt: string } | { error: string }>;
  lookup(code: string): Promise<{ inviterName: string; own: boolean } | { error: string }>;
  accept(code: string): Promise<string | null>;
  decline(code: string): Promise<string | null>;
  unlink(partnerId?: string): Promise<string | null>;
  invitePerson(personId: string): Promise<string | null>;
  sendNudge(message: string, day: string): Promise<string | null>;
  sendDrop(recipientId: string, message: string | null, day: string): Promise<string | null>;
  seeNudge(id: string): Promise<string | null>;
  seeDrop(id: string): Promise<string | null>;
  setReadToday(day: string, read: boolean): Promise<string | null>;
};

const emptyBundle = (): PartnerBundle => ({ partners: [], invite: null, requests: [], drops: [] });

function unavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST204" || /does not exist|schema cache/i.test(error.message ?? "");
}

async function rpc(name: "create_partner_invite" | "revoke_partner_invite" | "unlink_partner"): Promise<unknown> {
  const { data, error } = await supabase.rpc(name);
  if (error) throw new Error(error.message);
  return data;
}

export const livePartnerIO: PartnerIO = {
  async load(today) {
    const { data: sessionData } = await supabase.auth.getSession();
    const selfId = sessionData.session?.user.id;
    if (!selfId) return emptyBundle();

    const [partnershipResult, inviteResult] = await Promise.all([
      supabase.from("partnerships").select("user_low, user_high").eq("status", "active"),
      supabase.from("partner_invites").select("code, expires_at, inviter_id, invitee_id").eq("status", "open"),
    ]);
    if (partnershipResult.error) throw new Error(partnershipResult.error.message);

    let invites = inviteResult.data ?? [];
    if (inviteResult.error && unavailable(inviteResult.error)) {
      const fallback = await supabase.from("partner_invites").select("code, expires_at, inviter_id").eq("status", "open");
      if (fallback.error) throw new Error(fallback.error.message);
      invites = (fallback.data ?? []).map((row) => ({ ...row, invitee_id: null }));
    } else if (inviteResult.error) {
      throw new Error(inviteResult.error.message);
    }

    const partnerships = partnershipResult.data ?? [];
    const partnerIds = partnerships
      .map((row) => (row.user_low === selfId ? row.user_high : row.user_low))
      .filter((id) => id && id !== selfId);
    const requestRows = invites.filter((row) => row.invitee_id === selfId);
    const nameIds = [...new Set([...partnerIds, ...requestRows.map((row) => row.inviter_id)])];

    const [profiles, reads, dropResult, nudgeResult] = await Promise.all([
      nameIds.length
        ? supabase.from("profiles").select("id, display_name").in("id", nameIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("partner_read_days").select("user_id").eq("day", today),
      supabase.from("drops").select("id, sender_id, recipient_id, body, day, seen_at").order("created_at", { ascending: false }).limit(40),
      supabase.from("partner_nudges").select("id, sender_id, recipient_id, body, day, seen_at").order("created_at", { ascending: false }).limit(40),
    ]);
    if (profiles.error) throw new Error(profiles.error.message);
    if (reads.error) throw new Error(reads.error.message);

    const names = new Map((profiles.data ?? []).map((row) => [row.id, row.display_name]));
    const generic = invites.find((row) => row.inviter_id === selfId && !row.invitee_id);
    const dropRows = dropResult.error ? [] : (dropResult.data ?? []);
    const nudgeRows = nudgeResult.error ? [] : (nudgeResult.data ?? []);

    return {
      partners: assemblePartners({
        selfId,
        today,
        partnerships: partnerships.map((row) => ({ userLow: row.user_low, userHigh: row.user_high })),
        names,
        readDays: new Set((reads.data ?? []).map((row) => row.user_id)),
      }),
      invite: generic ? { code: generic.code, expiresAt: generic.expires_at } : null,
      requests: requestRows.map((row) => ({
        code: row.code,
        inviterName: names.get(row.inviter_id)?.trim() || "A reader",
      })),
      drops: visibleDrops({
        selfId,
        drops: dropRows.map((row) => ({
          id: row.id,
          senderId: row.sender_id,
          recipientId: row.recipient_id,
          body: row.body,
          day: row.day,
          seen: row.seen_at != null,
        })),
        nudges: nudgeRows.map((row) => ({
          id: row.id,
          senderId: row.sender_id,
          recipientId: row.recipient_id,
          body: row.body,
          day: row.day,
          seen: row.seen_at != null,
        })),
      }),
    };
  },

  async createInvite() {
    try {
      return parseInviteResult(await rpc("create_partner_invite"));
    } catch {
      return { error: "Couldn’t create an invite just now. Try again in a moment." };
    }
  },

  async lookup(code) {
    const { data, error } = await supabase.rpc("lookup_partner_invite", { invite_code: code });
    if (error) return { error: LOAD_ERROR };
    return parseLookupResult(data);
  },

  async accept(code) {
    const { data, error } = await supabase.rpc("accept_partner_invite", { invite_code: code });
    if (error) return "Couldn’t accept that invite just now.";
    return parseActionError(data, "Couldn’t accept that invite just now.");
  },

  async decline(code) {
    const { data, error } = await supabase.rpc("decline_partner_invite", { invite_code: code });
    if (error) return "Couldn’t decline that invite just now.";
    return parseActionError(data, "Couldn’t decline that invite just now.");
  },

  async unlink(partnerId) {
    if (partnerId) {
      const { data, error } = await supabase.rpc("unlink_one_partner", { partner_user: partnerId });
      if (!error) return parseActionError(data, "Couldn’t unlink just now.");
      if (!unavailable(error) && !/could not find the function/i.test(error.message)) {
        return "Couldn’t unlink just now.";
      }
    }
    try {
      return parseActionError(await rpc("unlink_partner"), "Couldn’t unlink just now.");
    } catch {
      return "Couldn’t unlink just now.";
    }
  },

  async invitePerson(personId) {
    const { data, error } = await supabase.rpc("invite_reading_partner", { invitee: personId });
    if (error) return "Couldn’t send that invite just now.";
    return parseActionError(data, "Couldn’t send that invite just now.");
  },

  async sendNudge(message, day) {
    const { data, error } = await supabase.rpc("send_partner_nudge", { message, local_day: day });
    if (error) return "Couldn’t send that note just now.";
    return parseActionError(data, "Couldn’t send that note just now.");
  },

  async sendDrop(recipientId, message, day) {
    const { data, error } = await supabase.rpc("send_drop", {
      recipient: recipientId,
      message: message ?? "",
      local_day: day,
    });
    if (!error) return parseActionError(data, "Couldn’t send that drop just now.");
    if (unavailable(error) || /could not find the function/i.test(error.message)) {
      if (!message) return "Couldn’t send that drop just now.";
      return this.sendNudge(message, day);
    }
    return "Couldn’t send that drop just now.";
  },

  async seeNudge(id) {
    const { data, error } = await supabase.rpc("see_partner_nudge", { nudge_id: id });
    if (error) return "Couldn’t keep that note just now.";
    return parseActionError(data, "Couldn’t keep that note just now.");
  },

  async seeDrop(id) {
    const { data, error } = await supabase.rpc("see_drop", { drop_id: id });
    if (!error) return parseActionError(data, "Couldn’t keep that drop just now.");
    if (unavailable(error) || /could not find the function/i.test(error.message)) return this.seeNudge(id);
    return "Couldn’t keep that drop just now.";
  },

  async setReadToday(day, read) {
    const { data, error } = await supabase.rpc("set_partner_read_day", { local_day: day, did_read: read });
    if (error) return "Couldn’t update today just now.";
    return parseActionError(data, "Couldn’t update today just now.");
  },
};
