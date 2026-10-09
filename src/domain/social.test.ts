import { describe, expect, it } from "vitest";
import { pageOriginForLinks } from "../lib/appUrl";
import { NUDGE_NOTES } from "./partner";
import {
  DROP_DAILY_LIMIT,
  GROUP_MEMBER_CAP,
  PARTNER_CAP,
  assembleGroups,
  assembleHomeMembers,
  assemblePartners,
  avatarTone,
  canAddPartner,
  canJoinGroup,
  canSendDrop,
  formatGroupCode,
  friendIds,
  groupCodeFromLocation,
  groupHomeReadLabel,
  groupInviteShareText,
  groupInviteUrl,
  groupListReadLabel,
  groupsSettingsValue,
  memberCountLabel,
  normalizeGroupCode,
  partnerCandidates,
  partnerReadLine,
  projectPerson,
  quietDropLine,
  readCount,
  receivedDrops,
  rememberGroupCode,
  visibleDrops,
} from "./social";

describe("v1.5b caps", () => {
  it("locks the defaults", () => {
    expect(GROUP_MEMBER_CAP).toBe(20);
    expect(PARTNER_CAP).toBe(5);
    expect(DROP_DAILY_LIMIT).toBe(1);
  });

  it("stops a new partner or member at the cap", () => {
    expect(canAddPartner(0)).toBe(true);
    expect(canAddPartner(4)).toBe(true);
    expect(canAddPartner(5)).toBe(false);
    expect(canJoinGroup(19)).toBe(true);
    expect(canJoinGroup(20)).toBe(false);
  });
});

describe("drops", () => {
  const today = "2026-10-08";

  it("allows one drop per sender per recipient per local day", () => {
    const sent = [{ senderId: "me", recipientId: "dan", day: today }];
    expect(canSendDrop(sent, { senderId: "me", recipientId: "dan", day: today })).toBe(false);
    expect(canSendDrop(sent, { senderId: "me", recipientId: "jon", day: today })).toBe(true);
    expect(canSendDrop(sent, { senderId: "me", recipientId: "dan", day: "2026-10-09" })).toBe(true);
    expect(canSendDrop(sent, { senderId: "me", recipientId: "me", day: today })).toBe(false);
  });

  it("keeps a canned note and drops anything else", () => {
    const drops = visibleDrops({
      selfId: "me",
      drops: [
        {
          id: "d1",
          senderId: "dan",
          recipientId: "me",
          body: NUDGE_NOTES[0],
          day: today,
          seen: false,
          answer: "not_today",
          book: "Mark",
          note: "private",
        },
        { id: "d2", senderId: "me", recipientId: "dan", body: null, day: today, seen: true },
        { id: "d3", senderId: "jon", recipientId: "me", body: "You missed yesterday", day: today, seen: false },
      ],
      nudges: [{ id: "d1", senderId: "dan", recipientId: "me", body: NUDGE_NOTES[1], day: today, seen: true }],
    });
    expect(drops).toEqual([
      { id: "d1", senderId: "dan", recipientId: "me", body: NUDGE_NOTES[0], day: today, fromSelf: false, seen: false },
      { id: "d2", senderId: "me", recipientId: "dan", body: null, day: today, fromSelf: true, seen: true },
    ]);
    expect(JSON.stringify(drops)).not.toMatch(/not_today|Mark|private|missed/i);
    expect(quietDropLine("Dan K.", null)).toBe("Dan K. sent a drop.");
    expect(quietDropLine("Dan K.", NUDGE_NOTES[2])).toBe(NUDGE_NOTES[2]);
    expect(receivedDrops(drops, today).map((drop) => drop.id)).toEqual(["d1"]);
  });
});

describe("read today", () => {
  it("counts finished drips and stays silent at zero", () => {
    expect(readCount([{ readToday: true }, { readToday: false }, { readToday: true }])).toBe(2);
    expect(groupListReadLabel(0)).toBeNull();
    expect(groupListReadLabel(1)).toBe("1 read today");
    expect(groupListReadLabel(5)).toBe("5 read today");
    expect(groupHomeReadLabel(0)).toBeNull();
    expect(groupHomeReadLabel(5)).toBe("5 have read");
    expect(partnerReadLine("Dan K.", true)).toBe("Dan read today");
    expect(partnerReadLine("Dan K.", false)).toBeNull();
  });

  it("shows a group from names and read days only", () => {
    const cards = assembleGroups({
      selfId: "me",
      groups: [{ id: "g1", name: "Tuesday Night", description: "  fall  ", ownerId: "me" }],
      members: [
        { groupId: "g1", userId: "me", role: "owner", displayName: "Ryan" },
        { groupId: "g1", userId: "dan", role: "member", displayName: "Dan K.", book: "Mark" } as {
          groupId: string;
          userId: string;
          role: string;
          displayName: string | null;
        },
      ],
      readIds: new Set(["dan"]),
    });
    expect(cards[0]).toMatchObject({
      name: "Tuesday Night",
      description: "fall",
      role: "owner",
      memberCount: 2,
      readCount: 1,
    });
    expect(cards[0]?.preview).toEqual([
      { id: "dan", displayName: "Dan K.", readToday: true },
      { id: "me", displayName: "Ryan", readToday: false },
    ]);
    expect(JSON.stringify(cards)).not.toMatch(/Mark/);
    expect(memberCountLabel(2)).toBe("2 members · Everyone reads their own book");

    const home = assembleHomeMembers({
      selfId: "me",
      ownerId: "me",
      members: [
        { userId: "me", role: "owner", displayName: "Ryan" },
        { userId: "dan", role: "member", displayName: "Dan K." },
      ],
      readIds: new Set(["dan"]),
      sentToday: new Set(["dan"]),
    });
    expect(home.map((member) => member.id)).toEqual(["dan", "me"]);
    expect(home[0]).toMatchObject({ readToday: true, sentDropToday: true, self: false });
    expect(home[1]).toMatchObject({ readToday: false, self: true, role: "owner" });
  });
});

describe("friends and invites", () => {
  it("treats shared groups and partnerships as friends, without a follower list", () => {
    expect(friendIds({ selfId: "me", partnerIds: ["dan", "me"], memberIds: ["dan", "kate"] })).toEqual(["dan", "kate"]);
  });

  it("offers group members who are not already partners", () => {
    const people = partnerCandidates({
      selfId: "me",
      partnerIds: ["dan"],
      people: [
        { id: "dan", displayName: "Dan K.", groupName: "Men" },
        { id: "kate", displayName: "Kate B.", groupName: "Family" },
        { id: "jon", displayName: "Jon M.", groupName: "Men" },
        { id: "jon", displayName: "Jon M.", groupName: "Family" },
        { id: "me", displayName: "Ryan", groupName: "Men" },
      ],
      query: "j",
    });
    expect(people).toEqual([{ id: "jon", displayName: "Jon M.", groupName: "Men" }]);
  });

  it("formats a 6-character group code and link", () => {
    expect(normalizeGroupCode("4k7-qxm")).toBe("4K7QXM");
    expect(formatGroupCode("4k7qxm")).toBe("4K7 – QXM");
    expect(groupCodeFromLocation("?group=4K7-QXM&partner=ABCD2345")).toBe("4K7QXM");
    expect(groupCodeFromLocation("?partner=4K7QXM2P")).toBeNull();
    const url = groupInviteUrl(pageOriginForLinks("https://ryanbyk.github.io"), "/", "4K7QXM");
    expect(url).toBe("https://app.drip-by-drip.com/?group=4K7QXM");
    expect(groupInviteUrl(pageOriginForLinks("http://localhost:5173"), "/", "4K7QXM")).toBe(
      "http://localhost:5173/?group=4K7QXM",
    );
    expect(groupInviteShareText(url)).toContain("never answers");
    expect(groupInviteShareText(url)).toContain("unless someone shares it");
    expect(memberCountLabel(8, "Reading through Mark")).toBe("8 members · Reading through Mark");
    expect(groupInviteShareText(url)).not.toMatch(/not today/i);
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
    expect(rememberGroupCode(storage, "?group=4K7QXM")).toBe("4K7QXM");
    expect(rememberGroupCode(storage, "")).toBe("4K7QXM");
  });

  it("keeps a partner list to display name and read-today", () => {
    const partners = assemblePartners({
      selfId: "me",
      today: "2026-10-08",
      partnerships: [
        { userLow: "ada", userHigh: "me" },
        { userLow: "me", userHigh: "dan" },
      ],
      names: new Map([
        ["ada", "Ada"],
        ["dan", "Dan K."],
      ]),
      readDays: new Set(["dan"]),
    });
    expect(partners).toEqual([
      { id: "ada", displayName: "Ada", readToday: false },
      { id: "dan", displayName: "Dan K.", readToday: true },
    ]);
    expect(projectPerson({ id: "dan", displayName: "Dan", readToday: false, answer: "yes", huh: true, book: "Mark" })).toEqual({
      id: "dan",
      displayName: "Dan",
      readToday: false,
    });
    expect(groupsSettingsValue(0)).toBe("Join");
    expect(groupsSettingsValue(3)).toBe("3");
    expect(avatarTone(0, { self: true, owner: true })).toBe("self");
    expect(avatarTone(1, { self: false, owner: true })).toBe("owner");
    expect(avatarTone(2, { self: false, owner: false })).toBe("accent");
  });
});
