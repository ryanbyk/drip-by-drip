import type { DailyCommitment, Place, Snapshot, UserPrefs } from "../../domain/types";

/** A note attached to one day. Stored on that day's commitment in v1. */
export type NoteRecord = {
  date: string;
  reflection?: string;
  huh: boolean;
};

export interface PrefsRepository {
  get(): Promise<UserPrefs>;
  save(prefs: UserPrefs): Promise<void>;
}

export interface CommitmentsRepository {
  list(): Promise<Record<string, DailyCommitment>>;
  save(day: DailyCommitment): Promise<void>;
}

export interface ReadingProgressRepository {
  list(): Promise<Record<string, Place>>;
  save(place: Place): Promise<void>;
}

export interface NotesRepository {
  list(): Promise<NoteRecord[]>;
  save(note: NoteRecord): Promise<void>;
}

/**
 * Persistence boundary for the app store.
 * Screens never touch localStorage, IndexedDB, or a future remote client.
 * Swap implementations (local now, hosted later) without rewriting screens.
 */
export interface StorageAdapter {
  load(): Promise<Snapshot>;
  save(snapshot: Snapshot): Promise<boolean>;
  prefs: PrefsRepository;
  commitments: CommitmentsRepository;
  progress: ReadingProgressRepository;
  notes: NotesRepository;
}
