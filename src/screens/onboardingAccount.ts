import type { AuthStatus } from "../state/auth-context";

export type OnboardingShell = "today" | "sign-in" | "onboarding";

/**
 * Returning readers can sign in from the first onboarding screen.
 * After that sign-in syncs, a finished account opens Today.
 * An account with no finished onboarding stays on the step it already reached.
 */
export function onboardingShell(input: {
  onboardingComplete: boolean;
  requestingSignIn: boolean;
  authStatus: AuthStatus;
  syncedUserId: string | null;
  userId: string | null;
}): OnboardingShell {
  if (input.onboardingComplete) return "today";
  const synced = input.authStatus === "signed-in" && input.userId !== null && input.syncedUserId === input.userId;
  if (input.requestingSignIn && !synced) return "sign-in";
  return "onboarding";
}
