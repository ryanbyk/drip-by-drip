export const SYNC_PREFERENCE_KEY = "drip-by-drip.sync-enabled";

type SyncStorage = Pick<Storage, "getItem" | "setItem">;

/** On until the reader turns it off. Sync itself is not wired yet. */
export function readSyncEnabled(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(SYNC_PREFERENCE_KEY) !== "0";
}

export function writeSyncEnabled(storage: SyncStorage, enabled: boolean): void {
  storage.setItem(SYNC_PREFERENCE_KEY, enabled ? "1" : "0");
}
