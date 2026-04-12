import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

export const supabaseClient = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

if (!hasSupabaseConfig) {
  console.warn('Supabase env vars are missing. Using localStorage fallback.');
}
