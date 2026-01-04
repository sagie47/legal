import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LogIn, Mail } from 'lucide-react'; // fallback icons

interface LoginPageProps {
    onSuccess?: () => void;
    onSwitchToSignup?: () => void;
}

export const LoginPage = ({ onSuccess, onSwitchToSignup }: LoginPageProps) => {
    const { login, loginWithOAuth } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<'google' | 'azure' | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const { error } = await login(email, password);

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            onSuccess?.();
        }
    };

    const handleOAuth = async (provider: 'google' | 'azure') => {
        setError(null);
        setOauthLoading(provider);
        const { error } = await loginWithOAuth(provider);
        if (error) {
            setError(error.message);
            setOauthLoading(null);
        }
        // redirect handled by Supabase; spinner remains until redirect
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F9F9F7]">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    {/* Logo/Header */}
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-white text-xl font-bold">G</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
                        <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
                    </div>

                    {/* Error Alert */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-black focus:ring-1 focus:ring-black transition-colors"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-black focus:ring-1 focus:ring-black transition-colors"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    <div className="my-6 flex items-center gap-2 text-xs text-gray-400 uppercase tracking-widest">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span>or</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button
                            type="button"
                            onClick={() => handleOAuth('google')}
                            disabled={!!oauthLoading}
                            className="w-full py-3 px-4 border border-gray-200 rounded-lg flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            <Mail size={16} />
                            {oauthLoading === 'google' ? 'Redirecting…' : 'Sign in with Google'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleOAuth('azure')}
                            disabled={!!oauthLoading}
                            className="w-full py-3 px-4 border border-gray-200 rounded-lg flex items-center justify-center gap-2 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            <LogIn size={16} />
                            {oauthLoading === 'azure' ? 'Redirecting…' : 'Sign in with Microsoft'}
                        </button>
                    </div>

                    {/* Switch to Signup */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-gray-500">
                            Don't have an account?{' '}
                            <button
                                onClick={onSwitchToSignup}
                                className="text-black font-medium hover:underline"
                            >
                                Sign up
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
