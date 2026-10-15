import { createContext, useContext } from "react";
import type { GroupCard, HomeMember, PartnerCandidate } from "../domain/social";
import type { GroupLookup } from "../lib/groupClient";

export type GroupStatus = "idle" | "loading" | "ready" | "error";

export type GroupValue = {
  status: GroupStatus;
  error: string | null;
  groups: GroupCard[];
  members: Record<string, HomeMember[]>;
  invites: Record<string, { code: string; expiresAt: string }>;
  people: PartnerCandidate[];
  pendingCode: string | null;
  refresh: () => void;
  create: (name: string, description: string) => Promise<{ id: string } | { error: string }>;
  rename: (groupId: string, name: string) => Promise<string | null>;
  leave: (groupId: string) => Promise<string | null>;
  remove: (groupId: string, userId: string) => Promise<string | null>;
  resetInvite: (groupId: string) => Promise<string | null>;
  lookup: (code: string) => Promise<GroupLookup | { error: string }>;
  join: (code: string) => Promise<{ id: string } | { error: string }>;
  dismissPending: () => void;
};

export const idleGroups: GroupValue = {
  status: "idle",
  error: null,
  groups: [],
  members: {},
  invites: {},
  people: [],
  pendingCode: null,
  refresh: () => undefined,
  create: async () => ({ error: "Sign in to start a group." }),
  rename: async () => "Sign in to rename a group.",
  leave: async () => "Sign in to leave a group.",
  remove: async () => "Sign in to remove a member.",
  resetInvite: async () => "Sign in to invite someone.",
  lookup: async () => ({ error: "Sign in to join a group." }),
  join: async () => ({ error: "Sign in to join a group." }),
  dismissPending: () => undefined,
};

export const GroupContext = createContext<GroupValue | null>(null);

export function useGroups(): GroupValue {
  return useContext(GroupContext) ?? idleGroups;
}
