import type { DailyCommitment, Place, Snapshot, UserPrefs } from "../../domain/types";

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
  | { kind: "push"; snapshot: Snapshot }
  | { kind: "sync"; snapshot: Snapshot };

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
 * Merge this device with the account snapshot.
 * A device that last synced as someone else must not upload that reading
 * onto the account that just signed in. For the signed-in account, days and
 * notes are unioned, each book keeps its furthest place, and prefs follow the
 * newer snapshot — except a device that has never synced as this user, which
 * keeps the account's prefs instead of its onboarding defaults.
 * The merged updatedAt is the later of the two so an older cloud history can
 * replace an empty local copy without looking stale to the in-memory guard.
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
    return local.updatedAt > 0 ? { kind: "push", snapshot: local } : { kind: "keep" };
  }
  return chooseMerged(local, remote, mergeSnapshots(local, remote, ownerId));
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
    case "push":
      return pushSnapshot(choice.snapshot, userId, cloud, owner, local);
    case "sync": {
      const pushed = await pushSnapshot(choice.snapshot, userId, cloud, owner, local);
      if (pushed.failed) return pushed;
      const saved = await writeLocal(choice.snapshot);
      if (!saved) return { snapshot: local, failed: false };
      return { snapshot: choice.snapshot, failed: false };
    }
    default: {
      const exhaustive: never = choice;
      return exhaustive;
    }
  }
}

async function pushSnapshot(
  snapshot: Snapshot,
  userId: string,
  cloud: CloudSnapshotIO,
  owner: OwnerStore,
  local: Snapshot,
): Promise<AccountSyncResult> {
  let wrote = false;
  try {
    wrote = await cloud.write(userId, snapshot);
  } catch {
    wrote = false;
  }
  if (!wrote) return { snapshot: local, failed: true };
  writeSnapshotOwner(owner, userId);
  return { snapshot, failed: false };
}

function chooseMerged(local: Snapshot, remote: Snapshot, merged: Snapshot): SnapshotChoice {
  const localSame = sameContent(local, merged);
  const remoteSame = sameContent(remote, merged);
  if (localSame && remoteSame) {
    if (remote.updatedAt > local.updatedAt) return { kind: "adopt", snapshot: remote };
    if (local.updatedAt > remote.updatedAt) return { kind: "push", snapshot: local };
    return { kind: "keep" };
  }
  const snapshot = sameSnapshot(merged, remote) ? remote : sameSnapshot(merged, local) ? local : merged;
  if (!localSame && !remoteSame) return { kind: "sync", snapshot };
  if (!localSame) return { kind: "adopt", snapshot };
  return { kind: "push", snapshot };
}

function mergeSnapshots(local: Snapshot, remote: Snapshot, ownerId: string | null): Snapshot {
  return {
    version: 1,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    prefs: mergePrefs(local, remote, ownerId),
    places: mergePlaces(local.places, remote.places),
    days: mergeDays(local.days, remote.days),
  };
}

function mergePrefs(local: Snapshot, remote: Snapshot, ownerId: string | null): UserPrefs {
  if (ownerId === null) return remote.prefs;
  return local.updatedAt >= remote.updatedAt ? local.prefs : remote.prefs;
}

function mergePlaces(local: Record<string, Place>, remote: Record<string, Place>): Record<string, Place> {
  const places: Record<string, Place> = {};
  for (const bookId of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const left = local[bookId];
    const right = remote[bookId];
    if (left && right) places[bookId] = mergePlace(left, right);
    else if (left) places[bookId] = left;
    else if (right) places[bookId] = right;
  }
  return places;
}

function mergePlace(left: Place, right: Place): Place {
  const further = comparePlace(left, right) >= 0 ? left : right;
  const counts = [left.countedThrough, right.countedThrough].filter((value): value is number => typeof value === "number");
  if (counts.length === 0) return { ...further };
  return { ...further, countedThrough: Math.max(...counts) };
}

function comparePlace(left: Place, right: Place): number {
  if (left.chapter !== right.chapter) return left.chapter - right.chapter;
  return left.verse - right.verse;
}

function mergeDays(
  local: Record<string, DailyCommitment>,
  remote: Record<string, DailyCommitment>,
): Record<string, DailyCommitment> {
  const days: Record<string, DailyCommitment> = {};
  for (const date of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const left = local[date];
    const right = remote[date];
    if (left && right) days[date] = mergeDay(left, right);
    else if (left) days[date] = left;
    else if (right) days[date] = right;
  }
  return days;
}

/**
 * Prefer the day with more completed reading. Equal completion uses the later
 * answeredAt or readDoneAt, then the local day. Notes (reflection, note,
 * verse tags, huh) are filled from whichever side has them, and the longer
 * text wins when both wrote one.
 */
function mergeDay(local: DailyCommitment, remote: DailyCommitment): DailyCommitment {
  const rank = compareRank(dayRank(local), dayRank(remote));
  if (rank > 0) return unionNotes(local, remote);
  if (rank < 0) return unionNotes(remote, local);
  if (dayStamp(remote) > dayStamp(local)) return unionNotes(remote, local);
  return unionNotes(local, remote);
}

function dayRank(day: DailyCommitment): number[] {
  return [day.readDone ? 1 : 0, answerRank(day.answer), filledCount(day)];
}

function answerRank(answer: DailyCommitment["answer"]): number {
  switch (answer) {
    case "yes":
      return 2;
    case "not_today":
      return 1;
    case "unanswered":
      return 0;
    default: {
      const exhaustive: never = answer;
      return exhaustive;
    }
  }
}

function filledCount(day: DailyCommitment): number {
  return [
    day.reflection,
    day.note,
    day.passageRef,
    day.passageTitle,
    day.prompt,
    day.range,
    day.savedRange,
    day.dayIndex,
    day.verseTags && day.verseTags.length > 0 ? day.verseTags : undefined,
  ].filter((value) => value !== undefined && value !== "").length;
}

function compareRank(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function dayStamp(day: DailyCommitment): number {
  const stamps = [day.readDoneAt, day.answeredAt]
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  if (stamps.length === 0) return 0;
  return Math.max(...stamps);
}

function unionNotes(primary: DailyCommitment, secondary: DailyCommitment): DailyCommitment {
  const verseTags = unionTags(primary.verseTags, secondary.verseTags);
  return {
    ...primary,
    reflection: richerText(primary.reflection, secondary.reflection),
    note: richerText(primary.note, secondary.note),
    huh: primary.huh || secondary.huh,
    ...(verseTags ? { verseTags } : { verseTags: undefined }),
  };
}

function richerText(primary: string | undefined, secondary: string | undefined): string | undefined {
  const primaryLength = primary?.trim().length ?? 0;
  const secondaryLength = secondary?.trim().length ?? 0;
  if (secondaryLength > primaryLength) return secondary;
  if (primaryLength > 0) return primary;
  return undefined;
}

function unionTags(primary: string[] | undefined, secondary: string[] | undefined): string[] | undefined {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const tag of [...(primary ?? []), ...(secondary ?? [])]) {
    const trimmed = tag.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    tags.push(trimmed);
  }
  return tags.length > 0 ? tags : undefined;
}

function sameContent(left: Snapshot, right: Snapshot): boolean {
  return (
    canonical(left.prefs) === canonical(right.prefs) &&
    canonical(left.places) === canonical(right.places) &&
    canonical(left.days) === canonical(right.days)
  );
}

function sameSnapshot(left: Snapshot, right: Snapshot): boolean {
  return left.updatedAt === right.updatedAt && sameContent(left, right);
}

function canonical(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = canonicalize(record[key]);
    return sorted;
  }
  return value;
}
