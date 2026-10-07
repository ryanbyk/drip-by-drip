import { createContext, useContext } from "react";
import type { PartnerNudgeView } from "../domain/partner";

export type PartnerPerson = {
  displayName: string;
  readToday: boolean;
};

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
  partner: PartnerPerson | null;
  invite: PartnerInvite | null;
  incoming: IncomingInvite | null;
  nudges: PartnerNudgeView[];
  pendingInvite: boolean;
  refresh: () => void;
  createInvite: () => Promise<string | null>;
  lookupCode: (code: string) => Promise<string | null>;
  acceptIncoming: () => Promise<string | null>;
  declineIncoming: () => Promise<string | null>;
  unlink: () => Promise<string | null>;
  sendNudge: (body: string) => Promise<string | null>;
  seeNudge: (id: string) => Promise<void>;
  dismissIncoming: () => void;
};

export const idlePartner: PartnerValue = {
  status: "idle",
  error: null,
  partner: null,
  invite: null,
  incoming: null,
  nudges: [],
  pendingInvite: false,
  refresh: () => undefined,
  createInvite: async () => null,
  lookupCode: async () => "Sign in to join a partner.",
  acceptIncoming: async () => null,
  declineIncoming: async () => null,
  unlink: async () => null,
  sendNudge: async () => null,
  seeNudge: async () => undefined,
  dismissIncoming: () => undefined,
};

export const PartnerContext = createContext<PartnerValue | null>(null);

export function usePartner(): PartnerValue {
  return useContext(PartnerContext) ?? idlePartner;
}
