import { describe, expect, it, vi } from "vitest";
import type { DailyCommitment, GroupPlanFollow, Snapshot } from "../../domain/types";
import { createSnapshot, reducer } from "../../state/reducer";
import {
  SNAPSHOT_OWNER_KEY,
  chooseSnapshot,
  readSnapshotOwner,
  syncAccountSnapshot,
  writeSnapshotOwner,
  type CloudSnapshotIO,
  type OwnerStore,
  type SnapshotChoice,
} from "./sync";

function ownerStore(initial?: string): OwnerStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  if (initial) data[SNAPSHOT_OWNER_KEY] = initial;
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function snap(updatedAt: number, askTime = "06:30"): Snapshot {
  const base = createSnapshot();
  return {
    ...base,
    updatedAt,
    prefs: { ...base.prefs, askTime, onboardingComplete: updatedAt > 0 },
  };
}

function commitment(date: string, partial: Partial<DailyCommitment> = {}): DailyCommitment {
  return {
    date,
    answer: "unanswered",
    readDone: false,
    huh: false,
    detour: false,
    ...partial,
  };
}

function chosen(choice: SnapshotChoice): Snapshot {
  if (choice.kind === "keep") throw new Error("expected a snapshot");
  return choice.snapshot;
}

function cloud(remote: Snapshot | null, fail: "read" | "write" | null = null): CloudSnapshotIO & { writes: Snapshot[] } {
  const writes: Snapshot[] = [];
  return {
    writes,
    read: vi.fn(async () => {
      if (fail === "read") throw new Error("offline");
      return remote;
    }),
    write: vi.fn(async (_userId: string, snapshot: Snapshot) => {
      if (fail === "write") return false;
      writes.push(snapshot);
      return true;
    }),
  };
}

describe("chooseSnapshot", () => {
  it("pushes local reading when the account has nothing stored", () => {
    expect(chooseSnapshot(snap(10), null, null, "user-a").kind).toBe("push");
  });

  it("keeps an untouched local snapshot when the account is also empty", () => {
    expect(chooseSnapshot(snap(0), null, null, "user-a").kind).toBe("keep");
  });

  it("adopts a newer cloud snapshot and pushes a newer local one from this account", () => {
    const remote = snap(20, "07:00");
    const older = chooseSnapshot(snap(10), remote, "user-a", "user-a");
    const newer = chooseSnapshot(snap(30, "05:00"), remote, "user-a", "user-a");
    expect(older).toEqual({ kind: "adopt", snapshot: remote });
    expect(newer.kind).toBe("push");
    expect(chosen(newer).prefs.askTime).toBe("05:00");
  });

  it("carries a followed group plan with the prefs that win the merge", () => {
    const plan: GroupPlanFollow = {
      planId: "plan-1",
      groupId: "group-1",
      groupName: "Men",
      bookId: "MRK",
      startChapter: 1,
      endChapter: 16,
      pace: "chapter",
      readingDays: 62,
      startDate: "2026-10-01",
      mode: "group",
      startedOn: "2026-10-08",
    };
    const local = snap(30);
    local.prefs = { ...local.prefs, groupPlan: plan };
    const kept = chooseSnapshot(local, snap(10), "user-a", "user-a");
    expect(chosen(kept).prefs.groupPlan).toEqual(plan);

    const account = snap(40);
    account.prefs = { ...account.prefs, groupPlan: { ...plan, groupName: "Family" } };
    const fresh = chooseSnapshot(snap(50), account, null, "user-a");
    expect(chosen(fresh).prefs.groupPlan?.groupName).toBe("Family");
  });

  it("does not let a fresh device replace saved account preferences", () => {
    const remote = snap(20, "07:00");
    const choice = chooseSnapshot(snap(30, "05:00"), remote, null, "user-a");
    expect(choice.kind).toBe("adopt");
    expect(chosen(choice).prefs).toBe(remote.prefs);
    expect(chosen(choice).updatedAt).toBe(30);
  });

  it("adopts the cloud snapshot when this device has never saved", () => {
    const remote = snap(5, "08:15");
    expect(chooseSnapshot(snap(0), remote, null, "user-a")).toEqual({ kind: "adopt", snapshot: remote });
  });

  it("does not upload another account’s local reading", () => {
    const remote = snap(4, "09:00");
    const local = snap(50);
    local.days = { "2026-10-01": commitment("2026-10-01", { answer: "yes", readDone: true, passageRef: "Mark 2" }) };
    expect(chooseSnapshot(local, remote, "user-a", "user-b")).toEqual({ kind: "adopt", snapshot: remote });
    expect(chooseSnapshot(local, null, "user-a", "user-b").kind).toBe("keep");
    expect(remote.days).toEqual({});
  });

  it("keeps remote history when a fresh device only finished onboarding", () => {
    const local = snap(500, "05:00");
    const remote = snap(100, "07:15");
    remote.days = {
      "2026-10-01": commitment("2026-10-01", {
        answer: "yes",
        readDone: true,
        reflection: "Soil",
        readDoneAt: "2026-10-01T07:00:00.000Z",
      }),
    };
    remote.places = { mark: { bookId: "mark", chapter: 4, verse: 1 } };
    const snapshot = chosen(chooseSnapshot(local, remote, null, "user-a"));
    expect(snapshot.days["2026-10-01"]?.readDone).toBe(true);
    expect(snapshot.days["2026-10-01"]?.reflection).toBe("Soil");
    expect(snapshot.prefs.askTime).toBe("07:15");
    expect(snapshot.prefs.onboardingComplete).toBe(true);
    expect(snapshot.places.mark).toEqual({ bookId: "mark", chapter: 4, verse: 1 });
    expect(snapshot.updatedAt).toBe(500);
  });

  it("keeps local history when a newer cloud snapshot is empty", () => {
    const local = snap(100, "06:30");
    local.days = {
      "2026-09-01": commitment("2026-09-01", { answer: "yes", readDone: true, passageRef: "Mark 2" }),
    };
    local.places = { mark: { bookId: "mark", chapter: 3, verse: 1 } };
    const remote = snap(900, "08:00");
    const snapshot = chosen(chooseSnapshot(local, remote, "user-a", "user-a"));
    expect(snapshot.days["2026-09-01"]?.passageRef).toBe("Mark 2");
    expect(snapshot.places.mark).toEqual({ bookId: "mark", chapter: 3, verse: 1 });
    expect(snapshot.prefs.askTime).toBe("08:00");
    expect(snapshot.updatedAt).toBe(900);
  });

  it("unions days and notes and keeps the furthest place in each book", () => {
    const local = snap(10, "06:30");
    local.days = {
      "2026-10-01": commitment("2026-10-01", { answer: "yes", readDone: true, passageRef: "Mark 1" }),
      "2026-10-03": commitment("2026-10-03", { reflection: "Sat with the sower.", huh: true, verseTags: ["4:9"] }),
    };
    local.places = {
      mark: { bookId: "mark", chapter: 2, verse: 1, countedThrough: 10 },
      john: { bookId: "john", chapter: 3, verse: 5 },
    };
    const remote = snap(20, "07:00");
    remote.days = {
      "2026-10-02": commitment("2026-10-02", { answer: "not_today", answeredAt: "2026-10-02T08:00:00.000Z" }),
      "2026-10-03": commitment("2026-10-03", {
        answer: "yes",
        readDone: true,
        readDoneAt: "2026-10-03T07:00:00.000Z",
        passageRef: "Mark 4",
        verseTags: ["4:20"],
      }),
    };
    remote.places = { mark: { bookId: "mark", chapter: 8, verse: 2, countedThrough: 3 } };
    const choice = chooseSnapshot(local, remote, "user-a", "user-a");
    expect(choice.kind).toBe("sync");
    const snapshot = chosen(choice);
    expect(Object.keys(snapshot.days).sort()).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(snapshot.days["2026-10-03"]?.readDone).toBe(true);
    expect(snapshot.days["2026-10-03"]?.passageRef).toBe("Mark 4");
    expect(snapshot.days["2026-10-03"]?.reflection).toBe("Sat with the sower.");
    expect(snapshot.days["2026-10-03"]?.huh).toBe(true);
    expect(snapshot.days["2026-10-03"]?.verseTags).toEqual(["4:20", "4:9"]);
    expect(snapshot.places.mark).toEqual({ bookId: "mark", chapter: 8, verse: 2, countedThrough: 10 });
    expect(snapshot.places.john).toEqual({ bookId: "john", chapter: 3, verse: 5 });
    expect(snapshot.prefs.askTime).toBe("07:00");
  });

  it("keeps the later day when both readings are equally complete", () => {
    const local = snap(10);
    local.days = {
      "2026-10-04": commitment("2026-10-04", {
        answer: "yes",
        readDone: true,
        readDoneAt: "2026-10-04T08:00:00.000Z",
        passageRef: "Mark 1",
      }),
    };
    const remote = snap(10);
    remote.days = {
      "2026-10-04": commitment("2026-10-04", {
        answer: "yes",
        readDone: true,
        readDoneAt: "2026-10-04T09:00:00.000Z",
        passageRef: "Mark 2",
      }),
    };
    expect(chosen(chooseSnapshot(local, remote, "user-a", "user-a")).days["2026-10-04"]?.passageRef).toBe("Mark 2");
  });
});

describe("syncAccountSnapshot", () => {
  it("leaves guests and sync-off sessions on the device", async () => {
    const remote = cloud(snap(9));
    const owner = ownerStore();
    const writeLocal = vi.fn(async () => true);
    const guest = await syncAccountSnapshot(snap(3), { userId: null, enabled: true }, remote, owner, writeLocal);
    const paused = await syncAccountSnapshot(snap(3), { userId: "user-a", enabled: false }, remote, owner, writeLocal);
    expect(guest.snapshot.updatedAt).toBe(3);
    expect(paused.snapshot.updatedAt).toBe(3);
    expect(remote.read).not.toHaveBeenCalled();
    expect(writeLocal).not.toHaveBeenCalled();
  });

  it("pulls a newer cloud snapshot into local storage and records the owner", async () => {
    const remoteSnap = snap(40, "07:45");
    const remote = cloud(remoteSnap);
    const owner = ownerStore();
    const saved: Snapshot[] = [];
    const result = await syncAccountSnapshot(snap(0), { userId: "user-a", enabled: true }, remote, owner, async (next) => {
      saved.push(next);
      return true;
    });
    expect(result.failed).toBe(false);
    expect(result.snapshot).toBe(remoteSnap);
    expect(saved).toEqual([remoteSnap]);
    expect(readSnapshotOwner(owner)).toBe("user-a");
    expect(remote.writes).toEqual([]);
  });

  it("pushes a past day marked read with the bookmark it advanced", async () => {
    const local = reducer(
      reducer(createSnapshot(), {
        type: "completeOnboarding",
        today: "2026-10-06",
        at: "2026-10-06T12:00:00.000Z",
        mode: "book",
        bookId: "mark",
        dripSize: "chapter",
        startChapter: 4,
        askTime: "06:30",
      }),
      { type: "markPastRead", date: "2026-10-07", today: "2026-10-08", at: "2026-10-08T12:00:00.000Z" },
    );
    const remote = cloud(snap(1));
    const owner = ownerStore("user-a");
    const result = await syncAccountSnapshot(local, { userId: "user-a", enabled: true }, remote, owner, async () => true);
    expect(result.failed).toBe(false);
    expect(result.snapshot.days["2026-10-07"]?.readDone).toBe(true);
    expect(remote.writes[0]?.days["2026-10-07"]?.passageRef).toBe("Mark 4");
    expect(remote.writes[0]?.places.mark).toEqual({ bookId: "mark", chapter: 5, verse: 1 });
  });

  it("pushes a newer local snapshot and records the owner", async () => {
    const local = snap(12, "05:00");
    const remote = cloud(snap(2));
    const owner = ownerStore("user-a");
    const result = await syncAccountSnapshot(local, { userId: "user-a", enabled: true }, remote, owner, async () => true);
    expect(result).toEqual({ snapshot: local, failed: false });
    expect(remote.writes).toEqual([local]);
    expect(owner.data[SNAPSHOT_OWNER_KEY]).toBe("user-a");
  });

  it("writes a fresh device’s onboarding onto the account history instead of over it", async () => {
    const local = snap(500, "05:00");
    const remoteSnap = snap(100, "07:15");
    remoteSnap.days = {
      "2026-10-01": commitment("2026-10-01", { answer: "yes", readDone: true, passageRef: "Mark 4" }),
    };
    remoteSnap.places = { mark: { bookId: "mark", chapter: 5, verse: 1 } };
    const remote = cloud(remoteSnap);
    const owner = ownerStore();
    const saved: Snapshot[] = [];
    const result = await syncAccountSnapshot(local, { userId: "user-a", enabled: true }, remote, owner, async (next) => {
      saved.push(next);
      return true;
    });
    expect(result.failed).toBe(false);
    expect(result.snapshot.days["2026-10-01"]?.passageRef).toBe("Mark 4");
    expect(result.snapshot.prefs.askTime).toBe("07:15");
    expect(result.snapshot.prefs.onboardingComplete).toBe(true);
    expect(saved).toEqual([result.snapshot]);
    expect(remote.writes).toEqual([]);
    expect(readSnapshotOwner(owner)).toBe("user-a");
  });

  it("pushes local history back over a newer empty cloud snapshot", async () => {
    const local = snap(100, "06:30");
    local.days = {
      "2026-09-01": commitment("2026-09-01", { answer: "yes", readDone: true, passageRef: "Mark 2" }),
    };
    local.places = { mark: { bookId: "mark", chapter: 3, verse: 1 } };
    const remote = cloud(snap(900, "08:00"));
    const owner = ownerStore("user-a");
    const saved: Snapshot[] = [];
    const result = await syncAccountSnapshot(local, { userId: "user-a", enabled: true }, remote, owner, async (next) => {
      saved.push(next);
      return true;
    });
    expect(result.failed).toBe(false);
    expect(result.snapshot.days["2026-09-01"]?.passageRef).toBe("Mark 2");
    expect(result.snapshot.places.mark).toEqual({ bookId: "mark", chapter: 3, verse: 1 });
    expect(remote.writes).toEqual([result.snapshot]);
    expect(saved).toEqual([result.snapshot]);
    expect(readSnapshotOwner(owner)).toBe("user-a");
  });

  it("writes a union of both days locally and to the cloud", async () => {
    const local = snap(10);
    local.days = { "2026-10-01": commitment("2026-10-01", { answer: "yes", readDone: true }) };
    const remoteSnap = snap(20);
    remoteSnap.days = { "2026-10-02": commitment("2026-10-02", { answer: "not_today" }) };
    const remote = cloud(remoteSnap);
    const saved: Snapshot[] = [];
    const result = await syncAccountSnapshot(local, { userId: "user-a", enabled: true }, remote, ownerStore("user-a"), async (next) => {
      saved.push(next);
      return true;
    });
    expect(result.failed).toBe(false);
    expect(Object.keys(result.snapshot.days).sort()).toEqual(["2026-10-01", "2026-10-02"]);
    expect(remote.writes).toEqual([result.snapshot]);
    expect(saved).toEqual([result.snapshot]);
  });

  it("does not upload a foreign device’s reading when the account has a snapshot", async () => {
    const local = snap(50);
    local.days = { "2026-10-01": commitment("2026-10-01", { answer: "yes", readDone: true }) };
    const remoteSnap = snap(4, "09:00");
    const remote = cloud(remoteSnap);
    const writeLocal = vi.fn(async () => true);
    const result = await syncAccountSnapshot(local, { userId: "user-b", enabled: true }, remote, ownerStore("user-a"), writeLocal);
    expect(result).toEqual({ snapshot: remoteSnap, failed: false });
    expect(remote.writes).toEqual([]);
    expect(writeLocal).toHaveBeenCalledWith(remoteSnap);
  });

  it("keeps the local snapshot when the clocks match", async () => {
    const local = snap(8);
    const remote = cloud(snap(8));
    const owner = ownerStore("user-a");
    const writeLocal = vi.fn(async () => true);
    const result = await syncAccountSnapshot(local, { userId: "user-a", enabled: true }, remote, owner, writeLocal);
    expect(result).toEqual({ snapshot: local, failed: false });
    expect(remote.writes).toEqual([]);
    expect(writeLocal).not.toHaveBeenCalled();
  });

  it("reports a cloud failure and does not change the owner", async () => {
    const owner = ownerStore();
    const unread = await syncAccountSnapshot(snap(4), { userId: "user-a", enabled: true }, cloud(null, "read"), owner, async () => true);
    const unwritten = await syncAccountSnapshot(
      snap(4),
      { userId: "user-a", enabled: true },
      cloud(null, "write"),
      owner,
      async () => true,
    );
    expect(unread).toMatchObject({ failed: true, snapshot: { updatedAt: 4 } });
    expect(unwritten.failed).toBe(true);
    expect(readSnapshotOwner(owner)).toBeNull();
    writeSnapshotOwner(owner, "user-a");
    expect(readSnapshotOwner(owner)).toBe("user-a");
  });
});
