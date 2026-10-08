import { describe, expect, it } from "vitest";
import { SHARE_NOTE_PROMISE, SHARED_NOTE_MAX, buildNoteShare, canDropOnNote } from "./sharedNote";

describe("shared notes", () => {
  it("shares only the note text with the people you pick", () => {
    const share = buildNoteShare({
      day: "2026-10-08",
      reflection: "  The storm stills.  ",
      groupIds: ["mens", "strangers", "mens"],
      partnerIds: ["dan", "dan"],
      allowedGroupIds: new Set(["mens"]),
      allowedPartnerIds: new Set(["dan"]),
    });
    expect(share).toEqual({
      day: "2026-10-08",
      body: "The storm stills.",
      groupIds: ["mens"],
      partnerIds: ["dan"],
    });
    expect(share).not.toHaveProperty("huh");
    expect(share).not.toHaveProperty("answer");
    expect(SHARE_NOTE_PROMISE).toMatch(/Only the people you pick/);
  });

  it("stays off when the note is empty or nobody you chose can receive it", () => {
    expect(
      buildNoteShare({
        day: "2026-10-08",
        reflection: "   ",
        groupIds: ["mens"],
        partnerIds: [],
        allowedGroupIds: new Set(["mens"]),
        allowedPartnerIds: new Set(),
      }),
    ).toBeNull();
    expect(
      buildNoteShare({
        day: "2026-10-08",
        reflection: "A note",
        groupIds: ["other"],
        partnerIds: ["stranger"],
        allowedGroupIds: new Set(["mens"]),
        allowedPartnerIds: new Set(["dan"]),
      }),
    ).toBeNull();
  });

  it("caps the body and reuses the one daily drop", () => {
    const share = buildNoteShare({
      day: "2026-10-08",
      reflection: "x".repeat(SHARED_NOTE_MAX + 40),
      groupIds: ["mens"],
      partnerIds: [],
      allowedGroupIds: new Set(["mens"]),
      allowedPartnerIds: new Set(),
    });
    expect(share?.body).toHaveLength(SHARED_NOTE_MAX);
    const sent = [{ senderId: "ryan", recipientId: "dan", day: "2026-10-08" }];
    expect(canDropOnNote(sent, { senderId: "ryan", recipientId: "dan", day: "2026-10-08" })).toBe(false);
    expect(canDropOnNote([], { senderId: "ryan", recipientId: "dan", day: "2026-10-08" })).toBe(true);
  });
});
