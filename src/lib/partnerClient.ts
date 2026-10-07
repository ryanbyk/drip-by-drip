import {
  parseActionError,
  parseInviteResult,
  parseLookupResult,
  toPartnerLoad,
  type PartnerLoad,
} from "../domain/partner";
import { supabase } from "./supabaseClient";

const LOAD_ERROR = "Couldn’t load your partner just now.";

export type PartnerIO = {
  load(today: string): Promise<PartnerLoad>;
  createInvite(): Promise<{ code: string; expiresAt: string } | { error: string }>;
  lookup(code: string): Promise<{ inviterName: string; own: boolean } | { error: string }>;
  accept(code: string): Promise<string | null>;
  decline(code: string): Promise<string | null>;
  unlink(): Promise<string | null>;
  sendNudge(message: string, day: string): Promise<string | null>;
  seeNudge(id: string): Promise<string | null>;
  setReadToday(day: string, read: boolean): Promise<string | null>;
};

const emptyLoad = (): PartnerLoad => ({ partner: null, invite: null, nudges: [] });

async function rpc(name: "create_partner_invite" | "revoke_partner_invite" | "unlink_partner"): Promise<unknown> {
  const { data, error } = await supabase.rpc(name);
  if (error) throw new Error(error.message);
  return data;
}

export const livePartnerIO: PartnerIO = {
  async load(today) {
    const { data: sessionData } = await supabase.auth.getSession();
    const selfId = sessionData.session?.user.id;
    if (!selfId) return emptyLoad();

    const [partnershipResult, inviteResult] = await Promise.all([
      supabase.from("partnerships").select("id, user_low, user_high").eq("status", "active").maybeSingle(),
      supabase.from("partner_invites").select("code, expires_at").eq("status", "open").maybeSingle(),
    ]);
    if (partnershipResult.error) throw new Error(partnershipResult.error.message);
    if (inviteResult.error) throw new Error(inviteResult.error.message);

    const partnership = partnershipResult.data;
    const partnerId =
      partnership == null
        ? null
        : partnership.user_low === selfId
          ? partnership.user_high
          : partnership.user_high === selfId
            ? partnership.user_low
            : null;

    const [profileResult, readResult, nudgeResult] = await Promise.all([
      partnerId
        ? supabase.from("profiles").select("display_name").eq("id", partnerId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      partnerId
        ? supabase.from("partner_read_days").select("day").eq("user_id", partnerId).eq("day", today).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      partnership
        ? supabase
            .from("partner_nudges")
            .select("id, sender_id, body, day, seen_at")
            .eq("partnership_id", partnership.id)
            .order("created_at", { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (nudgeResult.error) throw new Error(nudgeResult.error.message);

    const invite = inviteResult.data;
    return toPartnerLoad({
      selfId,
      today,
      partnership: partnership ? { userLow: partnership.user_low, userHigh: partnership.user_high } : null,
      displayName: profileResult.data?.display_name ?? null,
      readDay: readResult.data?.day ?? null,
      invite: invite ? { code: invite.code, expiresAt: invite.expires_at } : null,
      nudges: (nudgeResult.data ?? []).map((row) => ({
        id: row.id,
        senderId: row.sender_id,
        body: row.body,
        day: row.day,
        seen: row.seen_at != null,
      })),
    });
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

  async unlink() {
    try {
      return parseActionError(await rpc("unlink_partner"), "Couldn’t unlink just now.");
    } catch {
      return "Couldn’t unlink just now.";
    }
  },

  async sendNudge(message, day) {
    const { data, error } = await supabase.rpc("send_partner_nudge", { message, local_day: day });
    if (error) return "Couldn’t send that note just now.";
    return parseActionError(data, "Couldn’t send that note just now.");
  },

  async seeNudge(id) {
    const { data, error } = await supabase.rpc("see_partner_nudge", { nudge_id: id });
    if (error) return "Couldn’t keep that note just now.";
    return parseActionError(data, "Couldn’t keep that note just now.");
  },

  async setReadToday(day, read) {
    const { data, error } = await supabase.rpc("set_partner_read_day", { local_day: day, did_read: read });
    if (error) return "Couldn’t update today just now.";
    return parseActionError(data, "Couldn’t update today just now.");
  },
};
