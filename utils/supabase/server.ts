import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) in env');
}

/**
 * Use this ONLY in server-side code. Never ship service role keys to the browser.
 */
export const createServerSupabaseClient = (useServiceRole = false): SupabaseClient => {
    if (typeof window !== 'undefined') {
        throw new Error('createServerSupabaseClient must not be used in the browser bundle');
    }

    const key = useServiceRole ? serviceRoleKey : anonKey;
    if (!key) {
        throw new Error(useServiceRole
            ? 'Missing SUPABASE_SERVICE_ROLE_KEY in env'
            : 'Missing SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY) in env');
    }

    return createClient(supabaseUrl, key);
};
