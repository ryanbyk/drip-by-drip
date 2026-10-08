import { createContext, useContext } from "react";
import type { VisibleDrop, PersonSignal } from "../domain/social";

export type PartnerPerson = PersonSignal;

export type PartnerInvite = {
  code: string;
  expiresAt: string;
};

export type IncomingInvite = {
  code: string;
  inviterName: string;
};

export type PartnerStatus = "idle" | "loading" | "ready" | "error";

export type PartnerValue = {
  status: PartnerStatus;
  error: string | null;
  /** First partner, kept so a single partnership still has one face. */
  partner: PartnerPerson | null;
  partners: PartnerPerson[];
  invite: PartnerInvite | null;
  incoming: IncomingInvite | null;
  requests: IncomingInvite[];
  drops: VisibleDrop[];
  pendingInvite: boolean;
  refresh: () => void;
  createInvite: () => Promise<string | null>;
  lookupCode: (code: string) => Promise<string | null>;
  acceptIncoming: () => Promise<string | null>;
  declineIncoming: () => Promise<string | null>;
  acceptRequest: (code: string) => Promise<string | null>;
  declineRequest: (code: string) => Promise<string | null>;
  unlink: (partnerId?: string) => Promise<string | null>;
  invitePerson: (personId: string) => Promise<string | null>;
  sendNudge: (body: string) => Promise<string | null>;
  sendDrop: (recipientId: string, body: string | null) => Promise<string | null>;
  seeNudge: (id: string) => Promise<void>;
  seeDrop: (id: string) => Promise<void>;
  dismissIncoming: () => void;
};

export const idlePartner: PartnerValue = {
  status: "idle",
  error: null,
  partner: null,
  partners: [],
  invite: null,
  incoming: null,
  requests: [],
  drops: [],
  pendingInvite: false,
  refresh: () => undefined,
  createInvite: async () => null,
  lookupCode: async () => "Sign in to join a partner.",
  acceptIncoming: async () => null,
  declineIncoming: async () => null,
  acceptRequest: async () => null,
  declineRequest: async () => null,
  unlink: async () => null,
  invitePerson: async () => "Sign in to invite a partner.",
  sendNudge: async () => null,
  sendDrop: async () => "Sign in to send a drop.",
  seeNudge: async () => undefined,
  seeDrop: async () => undefined,
  dismissIncoming: () => undefined,
};

export const PartnerContext = createContext<PartnerValue | null>(null);

export function usePartner(): PartnerValue {
  return useContext(PartnerContext) ?? idlePartner;
}
