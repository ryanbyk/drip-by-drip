import type { DailyCommitment, Place, Snapshot, UserPrefs } from "../../domain/types";
import type { NoteRecord, StorageAdapter } from "./types";

const NOT_IN_V1 = "SupabaseStorageAdapter is not configured. v1 keeps data on this device.";

/**
 * Future hosted adapter. v1 does not ship a Supabase client or accounts.
 *
 * When a backend is added, implement the same StorageAdapter against tables
 * shaped like the domain:
 * - prefs → one row per reader
 * - commitments → daily_commitments keyed by date
 * - progress → reading_places keyed by book id
 * - notes → reflection and huh on the day's commitment (or a notes table)
 *
 * Pass that adapter into AppProvider. Screens stay on the app store.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  async load(): Promise<Snapshot> {
    throw new Error(NOT_IN_V1);
  }

  async save(_snapshot: Snapshot): Promise<boolean> {
    throw new Error(NOT_IN_V1);
  }

  readonly prefs = {
    async get(): Promise<UserPrefs> {
      throw new Error(NOT_IN_V1);
    },
    async save(_prefs: UserPrefs): Promise<void> {
      throw new Error(NOT_IN_V1);
    },
  };

  readonly commitments = {
    async list(): Promise<Record<string, DailyCommitment>> {
      throw new Error(NOT_IN_V1);
    },
    async save(_day: DailyCommitment): Promise<void> {
      throw new Error(NOT_IN_V1);
    },
  };

  readonly progress = {
    async list(): Promise<Record<string, Place>> {
      throw new Error(NOT_IN_V1);
    },
    async save(_place: Place): Promise<void> {
      throw new Error(NOT_IN_V1);
    },
  };

  readonly notes = {
    async list(): Promise<NoteRecord[]> {
      throw new Error(NOT_IN_V1);
    },
    async save(_note: NoteRecord): Promise<void> {
      throw new Error(NOT_IN_V1);
    },
  };
}

export function createSupabaseStorageAdapter(): StorageAdapter {
  return new SupabaseStorageAdapter();
}
