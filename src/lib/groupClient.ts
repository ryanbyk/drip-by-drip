import { parseActionError, parseInviteResult } from "../domain/partner";
import type { SharedNote } from "../domain/sharedNote";
import {
  assembleGroups,
  assembleHomeMembers,
  type GroupCard,
  type GroupPlanSnapshot,
  type HomeMember,
  type PartnerCandidate,
} from "../domain/social";
import type { StoredPlan } from "../domain/groupPlan";
import type { DripSize } from "../domain/types";
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
  notes: SharedNote[];
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
  setPlan(groupId: string, plan: StoredPlan): Promise<{ id: string } | { error: string }>;
  endPlan(groupId: string): Promise<string | null>;
  followPlan(groupId: string, mode: "group" | "start", day: string): Promise<string | null>;
  leavePlan(groupId: string): Promise<string | null>;
  recordPlanRead(groupId: string, day: string): Promise<string | null>;
  shareNote(day: string, body: string, groupIds: string[], partnerIds: string[]): Promise<string | null>;
  deleteNote(noteId: string): Promise<string | null>;
};

const emptyBundle = (): GroupBundle => ({ groups: [], members: {}, invites: {}, people: [], notes: [] });

function unavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST204" || /does not exist|schema cache/i.test(error.message ?? "");
}

function asPace(value: string): DripSize | null {
  if (value === "verses" || value === "chapter" || value === "two") return value;
  return null;
}

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
    const plans = await loadPlans(today);
    const homes: Record<string, HomeMember[]> = {};
    for (const group of groups) {
      const plan = plans.get(group.id) ?? null;
      const card = cards.find((item) => item.id === group.id);
      if (card && plan) {
        card.plan = plan.snapshot;
        card.readCount = plan.readIds.size;
      }
      homes[group.id] = assembleHomeMembers({
        selfId,
        ownerId: group.owner_id,
        members: members
          .filter((member) => member.groupId === group.id)
          .map((member) => ({ userId: member.userId, role: member.role, displayName: member.displayName })),
        readIds: plan ? plan.readIds : readIds,
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
    const notes = await loadNotes(today, names);
    return { groups: cards, members: homes, invites, people, notes };
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

  async setPlan(groupId, plan) {
    const { data, error } = await supabase.rpc("set_group_plan", {
      target_group: groupId,
      book_id: plan.bookId,
      start_chapter: plan.startChapter,
      end_chapter: plan.endChapter,
      plan_pace: plan.pace,
      reading_days: plan.readingDays,
      start_on: plan.startDate,
    });
    if (error) return { error: "Couldn’t save that plan just now." };
    const row = asRecord(data);
    if (row && typeof row.error === "string" && row.error.trim()) return { error: row.error };
    const id = row && typeof row.id === "string" ? row.id : "";
    if (!id) return { error: "Couldn’t save that plan just now." };
    return { id };
  },

  async endPlan(groupId) {
    const { data, error } = await supabase.rpc("end_group_plan", { target_group: groupId });
    if (error) return "Couldn’t end that plan just now.";
    return parseActionError(data, "Couldn’t end that plan just now.");
  },

  async followPlan(groupId, mode, day) {
    const { data, error } = await supabase.rpc("follow_group_plan", {
      target_group: groupId,
      follow_mode: mode,
      local_day: day,
    });
    if (error) return "Couldn’t join that plan just now.";
    return parseActionError(data, "Couldn’t join that plan just now.");
  },

  async leavePlan(groupId) {
    const { data, error } = await supabase.rpc("leave_group_plan", { target_group: groupId });
    if (error) return "Couldn’t leave that plan just now.";
    return parseActionError(data, "Couldn’t leave that plan just now.");
  },

  async recordPlanRead(groupId, day) {
    const { data, error } = await supabase.rpc("record_plan_read", { target_group: groupId, local_day: day });
    if (error) return "Couldn’t record that reading just now.";
    return parseActionError(data, "Couldn’t record that reading just now.");
  },

  async shareNote(day, body, groupIds, partnerIds) {
    const { data, error } = await supabase.rpc("share_note", {
      local_day: day,
      note_body: body,
      group_ids: groupIds,
      partner_ids: partnerIds,
    });
    if (error) return "Couldn’t share that note just now.";
    return parseActionError(data, "Couldn’t share that note just now.");
  },

  async deleteNote(noteId) {
    const { data, error } = await supabase.rpc("delete_shared_note", { target: noteId });
    if (error) return "Couldn’t remove that note just now.";
    return parseActionError(data, "Couldn’t remove that note just now.");
  },
};

async function loadPlans(today: string): Promise<Map<string, { snapshot: GroupPlanSnapshot; readIds: Set<string> }>> {
  const plans = new Map<string, { snapshot: GroupPlanSnapshot; readIds: Set<string> }>();
  const planResult = await supabase
    .from("group_plans")
    .select("id, group_id, book_id, start_chapter, end_chapter, pace, reading_days, start_date");
  if (planResult.error) {
    if (unavailable(planResult.error)) return plans;
    throw new Error(planResult.error.message);
  }
  const rows = planResult.data ?? [];
  if (rows.length === 0) return plans;
  const ids = rows.map((row) => row.id);
  const [follows, reads] = await Promise.all([
    supabase.from("group_plan_follows").select("plan_id, user_id").in("plan_id", ids),
    supabase.from("group_plan_reads").select("plan_id, user_id").in("plan_id", ids).eq("day", today),
  ]);
  if (follows.error && !unavailable(follows.error)) throw new Error(follows.error.message);
  if (reads.error && !unavailable(reads.error)) throw new Error(reads.error.message);
  const followers = new Map<string, string[]>();
  for (const row of follows.data ?? []) {
    const list = followers.get(row.plan_id) ?? [];
    list.push(row.user_id);
    followers.set(row.plan_id, list);
  }
  const readByPlan = new Map<string, Set<string>>();
  for (const row of reads.data ?? []) {
    const set = readByPlan.get(row.plan_id) ?? new Set<string>();
    set.add(row.user_id);
    readByPlan.set(row.plan_id, set);
  }
  for (const row of rows) {
    const pace = asPace(row.pace);
    if (!pace) continue;
    const followerIds = followers.get(row.id) ?? [];
    const readIds = new Set([...(readByPlan.get(row.id) ?? [])].filter((id) => followerIds.includes(id)));
    plans.set(row.group_id, {
      readIds,
      snapshot: {
        id: row.id,
        bookId: row.book_id,
        startChapter: row.start_chapter,
        endChapter: row.end_chapter,
        pace,
        readingDays: row.reading_days,
        startDate: row.start_date,
        followerIds,
      },
    });
  }
  return plans;
}

async function loadNotes(today: string, names: Map<string, string | null>): Promise<SharedNote[]> {
  const noteResult = await supabase.from("shared_notes").select("id, author_id, day, body").eq("day", today);
  if (noteResult.error) {
    if (unavailable(noteResult.error)) return [];
    throw new Error(noteResult.error.message);
  }
  const notes = noteResult.data ?? [];
  if (notes.length === 0) return [];
  const ids = notes.map((row) => row.id);
  const [groups, partners] = await Promise.all([
    supabase.from("shared_note_groups").select("note_id, group_id").in("note_id", ids),
    supabase.from("shared_note_partners").select("note_id, recipient_id").in("note_id", ids),
  ]);
  if (groups.error && !unavailable(groups.error)) throw new Error(groups.error.message);
  if (partners.error && !unavailable(partners.error)) throw new Error(partners.error.message);
  const missing = notes.map((row) => row.author_id).filter((id) => !names.has(id));
  if (missing.length > 0) {
    const extra = await supabase.from("profiles").select("id, display_name").in("id", [...new Set(missing)]);
    if (!extra.error) {
      for (const row of extra.data ?? []) names.set(row.id, row.display_name);
    }
  }
  return notes.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    authorName: names.get(row.author_id)?.trim() || "A reader",
    day: row.day,
    body: row.body,
    groupIds: (groups.data ?? []).filter((share) => share.note_id === row.id).map((share) => share.group_id),
    partnerIds: (partners.data ?? []).filter((share) => share.note_id === row.id).map((share) => share.recipient_id),
  }));
}
