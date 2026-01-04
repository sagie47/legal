import { getSupabaseBrowserClient } from './client';

const getFunctionBaseUrl = () => {
    const meta = import.meta as any;
    return (
        meta.env?.VITE_SUPABASE_FUNCTION_URL ||
        (meta.env?.VITE_SUPABASE_URL ? `${meta.env.VITE_SUPABASE_URL}/functions/v1` : null) ||
        'http://localhost:54321/functions/v1'
    );
};

type FetchOptions = RequestInit & { requireAuth?: boolean };

/**
 * Helper to call Supabase Edge Functions with the current session token (or anon key fallback).
 */
export const callFunction = async <T = unknown>(
    path: string,
    options: FetchOptions = {}
): Promise<T> => {
    const supabase = getSupabaseBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();

    const token = session?.access_token || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    if (options.requireAuth && !session?.access_token) {
        throw new Error('Not authenticated');
    }

    const res = await fetch(`${getFunctionBaseUrl()}/${path.replace(/^\//, '')}`, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: token ? `Bearer ${token}` : undefined
        }
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
    }

    return res.json() as Promise<T>;
};
