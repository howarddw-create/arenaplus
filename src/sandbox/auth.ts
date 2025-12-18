import { createClient } from '@supabase/supabase-js';
import { chromeStorageAdapter } from "../lib/chromeStorageAdapter";

// This script runs in the sandboxed auth page.
// It initializes the Supabase client, which automatically handles the auth token from the URL.
// After a brief delay to ensure the session is processed, it closes the window.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing");
} else {
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: chromeStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

// Close the window after a short delay
setTimeout(() => window.close(), 2000);
