import { createContext, useContext } from "react";
import type { StoredPlan } from "../domain/groupPlan";
import type { SharedNote } from "../domain/sharedNote";
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
  notes: SharedNote[];
  pendingCode: string | null;
  refresh: () => void;
  create: (name: string, description: string) => Promise<{ id: string } | { error: string }>;
  rename: (groupId: string, name: string) => Promise<string | null>;
  leave: (groupId: string) => Promise<string | null>;
  remove: (groupId: string, userId: string) => Promise<string | null>;
  resetInvite: (groupId: string) => Promise<string | null>;
  lookup: (code: string) => Promise<GroupLookup | { error: string }>;
  join: (code: string) => Promise<{ id: string } | { error: string }>;
  setPlan: (groupId: string, plan: StoredPlan) => Promise<{ id: string } | { error: string }>;
  endPlan: (groupId: string) => Promise<string | null>;
  followPlan: (groupId: string, mode: "group" | "start", day: string) => Promise<string | null>;
  leavePlan: (groupId: string) => Promise<string | null>;
  shareNote: (day: string, body: string, groupIds: string[], partnerIds: string[]) => Promise<string | null>;
  deleteNote: (noteId: string) => Promise<string | null>;
  dismissPending: () => void;
};

export const idleGroups: GroupValue = {
  status: "idle",
  error: null,
  groups: [],
  members: {},
  invites: {},
  people: [],
  notes: [],
  pendingCode: null,
  refresh: () => undefined,
  create: async () => ({ error: "Sign in to start a group." }),
  rename: async () => "Sign in to rename a group.",
  leave: async () => "Sign in to leave a group.",
  remove: async () => "Sign in to remove a member.",
  resetInvite: async () => "Sign in to invite someone.",
  lookup: async () => ({ error: "Sign in to join a group." }),
  join: async () => ({ error: "Sign in to join a group." }),
  setPlan: async () => ({ error: "Sign in to set a plan." }),
  endPlan: async () => "Sign in to end a plan.",
  followPlan: async () => "Sign in to join a plan.",
  leavePlan: async () => "Sign in to leave a plan.",
  shareNote: async () => "Sign in to share a note.",
  deleteNote: async () => "Sign in to remove a note.",
  dismissPending: () => undefined,
};

export const GroupContext = createContext<GroupValue | null>(null);

export function useGroups(): GroupValue {
  return useContext(GroupContext) ?? idleGroups;
}
