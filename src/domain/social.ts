import { authRedirectUrl } from "../lib/auth";
import { NUDGE_NOTES, isNudgeNote, normalizeInviteCode, otherPartnerId, type NudgeNote } from "./partner";

/**
 * v1.5b defaults. Change them here and in
 * `supabase/migrations/20261008023955_social_layer.sql` together.
 */
export const GROUP_MEMBER_CAP = 20;
export const PARTNER_CAP = 5;
/** One drop from a sender to a recipient on a local day. */
export const DROP_DAILY_LIMIT = 1;
export const GROUP_CODE_LENGTH = 6;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const GROUP_CODE_STORAGE_KEY = "drip-by-drip.group-invite";

export type AvatarTone = "warm" | "subtle" | "accent" | "self" | "owner";

export type PersonSignal = {
  id: string;
  displayName: string;
  readToday: boolean;
};

export type GroupRole = "owner" | "member";

export type DropDraft = {
  senderId: string;
  recipientId: string;
  day: string;
};

/** What a partner or group member is allowed to learn about a person. */
export function projectPerson(input: {
  id: string;
  displayName: string | null | undefined;
  readToday: boolean;
  answer?: unknown;
  note?: unknown;
  huh?: unknown;
  book?: unknown;
}): PersonSignal {
  const name = input.displayName?.trim() ?? "";
  return {
    id: input.id,
    displayName: name || "A reader",
    readToday: input.readToday === true,
  };
}

export function canAddPartner(activeCount: number): boolean {
  return activeCount < PARTNER_CAP;
}

export function canJoinGroup(memberCount: number): boolean {
  return memberCount < GROUP_MEMBER_CAP;
}

export function canSendDrop(sent: readonly DropDraft[], next: DropDraft): boolean {
  if (!next.senderId || !next.recipientId || next.senderId === next.recipientId) return false;
  const already = sent.filter(
    (drop) => drop.senderId === next.senderId && drop.recipientId === next.recipientId && drop.day === next.day,
  ).length;
  return already < DROP_DAILY_LIMIT;
}

export function readCount(people: readonly { readToday: boolean }[]): number {
  return people.filter((person) => person.readToday).length;
}

/** A missing mark is silence. Zero readers does not become a No. */
export function groupListReadLabel(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return "1 read today";
  return `${count} read today`;
}

export function groupHomeReadLabel(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return "1 has read";
  return `${count} have read`;
}

export function partnerReadLine(name: string, readToday: boolean): string | null {
  if (!readToday) return null;
  const first = name.trim().split(/\s+/)[0] || "They";
  return `${first} read today`;
}

export function memberCountLabel(count: number): string {
  const noun = count === 1 ? "member" : "members";
  return `${count} ${noun} · Everyone reads their own book`;
}

export function leaderMeta(memberCount: number, leaderName: string): string {
  const noun = memberCount === 1 ? "member" : "members";
  const leader = leaderName.trim() || "the leader";
  return `${memberCount} ${noun} · Led by ${leader}`;
}

export function groupsSettingsValue(count: number): string {
  if (count <= 0) return "Join";
  return String(count);
}

export function normalizeGroupCode(value: string): string {
  return value
    .toUpperCase()
    .split("")
    .filter((char) => CODE_ALPHABET.includes(char))
    .join("")
    .slice(0, GROUP_CODE_LENGTH);
}

/** Design: `4K7 – QXM`. */
export function formatGroupCode(value: string): string {
  const code = normalizeGroupCode(value);
  if (code.length <= 3) return code;
  return `${code.slice(0, 3)} – ${code.slice(3)}`;
}

export function groupCodeFromLocation(search: string): string | null {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const code = normalizeGroupCode(query.get("group") ?? "");
  return code.length === GROUP_CODE_LENGTH ? code : null;
}

type CodeStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function rememberGroupCode(storage: CodeStore, search: string): string | null {
  const fromUrl = groupCodeFromLocation(search);
  if (fromUrl) {
    storage.setItem(GROUP_CODE_STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  const stored = normalizeGroupCode(storage.getItem(GROUP_CODE_STORAGE_KEY) ?? "");
  return stored.length === GROUP_CODE_LENGTH ? stored : null;
}

export function forgetGroupCode(storage: CodeStore): void {
  storage.removeItem(GROUP_CODE_STORAGE_KEY);
}

export function groupInviteUrl(origin: string, base: string, code: string): string {
  const url = new URL(authRedirectUrl(origin, base));
  url.searchParams.set("group", normalizeGroupCode(code));
  return url.toString();
}

export function groupInviteShareText(url: string): string {
  return `Would you read with us on Drip by drip? You’ll see who read today — never answers or notes. ${url}`;
}

export function optionalDropNote(value: string | null | undefined): NudgeNote | null {
  if (value == null || value.trim() === "") return null;
  return isNudgeNote(value) ? value : null;
}

export function dropNoteChoices(): readonly (NudgeNote | null)[] {
  return [null, ...NUDGE_NOTES];
}

export function dropNoteLabel(note: NudgeNote | null): string {
  return note ?? "Just a drop";
}

/** Friends are people you share a group or a partnership with. No follower graph. */
export function friendIds(input: { selfId: string; partnerIds: readonly string[]; memberIds: readonly string[] }): string[] {
  const ids = new Set<string>();
  for (const id of [...input.partnerIds, ...input.memberIds]) {
    if (id && id !== input.selfId) ids.add(id);
  }
  return [...ids];
}

export type PartnerCandidate = {
  id: string;
  displayName: string;
  groupName: string;
};

export function partnerCandidates(input: {
  selfId: string;
  partnerIds: readonly string[];
  people: readonly { id: string; displayName: string; groupName: string }[];
  query: string;
}): PartnerCandidate[] {
  const taken = new Set(input.partnerIds);
  const query = input.query.trim().toLowerCase();
  const byId = new Map<string, PartnerCandidate>();
  for (const person of input.people) {
    if (!person.id || person.id === input.selfId || taken.has(person.id)) continue;
    const name = person.displayName.trim();
    if (!name) continue;
    if (query && !name.toLowerCase().includes(query)) continue;
    if (!byId.has(person.id)) byId.set(person.id, { id: person.id, displayName: name, groupName: person.groupName });
  }
  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function avatarTone(index: number, flags: { self: boolean; owner: boolean }): AvatarTone {
  if (flags.self) return "self";
  if (flags.owner) return "owner";
  const cycle: AvatarTone[] = ["warm", "subtle", "accent"];
  return cycle[index % cycle.length] ?? "subtle";
}

export function quietDropLine(senderName: string, body: NudgeNote | null): string {
  if (body) return body;
  const name = senderName.trim() || "Someone";
  return `${name} sent a drop.`;
}

export function receivedDrops<T extends { fromSelf: boolean; day: string; seen: boolean }>(drops: readonly T[], today: string): T[] {
  return drops.filter((drop) => !drop.fromSelf && (drop.day === today || !drop.seen));
}

/** A code invite is 8 characters. Group codes stay at 6, so this never accepts one by accident. */
export function isPartnerInviteCode(value: string): boolean {
  return normalizeInviteCode(value).length === 8;
}

export type VisibleDrop = {
  id: string;
  senderId: string;
  recipientId: string;
  body: NudgeNote | null;
  day: string;
  fromSelf: boolean;
  seen: boolean;
};

type RawDrop = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string | null;
  day: string;
  seen: boolean;
  answer?: unknown;
  book?: unknown;
  note?: unknown;
};

/** Drops win. A legacy nudge is shown only when that id was not copied into drops. */
export function visibleDrops(input: { selfId: string; drops: readonly RawDrop[]; nudges: readonly RawDrop[] }): VisibleDrop[] {
  const seen = new Set<string>();
  const rows: VisibleDrop[] = [];
  for (const raw of [...input.drops, ...input.nudges]) {
    if (!raw.id || seen.has(raw.id)) continue;
    if (raw.senderId === raw.recipientId) continue;
    const body = optionalDropNote(raw.body);
    if (raw.body && !body) continue;
    seen.add(raw.id);
    rows.push({
      id: raw.id,
      senderId: raw.senderId,
      recipientId: raw.recipientId,
      body,
      day: raw.day,
      fromSelf: raw.senderId === input.selfId,
      seen: raw.seen,
    });
  }
  return rows;
}

export function assemblePartners(input: {
  selfId: string;
  today: string;
  partnerships: readonly { userLow: string; userHigh: string }[];
  names: ReadonlyMap<string, string | null>;
  readDays: ReadonlySet<string>;
}): PersonSignal[] {
  const people: PersonSignal[] = [];
  for (const partnership of input.partnerships) {
    const id = otherPartnerId(input.selfId, partnership.userLow, partnership.userHigh);
    if (!id || people.some((person) => person.id === id)) continue;
    people.push(
      projectPerson({
        id,
        displayName: input.names.get(id),
        readToday: input.readDays.has(id),
      }),
    );
  }
  return people.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type GroupCard = {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  role: GroupRole;
  memberCount: number;
  readCount: number;
  preview: PersonSignal[];
};

export function assembleGroups(input: {
  selfId: string;
  groups: readonly { id: string; name: string; description: string | null; ownerId: string }[];
  members: readonly { groupId: string; userId: string; role: string; displayName: string | null }[];
  readIds: ReadonlySet<string>;
}): GroupCard[] {
  return input.groups
    .map((group) => {
      const members = input.members.filter((member) => member.groupId === group.id);
      const mine = members.find((member) => member.userId === input.selfId);
      const role: GroupRole = mine?.role === "owner" || group.ownerId === input.selfId ? "owner" : "member";
      const signals = members
        .map((member) =>
          projectPerson({
            id: member.userId,
            displayName: member.displayName,
            readToday: input.readIds.has(member.userId),
          }),
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      return {
        id: group.id,
        name: group.name.trim() || "Group",
        description: group.description?.trim() || null,
        ownerId: group.ownerId,
        role,
        memberCount: members.length,
        readCount: signals.filter((person) => person.readToday).length,
        preview: signals.slice(0, 4),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type HomeMember = PersonSignal & {
  role: GroupRole;
  self: boolean;
  sentDropToday: boolean;
};

export function assembleHomeMembers(input: {
  selfId: string;
  ownerId: string;
  members: readonly { userId: string; role: string; displayName: string | null }[];
  readIds: ReadonlySet<string>;
  sentToday: ReadonlySet<string>;
}): HomeMember[] {
  return input.members
    .map((member) => {
      const role: GroupRole = member.role === "owner" || member.userId === input.ownerId ? "owner" : "member";
      return {
        ...projectPerson({
          id: member.userId,
          displayName: member.userId === input.selfId ? member.displayName : member.displayName,
          readToday: input.readIds.has(member.userId),
        }),
        role,
        self: member.userId === input.selfId,
        sentDropToday: input.sentToday.has(member.userId),
      };
    })
    .sort((a, b) => {
      if (a.readToday !== b.readToday) return a.readToday ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
}
