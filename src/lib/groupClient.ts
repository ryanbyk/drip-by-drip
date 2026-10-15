import { parseActionError, parseInviteResult } from "../domain/partner";
import {
  assembleGroups,
  assembleHomeMembers,
  type GroupCard,
  type HomeMember,
  type PartnerCandidate,
} from "../domain/social";
import { supabase } from "./supabaseClient";

export type GroupLookup = {
  name: string;
  leaderName: string;
  memberCount: number;
  alreadyMember: boolean;
  full: boolean;
};

export type GroupBundle = {
  groups: GroupCard[];
  members: Record<string, HomeMember[]>;
  invites: Record<string, { code: string; expiresAt: string }>;
  people: PartnerCandidate[];
};

export type GroupIO = {
  load(today: string): Promise<GroupBundle>;
  create(name: string, description: string): Promise<{ id: string; code: string; expiresAt: string } | { error: string }>;
  rename(groupId: string, name: string): Promise<string | null>;
  leave(groupId: string): Promise<string | null>;
  remove(groupId: string, userId: string): Promise<string | null>;
  resetInvite(groupId: string): Promise<{ code: string; expiresAt: string } | { error: string }>;
  lookup(code: string): Promise<GroupLookup | { error: string }>;
  join(code: string): Promise<{ id: string } | { error: string }>;
};

const emptyBundle = (): GroupBundle => ({ groups: [], members: {}, invites: {}, people: [] });

function asRecord(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

export function parseGroupLookup(data: unknown): GroupLookup | { error: string } {
  const row = asRecord(data);
  if (!row) return { error: "That code isn’t open." };
  if (typeof row.error === "string" && row.error.trim()) return { error: row.error };
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) return { error: "That code isn’t open." };
  const leader = typeof row.leader_name === "string" ? row.leader_name.trim() : "";
  const count = typeof row.member_count === "number" ? row.member_count : 0;
  return {
    name,
    leaderName: leader || "A reader",
    memberCount: count,
    alreadyMember: row.already_member === true,
    full: row.full === true,
  };
}

export function parseGroupCreate(data: unknown): { id: string; code: string; expiresAt: string } | { error: string } {
  const invite = parseInviteResult(data);
  const row = asRecord(data);
  const id = row && typeof row.id === "string" ? row.id : "";
  if ("error" in invite) return invite;
  if (!id) return { error: "Couldn’t start that group just now." };
  return { id, code: invite.code, expiresAt: invite.expiresAt };
}

export function parseJoin(data: unknown): { id: string } | { error: string } {
  const row = asRecord(data);
  if (!row) return { error: "Couldn’t join that group just now." };
  if (typeof row.error === "string" && row.error.trim()) return { error: row.error };
  const id = typeof row.id === "string" ? row.id : "";
  if (!id) return { error: "Couldn’t join that group just now." };
  return { id };
}

export const liveGroupIO: GroupIO = {
  async load(today) {
    const { data: sessionData } = await supabase.auth.getSession();
    const selfId = sessionData.session?.user.id;
    if (!selfId) return emptyBundle();

    const [groupResult, memberResult, inviteResult, readResult, dropResult] = await Promise.all([
      supabase.from("groups").select("id, name, description, owner_id"),
      supabase.from("group_members").select("group_id, user_id, role"),
      supabase.from("group_invites").select("group_id, code, expires_at").eq("status", "open"),
      supabase.from("partner_read_days").select("user_id").eq("day", today),
      supabase.from("drops").select("sender_id, recipient_id, day").eq("sender_id", selfId).eq("day", today),
    ]);
    if (groupResult.error) throw new Error(groupResult.error.message);
    if (memberResult.error) throw new Error(memberResult.error.message);

    const userIds = [...new Set((memberResult.data ?? []).map((row) => row.user_id))];
    const profiles = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [], error: null };
    if (profiles.error) throw new Error(profiles.error.message);

    const names = new Map((profiles.data ?? []).map((row) => [row.id, row.display_name]));
    const readIds = new Set((readResult.data ?? []).map((row) => row.user_id));
    const sentToday = new Set(
      (dropResult.data ?? []).filter((row) => row.day === today).map((row) => row.recipient_id),
    );
    const groups = groupResult.data ?? [];
    const members = (memberResult.data ?? []).map((row) => ({
      groupId: row.group_id,
      userId: row.user_id,
      role: row.role,
      displayName: names.get(row.user_id) ?? null,
    }));
    const cards = assembleGroups({
      selfId,
      groups: groups.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        ownerId: row.owner_id,
      })),
      members,
      readIds,
    });
    const homes: Record<string, HomeMember[]> = {};
    for (const group of groups) {
      homes[group.id] = assembleHomeMembers({
        selfId,
        ownerId: group.owner_id,
        members: members
          .filter((member) => member.groupId === group.id)
          .map((member) => ({ userId: member.userId, role: member.role, displayName: member.displayName })),
        readIds,
        sentToday,
      });
    }
    const invites: GroupBundle["invites"] = {};
    for (const row of inviteResult.data ?? []) {
      invites[row.group_id] = { code: row.code, expiresAt: row.expires_at };
    }
    const groupNames = new Map(groups.map((row) => [row.id, row.name]));
    const people: PartnerCandidate[] = [];
    const seen = new Set<string>();
    for (const member of members) {
      if (member.userId === selfId || seen.has(member.userId)) continue;
      const displayName = member.displayName?.trim() ?? "";
      if (!displayName) continue;
      seen.add(member.userId);
      people.push({
        id: member.userId,
        displayName,
        groupName: groupNames.get(member.groupId) ?? "Your group",
      });
    }
    return { groups: cards, members: homes, invites, people };
  },

  async create(name, description) {
    const { data, error } = await supabase.rpc("create_group", {
      group_name: name,
      group_description: description,
    });
    if (error) return { error: "Couldn’t start that group just now." };
    return parseGroupCreate(data);
  },

  async rename(groupId, name) {
    const { data, error } = await supabase.rpc("rename_group", { target_group: groupId, group_name: name });
    if (error) return "Couldn’t rename that group just now.";
    return parseActionError(data, "Couldn’t rename that group just now.");
  },

  async leave(groupId) {
    const { data, error } = await supabase.rpc("leave_group", { target_group: groupId });
    if (error) return "Couldn’t leave that group just now.";
    return parseActionError(data, "Couldn’t leave that group just now.");
  },

  async remove(groupId, userId) {
    const { data, error } = await supabase.rpc("remove_group_member", { target_group: groupId, member_user: userId });
    if (error) return "Couldn’t remove that member just now.";
    return parseActionError(data, "Couldn’t remove that member just now.");
  },

  async resetInvite(groupId) {
    const { data, error } = await supabase.rpc("create_group_invite", { target_group: groupId });
    if (error) return { error: "Couldn’t make an invite just now." };
    return parseInviteResult(data);
  },

  async lookup(code) {
    const { data, error } = await supabase.rpc("lookup_group_invite", { invite_code: code });
    if (error) return { error: "Couldn’t look up that code just now." };
    return parseGroupLookup(data);
  },

  async join(code) {
    const { data, error } = await supabase.rpc("join_group", { invite_code: code });
    if (error) return { error: "Couldn’t join that group just now." };
    return parseJoin(data);
  },
};
