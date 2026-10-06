import type { DailyCommitment, Place, Snapshot, UserPrefs } from "../../domain/types";
import type { Json, UserSnapshotInsert } from "../database";
import { supabase } from "../supabaseClient";
import { createSnapshot } from "../../state/reducer";
import { notesFrom, sanitizeSnapshot, withCommitment, withNote, withPlace, withPrefs } from "./document";
import type { CloudSnapshotIO } from "./sync";
import type { NoteRecord, StorageAdapter } from "./types";

const TABLE = "user_snapshots";

function snapshotJson(snapshot: Snapshot): Json {
  return JSON.parse(JSON.stringify(snapshot)) as Json;
}

export async function signedInUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Cloud half of the storage boundary. One jsonb snapshot per auth user. */
export const liveCloudSnapshotIO: CloudSnapshotIO = {
  async read(userId) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("payload")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return sanitizeSnapshot(data.payload);
  },
  async write(userId, snapshot) {
    const row: UserSnapshotInsert = {
      user_id: userId,
      payload: snapshotJson(snapshot),
      updated_at: new Date(snapshot.updatedAt).toISOString(),
    };
    const { error } = await supabase.from(TABLE).upsert(row, { onConflict: "user_id" });
    return !error;
  },
};

/**
 * Hosted StorageAdapter. Same snapshot document as the local adapter, stored
 * in public.user_snapshots for the signed-in user.
 *
 * The running app keeps createLocalStorageAdapter() and syncs through
 * syncAccountSnapshot, so a guest never touches this table. Pass this adapter
 * to AppProvider only when a session is already signed in.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  private cache: { userId: string | null; snapshot: Snapshot } | null = null;

  constructor(
    private readonly io: CloudSnapshotIO = liveCloudSnapshotIO,
    private readonly currentUserId: () => Promise<string | null> = signedInUserId,
  ) {}

  async load(): Promise<Snapshot> {
    const userId = await this.currentUserId();
    if (!userId) {
      const snapshot = createSnapshot();
      this.cache = { userId: null, snapshot };
      return snapshot;
    }
    const remote = await this.io.read(userId);
    const snapshot = remote ?? createSnapshot();
    this.cache = { userId, snapshot };
    return snapshot;
  }

  async save(snapshot: Snapshot): Promise<boolean> {
    return this.persist(snapshot);
  }

  readonly prefs = {
    get: async (): Promise<UserPrefs> => (await this.current()).prefs,
    save: async (prefs: UserPrefs): Promise<void> => {
      const saved = await this.persist(withPrefs(await this.current(), prefs));
      if (!saved) throw new Error("Couldn’t save preferences to this account.");
    },
  };

  readonly commitments = {
    list: async (): Promise<Record<string, DailyCommitment>> => (await this.current()).days,
    save: async (day: DailyCommitment): Promise<void> => {
      const saved = await this.persist(withCommitment(await this.current(), day));
      if (!saved) throw new Error("Couldn’t save this day to this account.");
    },
  };

  readonly progress = {
    list: async (): Promise<Record<string, Place>> => (await this.current()).places,
    save: async (place: Place): Promise<void> => {
      const saved = await this.persist(withPlace(await this.current(), place));
      if (!saved) throw new Error("Couldn’t save reading progress to this account.");
    },
  };

  readonly notes = {
    list: async (): Promise<NoteRecord[]> => notesFrom(await this.current()),
    save: async (note: NoteRecord): Promise<void> => {
      const saved = await this.persist(withNote(await this.current(), note));
      if (!saved) throw new Error("Couldn’t save this note to this account.");
    },
  };

  private async current(): Promise<Snapshot> {
    const userId = await this.currentUserId();
    if (this.cache && this.cache.userId === userId) return this.cache.snapshot;
    return this.load();
  }

  private async persist(snapshot: Snapshot): Promise<boolean> {
    const userId = await this.currentUserId();
    if (!userId) return false;
    const saved = await this.io.write(userId, snapshot);
    if (saved) this.cache = { userId, snapshot };
    return saved;
  }
}

export function createSupabaseStorageAdapter(
  io?: CloudSnapshotIO,
  currentUserId?: () => Promise<string | null>,
): StorageAdapter {
  return new SupabaseStorageAdapter(io, currentUserId);
}
