import type { Snapshot } from "../../domain/types";

/** Device note of which account last pulled or pushed the local snapshot. */
export const SNAPSHOT_OWNER_KEY = "drip-by-drip.snapshot-owner";

export type OwnerStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type CloudSnapshotIO = {
  read(userId: string): Promise<Snapshot | null>;
  write(userId: string, snapshot: Snapshot): Promise<boolean>;
};

export type AccountSyncSession = {
  userId: string | null;
  enabled: boolean;
};

export type SnapshotChoice =
  | { kind: "keep" }
  | { kind: "adopt"; snapshot: Snapshot }
  | { kind: "push" };

export type AccountSyncResult = {
  snapshot: Snapshot;
  /** A cloud read or write failed. Local data is unchanged when this is true. */
  failed: boolean;
};

export function readSnapshotOwner(store: OwnerStore): string | null {
  const value = store.getItem(SNAPSHOT_OWNER_KEY)?.trim() ?? "";
  return value || null;
}

export function writeSnapshotOwner(store: OwnerStore, userId: string): void {
  store.setItem(SNAPSHOT_OWNER_KEY, userId);
}

export function browserOwnerStore(): OwnerStore {
  return {
    getItem(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Private mode can reject storage. This visit still syncs.
      }
    },
  };
}

/**
 * Last write wins by snapshot.updatedAt.
 * A device that last synced as someone else must not upload that reading
 * onto the account that just signed in.
 */
export function chooseSnapshot(
  local: Snapshot,
  remote: Snapshot | null,
  ownerId: string | null,
  userId: string,
): SnapshotChoice {
  const foreign = ownerId !== null && ownerId !== userId;
  if (foreign) {
    if (remote && remote.updatedAt > 0) return { kind: "adopt", snapshot: remote };
    return { kind: "keep" };
  }
  if (!remote || remote.updatedAt <= 0) {
    return local.updatedAt > 0 ? { kind: "push" } : { kind: "keep" };
  }
  if (local.updatedAt <= 0 || remote.updatedAt > local.updatedAt) {
    return { kind: "adopt", snapshot: remote };
  }
  if (local.updatedAt > remote.updatedAt) return { kind: "push" };
  return { kind: "keep" };
}

export async function syncAccountSnapshot(
  local: Snapshot,
  session: AccountSyncSession,
  cloud: CloudSnapshotIO,
  owner: OwnerStore,
  writeLocal: (snapshot: Snapshot) => Promise<boolean>,
): Promise<AccountSyncResult> {
  if (!session.enabled || !session.userId) return { snapshot: local, failed: false };
  const userId = session.userId;
  let remote: Snapshot | null;
  try {
    remote = await cloud.read(userId);
  } catch {
    return { snapshot: local, failed: true };
  }
  const choice = chooseSnapshot(local, remote, readSnapshotOwner(owner), userId);
  switch (choice.kind) {
    case "keep":
      return { snapshot: local, failed: false };
    case "adopt": {
      const saved = await writeLocal(choice.snapshot);
      if (!saved) return { snapshot: local, failed: false };
      writeSnapshotOwner(owner, userId);
      return { snapshot: choice.snapshot, failed: false };
    }
    case "push": {
      let wrote = false;
      try {
        wrote = await cloud.write(userId, local);
      } catch {
        wrote = false;
      }
      if (!wrote) return { snapshot: local, failed: true };
      writeSnapshotOwner(owner, userId);
      return { snapshot: local, failed: false };
    }
    default: {
      const exhaustive: never = choice;
      return exhaustive;
    }
  }
}
