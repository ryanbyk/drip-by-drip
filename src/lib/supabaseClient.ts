import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig";

export { authCallback } from "./authCallback";

/**
 * Implicit flow matches Supabase’s built-in email: a magic link returns tokens
 * in the URL hash. PKCE would need a token_hash template plus the storage that
 * started the request, which an iPhone Home Screen app does not share with Safari.
 *
 * A 6-digit code is verified in this window. persistSession writes that session
 * to this origin’s storage, so the installed app still has it on the next launch.
 */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: "implicit",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
