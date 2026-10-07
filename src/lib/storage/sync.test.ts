import { describe, expect, it, vi } from "vitest";
import type { Snapshot } from "../../domain/types";
import { createSnapshot, reducer } from "../../state/reducer";
import {
  SNAPSHOT_OWNER_KEY,
  chooseSnapshot,
  readSnapshotOwner,
  syncAccountSnapshot,
  writeSnapshotOwner,
  type CloudSnapshotIO,
  type OwnerStore,
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

  it("adopts a newer cloud snapshot and pushes a newer local one", () => {
    const remote = snap(20, "07:00");
    const older = chooseSnapshot(snap(10), remote, "user-a", "user-a");
    const newer = chooseSnapshot(snap(30), remote, null, "user-a");
    expect(older).toEqual({ kind: "adopt", snapshot: remote });
    expect(newer.kind).toBe("push");
  });

  it("adopts the cloud snapshot when this device has never saved", () => {
    const remote = snap(5, "08:15");
    expect(chooseSnapshot(snap(0), remote, null, "user-a")).toEqual({ kind: "adopt", snapshot: remote });
  });

  it("does not upload another account’s local reading", () => {
    const remote = snap(4, "09:00");
    expect(chooseSnapshot(snap(50), remote, "user-a", "user-b")).toEqual({ kind: "adopt", snapshot: remote });
    expect(chooseSnapshot(snap(50), null, "user-a", "user-b").kind).toBe("keep");
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
    const owner = ownerStore();
    const result = await syncAccountSnapshot(local, { userId: "user-a", enabled: true }, remote, owner, async () => true);
    expect(result).toEqual({ snapshot: local, failed: false });
    expect(remote.writes).toEqual([local]);
    expect(owner.data[SNAPSHOT_OWNER_KEY]).toBe("user-a");
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
