/**
 * supabase.ts — Enhanced Supabase client configuration
 *
 * Preserves the existing dual-client pattern (anon + service role)
 * and adds a typed Database generic for full type safety.
 *
 * Usage:
 *   import { supabase, supabaseAdmin } from "@/config/supabase";
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "./env.js";

// ── Database Type Definitions ─────────────────────────────────────────────────
// TODO: Replace with generated types from `supabase gen types typescript`
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/shared/database.types.ts
export type Database = any;

// ── Singleton Instances ───────────────────────────────────────────────────────

let _supabase: SupabaseClient<Database> | null = null;
let _supabaseAdmin: SupabaseClient<Database> | null = null;

/**
 * Standard client — respects Row Level Security (RLS).
 * Use this for user-scoped operations.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (_supabase) return _supabase;

  const env = getEnv();
  _supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-app-version": "2.0.0",
      },
    },
  });

  return _supabase;
}

/**
 * Service-role admin client — BYPASSES Row Level Security.
 * Use ONLY for server-side administrative operations.
 * NEVER expose this client's token to the frontend.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (_supabaseAdmin) return _supabaseAdmin;

  const env = getEnv();

  _supabaseAdmin = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return _supabaseAdmin;
}

// ── Legacy named exports (backward compatibility) ─────────────────────────────
// Existing code using `import { supabase } from "../config/supabase"` still works.
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_, key) {
    return (getSupabase() as any)[key];
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_, key) {
    return (getSupabaseAdmin() as any)[key];
  },
});

// ── Helper: Verify JWT Token ──────────────────────────────────────────────────

/**
 * Verifies a Supabase JWT and returns the authenticated user.
 * Throws on invalid token.
 */
export async function verifyToken(token: string) {
  const { data, error } = await getSupabase().auth.getUser(token);

  if (error || !data.user) {
    throw new Error(error?.message || "Invalid or expired token");
  }

  return data.user;
}
