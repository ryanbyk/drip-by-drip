import { describe, expect, it } from "vitest";
import {
  NUDGE_NOTES,
  canSendNudge,
  formatInviteCode,
  inviteExpiryLabel,
  normalizeInviteCode,
  nudgeNotesAreGentle,
  otherPartnerId,
  parseInviteResult,
  parseLookupResult,
  partnerCodeFromLocation,
  partnerInviteShareText,
  partnerInviteUrl,
  partnerReadLabel,
  partnerSettingsValue,
  readDayChange,
  rememberPartnerCode,
  toPartnerLoad,
} from "./partner";

describe("partner invites", () => {
  it("normalizes a code and builds a link that does not carry an answer", () => {
    expect(normalizeInviteCode(" 4k7q-xm2p ")).toBe("4K7QXM2P");
    expect(formatInviteCode("4k7qxm2p")).toBe("4K7Q-XM2P");
    expect(partnerCodeFromLocation("?partner=4K7Q-XM2P&code=auth")).toBe("4K7QXM2P");
    const url = partnerInviteUrl("https://app.drip-by-drip.com", "/", "4K7QXM2P");
    expect(url).toBe("https://app.drip-by-drip.com/?partner=4K7QXM2P");
    expect(partnerInviteShareText(url)).toContain("never answers");
    expect(partnerInviteShareText(url)).toContain("unless someone shares it");
    expect(partnerInviteShareText(url)).not.toMatch(/not today/i);
  });

  it("remembers a code from the url, then from storage", () => {
    const saved = new Map<string, string>();
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saved.set(key, value);
      },
      removeItem: (key: string) => {
        saved.delete(key);
      },
    };
    expect(rememberPartnerCode(storage, "?partner=ABCD2345")).toBe("ABCD2345");
    expect(rememberPartnerCode(storage, "")).toBe("ABCD2345");
  });

  it("labels an expiry without scolding", () => {
    const expiresAt = "2026-10-20T15:00:00.000Z";
    const formatted = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(expiresAt));
    expect(inviteExpiryLabel(expiresAt, new Date("2026-10-06T12:00:00.000Z"))).toBe(`Expires ${formatted} · Reset anytime`);
  });
});

describe("partner privacy", () => {
  it("shows read today only after a drip is finished", () => {
    expect(partnerReadLabel(true)).toBe("Read today");
    expect(partnerReadLabel(false)).toBeNull();
  });

  it("drops answers, notes, and tags when building what a partner can see", () => {
    const leaked = {
      id: "n1",
      senderId: "partner",
      body: "Not today — you missed it",
      day: "2026-10-06",
      seen: false,
      answer: "not_today",
      huh: true,
      reflection: "private",
    };
    const load = toPartnerLoad({
      selfId: "self",
      today: "2026-10-06",
      partnership: { userLow: "partner", userHigh: "self" },
      displayName: "Dan K.",
      readDay: "2026-10-05",
      invite: null,
      nudges: [leaked, { id: "n2", senderId: "partner", body: NUDGE_NOTES[0], day: "2026-10-06", seen: false }],
    });
    expect(load.partner).toEqual({ displayName: "Dan K.", readToday: false });
    expect(partnerReadLabel(load.partner?.readToday ?? false)).toBeNull();
    expect(load.nudges).toEqual([
      { id: "n2", body: NUDGE_NOTES[0], day: "2026-10-06", fromSelf: false, seen: false },
    ]);
    expect(JSON.stringify(load)).not.toMatch(/not_today|huh|reflection|missed/);
    expect(otherPartnerId("self", "partner", "self")).toBe("partner");
    expect(otherPartnerId("self", "self", "self")).toBeNull();
  });

  it("writes a read day with only the day and the boolean", () => {
    const change = readDayChange("2026-10-06", true);
    expect(Object.keys(change).sort()).toEqual(["day", "read"]);
    expect(change).not.toHaveProperty("answer");
  });

  it("keeps the settings label to a name or an invite", () => {
    expect(partnerSettingsValue({ partnerName: "Dan K.", inviteOpen: true })).toBe("Dan K.");
    expect(partnerSettingsValue({ partnerName: null, inviteOpen: true })).toBe("Invite ready");
    expect(partnerSettingsValue({ partnerName: null, inviteOpen: false })).toBe("Invite");
  });

  it("allows one gentle note a day and rejects a scolding body", () => {
    expect(nudgeNotesAreGentle()).toBe(true);
    expect(canSendNudge([{ fromSelf: true, day: "2026-10-06" }], "2026-10-06")).toBe(false);
    expect(canSendNudge([{ fromSelf: false, day: "2026-10-06" }], "2026-10-06")).toBe(true);
    expect(canSendNudge([{ fromSelf: true, day: "2026-10-05" }], "2026-10-06")).toBe(true);
  });
});

describe("partner responses", () => {
  it("reads an invite payload and ignores extra fields", () => {
    expect(parseInviteResult({ code: "abcd2345", expires_at: "2026-10-20T00:00:00Z", answer: "yes" })).toEqual({
      code: "ABCD2345",
      expiresAt: "2026-10-20T00:00:00Z",
    });
    expect(parseLookupResult({ own: false, inviter_name: "Dan K.", answer: "not_today" })).toEqual({
      inviterName: "Dan K.",
      own: false,
    });
    expect(parseLookupResult({ error: "That invite isn’t open." })).toEqual({ error: "That invite isn’t open." });
  });
});
