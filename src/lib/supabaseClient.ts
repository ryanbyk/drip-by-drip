import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabaseConfig";

export { authCallback } from "./authCallback";

/**
 * Implicit flow matches Supabase’s built-in magic-link email: the link returns
 * tokens in the URL hash, and no custom template is required.
 * PKCE would need a token_hash template plus the browser storage that started the request.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: "implicit",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
