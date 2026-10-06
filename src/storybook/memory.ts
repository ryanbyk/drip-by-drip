import type { Snapshot } from "../domain/types";
import { notesFrom, withCommitment, withNote, withPlace, withPrefs } from "../lib/storage/document";
import type { StorageAdapter } from "../lib/storage/types";

/** In-memory StorageAdapter so a story can open on a fixture without touching the device. */
export function createMemoryStorage(initial: Snapshot): StorageAdapter {
  let current = initial;

  return {
    async load() {
      return current;
    },
    async save(snapshot) {
      current = snapshot;
      return true;
    },
    prefs: {
      async get() {
        return current.prefs;
      },
      async save(prefs) {
        current = withPrefs(current, prefs);
      },
    },
    commitments: {
      async list() {
        return current.days;
      },
      async save(day) {
        current = withCommitment(current, day);
      },
    },
    progress: {
      async list() {
        return current.places;
      },
      async save(place) {
        current = withPlace(current, place);
      },
    },
    notes: {
      async list() {
        return notesFrom(current);
      },
      async save(note) {
        current = withNote(current, note);
      },
    },
  };
}
