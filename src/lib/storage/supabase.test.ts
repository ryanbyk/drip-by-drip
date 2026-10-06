import { describe, expect, it, vi } from "vitest";
import { createSnapshot } from "../../state/reducer";
import { SupabaseStorageAdapter } from "./supabase";
import type { CloudSnapshotIO } from "./sync";
import type { Snapshot } from "../../domain/types";

function fakeCloud(): CloudSnapshotIO & { writes: Array<{ userId: string; snapshot: Snapshot }> } {
  const writes: Array<{ userId: string; snapshot: Snapshot }> = [];
  let stored: Snapshot | null = null;
  return {
    writes,
    read: vi.fn(async () => stored),
    write: vi.fn(async (userId: string, snapshot: Snapshot) => {
      stored = snapshot;
      writes.push({ userId, snapshot });
      return true;
    }),
  };
}

describe("SupabaseStorageAdapter", () => {
  it("loads and saves the same snapshot document for the signed-in user", async () => {
    const io = fakeCloud();
    const adapter = new SupabaseStorageAdapter(io, async () => "user-1");
    const loaded = await adapter.load();
    expect(loaded.updatedAt).toBe(0);
    expect(io.read).toHaveBeenCalledWith("user-1");

    const saved = await adapter.save({ ...loaded, updatedAt: 15, prefs: { ...loaded.prefs, askTime: "08:30" } });
    expect(saved).toBe(true);
    expect(io.writes[0]?.userId).toBe("user-1");
    expect(io.writes[0]?.snapshot.prefs.askTime).toBe("08:30");
    expect(await adapter.prefs.get()).toMatchObject({ askTime: "08:30" });
  });

  it("writes prefs, a day, a place, and a note through the snapshot", async () => {
    const io = fakeCloud();
    const adapter = new SupabaseStorageAdapter(io, async () => "user-1");
    const prefs = { ...createSnapshot().prefs, askTime: "09:10" };
    await adapter.prefs.save(prefs);
    await adapter.commitments.save({
      date: "2026-10-06",
      answer: "yes",
      readDone: true,
      huh: false,
      detour: false,
    });
    await adapter.progress.save({ bookId: "mark", chapter: 3, verse: 1 });
    await adapter.notes.save({ date: "2026-10-06", reflection: "The soil", huh: true });

    const notes = await adapter.notes.list();
    const days = await adapter.commitments.list();
    const places = await adapter.progress.list();
    expect(notes).toEqual([{ date: "2026-10-06", reflection: "The soil", huh: true }]);
    expect(days["2026-10-06"]?.answer).toBe("yes");
    expect(places.mark).toEqual({ bookId: "mark", chapter: 3, verse: 1 });
    expect(io.writes.at(-1)?.snapshot.prefs.askTime).toBe("09:10");
  });

  it("reloads when the signed-in account changes", async () => {
    let userId = "user-1";
    const byUser = new Map<string, Snapshot>();
    const io: CloudSnapshotIO = {
      async read(id) {
        return byUser.get(id) ?? null;
      },
      async write(id, snapshot) {
        byUser.set(id, snapshot);
        return true;
      },
    };
    const adapter = new SupabaseStorageAdapter(io, async () => userId);
    const base = createSnapshot();
    await adapter.save({
      ...base,
      updatedAt: 4,
      places: { mark: { bookId: "mark", chapter: 9, verse: 1 } },
    });
    userId = "user-2";
    await adapter.prefs.save({ ...base.prefs, bookId: "john" });
    expect(byUser.get("user-1")?.places.mark?.chapter).toBe(9);
    expect(byUser.get("user-2")?.places.mark?.chapter).toBe(1);
    expect(byUser.get("user-2")?.prefs.bookId).toBe("john");
  });

  it("stays empty and refuses writes when nobody is signed in", async () => {
    const io = fakeCloud();
    const adapter = new SupabaseStorageAdapter(io, async () => null);
    expect((await adapter.load()).updatedAt).toBe(0);
    expect(await adapter.save(createSnapshot())).toBe(false);
    await expect(adapter.prefs.save(createSnapshot().prefs)).rejects.toThrow(/account/);
    expect(io.read).not.toHaveBeenCalled();
    expect(io.write).not.toHaveBeenCalled();
  });
});
