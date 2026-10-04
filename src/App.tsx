import React, { useEffect, useState } from 'react';
import { UserProfile } from '@/types';
import { authService } from '@/services/auth/authService';
import { settingsService } from '@/services/settings/settingsService';
import { Login } from '@/pages/Login';
import { ModernChatWorkspace } from '@/components/chat/ModernChatWorkspace';
import { SettingsView } from '@/pages/Settings';
import { X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => authService.getCachedUser());
  const [loading, setLoading] = useState(() => !authService.getCachedUser());
  const [activeDiscussionId, setActiveDiscussionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Initialize Auth & Theme
  useEffect(() => {
    let mounted = true;

    authService.getCurrentUser().then(async (currentUser: UserProfile | null) => {
      if (!mounted) return;
      setUser(currentUser);

      if (currentUser) {
        const settings = await settingsService.getSettings(currentUser.id);
        if (mounted && settings?.theme) {
          setTheme(settings.theme);
        }
      }

      setLoading(false);
    });

    const unsubscribe = authService.onAuthStateChange(async (currentUser) => {
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) {
        const settings = await settingsService.getSettings(currentUser.id);
        if (mounted && settings?.theme) {
          setTheme(settings.theme);
        }
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Sync theme with HTML class
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setActiveDiscussionId(null);
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setUser(null);
    setActiveDiscussionId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  // Protected Routes Check
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors relative">
      {/* Primary Modern AI Chat Workspace (ChatGPT / Claude / Gemini Style) */}
      <ModernChatWorkspace
        user={user}
        activeDiscussionId={activeDiscussionId}
        onSelectDiscussion={(id) => setActiveDiscussionId(id)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onSignOut={handleSignOut}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Settings & API Key Management Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                Settings & API Keys
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              <SettingsView
                user={user}
                theme={theme}
                onThemeChange={setTheme}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
