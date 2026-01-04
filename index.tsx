import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GlobalStyles } from './src/components/ui';
import { MarketingPage } from './Marketing';
import { AuthProvider, useAuth, LoginPage, SignupPage } from './src/features/auth';

import { Dashboard } from './Dashboard';

// --- Auth-Aware App Root ---

const AppContent = () => {
  const { user, logout, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    if (user) {
      setAuthOpen(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F9F7]">
        <div className="text-center text-gray-500">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Dashboard onLogout={() => logout().catch(() => { })} />;
  }

  if (authOpen) {
    if (authView === 'login') {
      return (
        <LoginPage
          onSwitchToSignup={() => setAuthView('signup')}
        />
      );
    }

    return (
      <SignupPage
        onSwitchToLogin={() => setAuthView('login')}
      />
    );
  }

  return (
    <MarketingPage
      isLoggedIn={!!user}
      onLogout={() => logout().catch(() => { })}
      onLogin={() => {
        setAuthView('login');
        setAuthOpen(true);
      }}
    />
  );
};

const App = () => {
  return (
    <AuthProvider>
      <GlobalStyles />
      <AppContent />
    </AuthProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
