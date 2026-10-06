import { appearanceFrom } from "../../domain/appearance";
import type { DailyCommitment, Place, Snapshot, UserPrefs } from "../../domain/types";
import { createSnapshot } from "../../state/reducer";
import type { NoteRecord } from "./types";

export function sanitizeSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Snapshot>;
  if (raw.version !== 1 || !raw.prefs || !raw.places || !raw.days) return null;
  const base = createSnapshot();
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
    prefs: { ...base.prefs, ...raw.prefs, appearance: appearanceFrom(raw.prefs.appearance) },
    places: raw.places,
    days: raw.days,
  };
}

export function newerSnapshot(left: Snapshot | null, right: Snapshot | null): Snapshot | null {
  if (left && right) return left.updatedAt >= right.updatedAt ? left : right;
  return left ?? right;
}

export function withPrefs(snapshot: Snapshot, prefs: UserPrefs): Snapshot {
  return { ...snapshot, prefs, updatedAt: Date.now() };
}

export function withCommitment(snapshot: Snapshot, day: DailyCommitment): Snapshot {
  return {
    ...snapshot,
    days: { ...snapshot.days, [day.date]: day },
    updatedAt: Date.now(),
  };
}

export function withPlace(snapshot: Snapshot, place: Place): Snapshot {
  return {
    ...snapshot,
    places: { ...snapshot.places, [place.bookId]: place },
    updatedAt: Date.now(),
  };
}

export function withNote(snapshot: Snapshot, note: NoteRecord): Snapshot {
  const existing = snapshot.days[note.date];
  const day: DailyCommitment = existing
    ? { ...existing, reflection: note.reflection, huh: note.huh }
    : {
        date: note.date,
        answer: "unanswered",
        readDone: false,
        huh: note.huh,
        reflection: note.reflection,
        detour: false,
      };
  return withCommitment(snapshot, day);
}

export function notesFrom(snapshot: Snapshot): NoteRecord[] {
  return Object.values(snapshot.days)
    .filter((day) => day.reflection || day.huh)
    .map((day) => ({ date: day.date, reflection: day.reflection, huh: day.huh }));
}
