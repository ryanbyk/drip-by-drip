import { authRedirectUrl } from "../lib/auth";

/** Canned grace notes. The database allow-list is the same three strings. */
export const NUDGE_NOTES = [
  "Thinking of you. How’s the Word today?",
  "A quiet hello. The Word will still be here whenever you’re ready.",
  "Praying you get a drip in today, whenever it fits.",
] as const;

export type NudgeNote = (typeof NUDGE_NOTES)[number];

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const PARTNER_CODE_STORAGE_KEY = "drip-by-drip.partner-invite";

export type PartnerCodeStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type PartnerNudgeView = {
  id: string;
  body: NudgeNote;
  day: string;
  fromSelf: boolean;
  seen: boolean;
};

export type PartnerLoad = {
  partner: { displayName: string; readToday: boolean } | null;
  invite: { code: string; expiresAt: string } | null;
  nudges: PartnerNudgeView[];
};

const SHAME = [/missed/i, /failed/i, /behind/i, /should have/i, /guilt/i, /not today/i];

export function isNudgeNote(value: string): value is NudgeNote {
  return (NUDGE_NOTES as readonly string[]).includes(value);
}

export function nudgeNotesAreGentle(notes: readonly string[] = NUDGE_NOTES): boolean {
  return notes.every((note) => note.trim().length > 0 && !SHAME.some((pattern) => pattern.test(note)));
}

export function normalizeInviteCode(value: string): string {
  return value
    .toUpperCase()
    .split("")
    .filter((char) => CODE_ALPHABET.includes(char))
    .join("");
}

export function formatInviteCode(value: string): string {
  const code = normalizeInviteCode(value);
  if (code.length <= 4) return code;
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function partnerCodeFromLocation(search: string): string | null {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const code = normalizeInviteCode(query.get("partner") ?? "");
  return code.length === 8 ? code : null;
}

export function rememberPartnerCode(storage: PartnerCodeStore, search: string): string | null {
  const fromUrl = partnerCodeFromLocation(search);
  if (fromUrl) {
    storage.setItem(PARTNER_CODE_STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  const stored = normalizeInviteCode(storage.getItem(PARTNER_CODE_STORAGE_KEY) ?? "");
  return stored.length === 8 ? stored : null;
}

export function forgetPartnerCode(storage: PartnerCodeStore): void {
  storage.removeItem(PARTNER_CODE_STORAGE_KEY);
}

export function partnerInviteUrl(origin: string, base: string, code: string): string {
  const url = new URL(authRedirectUrl(origin, base));
  url.searchParams.set("partner", normalizeInviteCode(code));
  return url.toString();
}

export function partnerInviteLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host.replace(/^www\./, "")}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function partnerInviteShareText(url: string): string {
  return `Would you read alongside me on Drip by drip? This invite is just for the two of us. We’ll see whether the other read today — never answers. A note stays private unless someone shares it. ${url}`;
}

export function inviteExpiryLabel(expiresAt: string, now = new Date()): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "Reset anytime";
  if (date.getTime() <= now.getTime()) return "This code has expired · Reset anytime";
  const formatted = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  return `Expires ${formatted} · Reset anytime`;
}

export function otherPartnerId(selfId: string, userLow: string, userHigh: string): string | null {
  if (selfId === userLow && selfId !== userHigh) return userHigh;
  if (selfId === userHigh && selfId !== userLow) return userLow;
  return null;
}

export function partnerDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  return trimmed || "Your partner";
}

/** A completed drip is the only signal. Anything else stays unspoken. */
export function partnerReadLabel(readToday: boolean): "Read today" | null {
  if (readToday) return "Read today";
  return null;
}

export function partnerSettingsValue(input: { partnerName: string | null; inviteOpen: boolean; extra?: number }): string {
  if (input.partnerName) {
    if (input.extra && input.extra > 0) return `${input.partnerName} + ${input.extra}`;
    return input.partnerName;
  }
  if (input.inviteOpen) return "Invite ready";
  return "Invite";
}

export function canSendNudge(nudges: readonly { fromSelf: boolean; day: string }[], today: string): boolean {
  return !nudges.some((nudge) => nudge.fromSelf && nudge.day === today);
}

export function toPartnerLoad(input: {
  selfId: string;
  today: string;
  partnership: { userLow: string; userHigh: string } | null;
  displayName: string | null;
  readDay: string | null;
  invite: { code: string; expiresAt: string } | null;
  nudges: readonly { id: string; senderId: string; body: string; day: string; seen: boolean }[];
}): PartnerLoad {
  const partnerId = input.partnership
    ? otherPartnerId(input.selfId, input.partnership.userLow, input.partnership.userHigh)
    : null;
  const nudges: PartnerNudgeView[] = [];
  for (const nudge of input.nudges) {
    if (!isNudgeNote(nudge.body)) continue;
    nudges.push({
      id: nudge.id,
      body: nudge.body,
      day: nudge.day,
      fromSelf: nudge.senderId === input.selfId,
      seen: nudge.seen,
    });
  }
  return {
    partner: partnerId
      ? {
          displayName: partnerDisplayName(input.displayName),
          readToday: input.readDay === input.today,
        }
      : null,
    invite: input.invite && normalizeInviteCode(input.invite.code).length === 8 ? input.invite : null,
    nudges,
  };
}

export function parseInviteResult(data: unknown): { code: string; expiresAt: string } | { error: string } {
  if (!data || typeof data !== "object") {
    return { error: "Couldn’t create an invite just now. Try again in a moment." };
  }
  const row = data as { error?: unknown; code?: unknown; expires_at?: unknown };
  if (typeof row.error === "string" && row.error.trim()) return { error: row.error };
  const code = typeof row.code === "string" ? normalizeInviteCode(row.code) : "";
  if (code.length === 8 && typeof row.expires_at === "string" && row.expires_at) {
    return { code, expiresAt: row.expires_at };
  }
  return { error: "Couldn’t create an invite just now. Try again in a moment." };
}

export function parseLookupResult(data: unknown): { inviterName: string; own: boolean } | { error: string } {
  if (!data || typeof data !== "object") return { error: "That invite isn’t open." };
  const row = data as { error?: unknown; own?: unknown; inviter_name?: unknown };
  if (typeof row.error === "string" && row.error.trim()) return { error: row.error };
  const own = row.own === true;
  const name = typeof row.inviter_name === "string" ? row.inviter_name.trim() : "";
  if (own) return { inviterName: name || "You", own: true };
  if (!name) return { error: "That invite isn’t open." };
  return { inviterName: name, own: false };
}

export function parseActionError(data: unknown, fallback: string): string | null {
  if (!data || typeof data !== "object") return fallback;
  const error = (data as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  return null;
}

/** The only fields a read-today write is allowed to carry. */
export function readDayChange(day: string, readDone: boolean): { day: string; read: boolean } {
  return { day, read: readDone };
}
