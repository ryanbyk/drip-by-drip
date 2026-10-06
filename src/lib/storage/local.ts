import type { Snapshot } from "../../domain/types";
import { createSnapshot } from "../../state/reducer";
import { newerSnapshot, notesFrom, sanitizeSnapshot, withCommitment, withNote, withPlace, withPrefs } from "./document";
import type { StorageAdapter } from "./types";

const DB_NAME = "drip-by-drip";
const STORE = "kv";
const KEY = "snapshot";
const LS_KEY = "drip-by-drip-snapshot";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDb(): Promise<Snapshot | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(sanitizeSnapshot(request.result));
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function writeDb(snapshot: Snapshot): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).put(snapshot, KEY);
    });
  } finally {
    db.close();
  }
}

function readLocal(): Snapshot | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return sanitizeSnapshot(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeLocal(snapshot: Snapshot): void {
  localStorage.setItem(LS_KEY, JSON.stringify(snapshot));
}

async function readStored(): Promise<Snapshot | null> {
  let fromDb: Snapshot | null = null;
  try {
    fromDb = await readDb();
  } catch {
    fromDb = null;
  }
  return newerSnapshot(fromDb, readLocal());
}

async function writeStored(snapshot: Snapshot): Promise<boolean> {
  let saved = false;
  try {
    writeLocal(snapshot);
    saved = true;
  } catch {
    // Private mode can refuse localStorage; IndexedDB may still succeed.
  }
  try {
    await writeDb(snapshot);
    saved = true;
  } catch {
    // The localStorage copy is the fallback when IndexedDB is blocked.
  }
  return saved;
}

/**
 * v1 persistence: one snapshot document in IndexedDB, mirrored to localStorage.
 * The newer `updatedAt` wins when the two copies disagree.
 */
export function createLocalStorageAdapter(): StorageAdapter {
  let cache: Snapshot | null = null;

  async function current(): Promise<Snapshot> {
    if (cache) return cache;
    cache = (await readStored()) ?? createSnapshot();
    return cache;
  }

  async function persist(snapshot: Snapshot): Promise<boolean> {
    const saved = await writeStored(snapshot);
    if (saved) cache = snapshot;
    return saved;
  }

  return {
    async load() {
      cache = (await readStored()) ?? createSnapshot();
      return cache;
    },
    save(snapshot) {
      return persist(snapshot);
    },
    prefs: {
      async get() {
        return (await current()).prefs;
      },
      async save(prefs) {
        const saved = await persist(withPrefs(await current(), prefs));
        if (!saved) throw new Error("Couldn’t save preferences on this device.");
      },
    },
    commitments: {
      async list() {
        return (await current()).days;
      },
      async save(day) {
        const saved = await persist(withCommitment(await current(), day));
        if (!saved) throw new Error("Couldn’t save this day on this device.");
      },
    },
    progress: {
      async list() {
        return (await current()).places;
      },
      async save(place) {
        const saved = await persist(withPlace(await current(), place));
        if (!saved) throw new Error("Couldn’t save reading progress on this device.");
      },
    },
    notes: {
      async list() {
        return notesFrom(await current());
      },
      async save(note) {
        const saved = await persist(withNote(await current(), note));
        if (!saved) throw new Error("Couldn’t save this note on this device.");
      },
    },
  };
}
