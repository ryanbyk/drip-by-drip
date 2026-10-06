import type { Snapshot } from "../domain/types";
import { createSnapshot } from "../state/reducer";

const DB_NAME = "drip-by-drip";
const STORE = "kv";
const KEY = "snapshot";
const LS_KEY = "drip-by-drip-snapshot";

export function sanitizeSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Snapshot>;
  if (raw.version !== 1 || !raw.prefs || !raw.places || !raw.days) return null;
  const base = createSnapshot();
  return {
    version: 1,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
    prefs: { ...base.prefs, ...raw.prefs },
    places: raw.places,
    days: raw.days,
  };
}

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

export async function loadSnapshot(): Promise<Snapshot> {
  let fromDb: Snapshot | null = null;
  try {
    fromDb = await readDb();
  } catch {
    fromDb = null;
  }
  const fromLocal = readLocal();
  if (fromDb && fromLocal) return fromDb.updatedAt >= fromLocal.updatedAt ? fromDb : fromLocal;
  return fromDb ?? fromLocal ?? createSnapshot();
}

export async function saveSnapshot(snapshot: Snapshot): Promise<boolean> {
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
    // localStorage copy is the fallback when IndexedDB is blocked.
  }
  return saved;
}
