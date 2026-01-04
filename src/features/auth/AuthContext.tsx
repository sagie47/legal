import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

interface UserProfile {
    id: string;
    email: string;
    displayName: string | null;
    orgId: string;
    role: 'admin' | 'user';
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ error: Error | null }>;
    signup: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
    loginWithOAuth: (provider: 'google' | 'azure') => Promise<{ error: Error | null }>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

const buildFallbackProfile = (user: User): UserProfile => ({
    id: user.id,
    email: user.email || '',
    displayName:
        (user.user_metadata as any)?.display_name ||
        (user.user_metadata as any)?.full_name ||
        user.email?.split('@')[0] ||
        null,
    orgId: (user.user_metadata as any)?.org_id || DEFAULT_ORG_ID,
    role: 'user'
});

const mapProfileRow = (data: {
    id: string;
    email: string;
    display_name: string | null;
    org_id: string;
    role: 'admin' | 'user' | null;
}): UserProfile => ({
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    orgId: data.org_id,
    role: data.role ?? 'user'
});

const ensureProfileRow = async (currentUser: User): Promise<UserProfile | null> => {
    try {
        const { data, error } = await supabase.functions.invoke('ensure-user', {
            body: {
                userId: currentUser.id
            }
        });

        if (error) {
            console.warn('[Auth] ensure-user function error:', error.message);
            return null;
        }

        const profile = data?.profile;
        if (profile?.id) {
            return mapProfileRow(profile);
        }
    } catch (error) {
        console.warn('[Auth] ensure-user function failed:', error);
    }

    return null;
};

const hasAuthCache = () => {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
                return true;
            }
        }
    } catch (error) {
        console.warn('[Auth] Unable to read localStorage:', error);
    }
    return false;
};

const clearAuthStorage = () => {
    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
        console.warn('[Auth] Unable to clear localStorage:', error);
    }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const hasSessionRef = useRef(false);

    // Fetch user profile from public.users table (fallback to default org if missing)
    const resolveProfile = useCallback(async (currentUser: User) => {
        const fetchProfile = async () => supabase
            .from('users')
            .select('id, email, display_name, org_id, role')
            .eq('id', currentUser.id)
            .maybeSingle(); // Returns null if no rows, doesn't throw

        const { data, error } = await fetchProfile();

        if (error) {
            console.warn('[Auth] Profile fetch error:', error.message);
            const ensured = await ensureProfileRow(currentUser);
            if (ensured) {
                return ensured;
            }
            return buildFallbackProfile(currentUser);
        }

        if (!data) {
            console.log('[Auth] No profile found for user, using default org');
            const ensured = await ensureProfileRow(currentUser);
            if (ensured) {
                return ensured;
            }

            const { data: retryData, error: retryError } = await fetchProfile();
            if (!retryError && retryData) {
                return mapProfileRow(retryData);
            }

            return buildFallbackProfile(currentUser);
        }

        return mapProfileRow(data);
    }, []);

    // Initialize auth state
    useEffect(() => {
        console.log('[Auth] Starting session check...');
        let didSetLoading = false;

        const hasUrlAuthParams = () => {
            try {
                const url = new URL(window.location.href);
                const hash = window.location.hash.replace(/^#/, '');
                const hashParams = new URLSearchParams(hash);
                return (
                    url.searchParams.has('code') ||
                    url.searchParams.has('error') ||
                    hashParams.has('access_token') ||
                    hashParams.has('refresh_token') ||
                    hashParams.has('error')
                );
            } catch (error) {
                console.warn('[Auth] Failed to parse URL params:', error);
                return false;
            }
        };

        const authCallbackDetected = hasUrlAuthParams();

        // Timeout fallback - increased to 10s as circuit breaker for slow networks
        const timeout = setTimeout(() => {
            if (!didSetLoading) {
                console.warn('[Auth] Session check timed out after 10s, proceeding without session. This may indicate network issues.');
                if (!authCallbackDetected && !hasSessionRef.current && hasAuthCache()) {
                    console.warn('[Auth] Clearing cached session after timeout.');
                    setUser(null);
                    setSession(null);
                    setProfile(null);
                    clearAuthStorage();
                    supabase.auth.signOut({ scope: 'local' }).catch((error) => {
                        console.warn('[Auth] Local signOut failed after timeout:', error);
                    });
                }
                setLoading(false);
                didSetLoading = true;
            }
        }, 10000);

        const finalizeLoading = () => {
            if (!didSetLoading) {
                setLoading(false);
                didSetLoading = true;
            }
        };

        const setSessionFromUrl = async (): Promise<Session | null> => {
            const hash = window.location.hash.replace(/^#/, '');
            const url = new URL(window.location.href);
            const codeParam = url.searchParams.get('code');
            if (codeParam) {
                const { data, error } = await supabase.auth.exchangeCodeForSession(codeParam);
                if (error || !data.session) {
                    console.warn('[Auth] Failed to exchange OAuth code:', error?.message);
                    return null;
                }

                url.searchParams.delete('code');
                window.history.replaceState({}, document.title, url.pathname + url.search);
                return data.session;
            }

            if (!hash) return null;

            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (!accessToken || !refreshToken) return null;

            const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
            });

            if (error || !data.session) {
                console.warn('[Auth] Failed to set session from URL:', error?.message);
                return null;
            }

            // Clean up the URL hash so it doesn't re-run
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            return data.session;
        };

        const initSession = async () => {
            try {
                const urlSession = await setSessionFromUrl();
                if (urlSession?.user) {
                    if (urlSession.expires_at && urlSession.expires_at * 1000 < Date.now()) {
                        console.warn('[Auth] URL session expired, clearing cached session.');
                        setUser(null);
                        setSession(null);
                        setProfile(null);
                        clearAuthStorage();
                        await supabase.auth.signOut({ scope: 'local' });
                        finalizeLoading();
                        clearTimeout(timeout);
                        return;
                    }
                    hasSessionRef.current = true;
                    setSession(urlSession);
                    setUser(urlSession.user);
                    void resolveProfile(urlSession.user)
                        .then((userProfile) => setProfile(userProfile))
                        .catch((error) => {
                            console.error('[Auth] Profile fetch error:', error);
                            setProfile(buildFallbackProfile(urlSession.user));
                        });
                    finalizeLoading();
                    clearTimeout(timeout);
                    return;
                }
            } catch (error) {
                console.warn('[Auth] URL session parse failed:', error);
            }

            // Get initial session
            supabase.auth.getSession().then(async ({ data: { session } }) => {
                console.log('[Auth] Session result:', session ? 'Has session' : 'No session');

                if (session && !session.user) {
                    console.warn('[Auth] Session missing user, clearing cached session.');
                    setUser(null);
                    setSession(null);
                    setProfile(null);
                    clearAuthStorage();
                    await supabase.auth.signOut({ scope: 'local' });
                    finalizeLoading();
                    clearTimeout(timeout);
                    return;
                }

                if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
                    console.warn('[Auth] Session expired, clearing cached session.');
                    setUser(null);
                    setSession(null);
                    setProfile(null);
                    clearAuthStorage();
                    await supabase.auth.signOut({ scope: 'local' });
                    finalizeLoading();
                    clearTimeout(timeout);
                    return;
                }

                hasSessionRef.current = !!session;
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    console.log('[Auth] Fetching profile for user:', session.user.id);
                    void resolveProfile(session.user)
                        .then((userProfile) => {
                            console.log('[Auth] Profile result:', userProfile ? 'Found' : 'Not found');
                            setProfile(userProfile);
                        })
                        .catch((e) => {
                            console.error('[Auth] Profile fetch error:', e);
                            setProfile(buildFallbackProfile(session.user));
                        });
                }

                console.log('[Auth] Setting loading to false');
                finalizeLoading();
                clearTimeout(timeout);
            }).catch((error) => {
                console.error('[Auth] Failed to get session:', error);
                finalizeLoading();
                clearTimeout(timeout);
            });
        };

        void initSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('[Auth] Auth state changed:', event);
            hasSessionRef.current = !!session;
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                void resolveProfile(session.user)
                    .then((userProfile) => setProfile(userProfile))
                    .catch((error) => {
                        console.error('[Auth] Profile fetch error:', error);
                        setProfile(buildFallbackProfile(session.user));
                    });
            } else {
                setProfile(null);
            }
        });

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeout);
        };
    }, [resolveProfile]);

    const login = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (!error && !data.session) {
            return { error: new Error('No session returned. Check email confirmation or try again.') };
        }

        if (!error && data.session) {
            setSession(data.session);
            setUser(data.session.user);
            // Immediately fetch profile so Dashboard has orgId
            const userProfile = await resolveProfile(data.session.user);
            setProfile(userProfile);
        }

        return { error: error as Error | null };
    };

    const loginWithOAuth = async (provider: 'google' | 'azure') => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: provider === 'azure' ? 'azure' : 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        return { error: error as Error | null };
    };

    const signup = async (email: string, password: string, displayName?: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName || email.split('@')[0]
                }
            }
        });
        return { error: error as Error | null };
    };

    const logout = async () => {
        console.log('[Auth] Logging out...');

        // Clear UI state immediately so the app can transition right away.
        setUser(null);
        setSession(null);
        setProfile(null);

        try {
            await supabase.auth.signOut();
            console.log('[Auth] Supabase signOut complete');
        } catch (error) {
            console.error('[Auth] Logout error:', error);
        }

        // Clear any cached auth data from localStorage
        clearAuthStorage();
        console.log('[Auth] LocalStorage cleared, state cleared');

    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            profile,
            loading,
            login,
            signup,
            loginWithOAuth,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
