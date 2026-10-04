import React, { useEffect, useState } from 'react';
import { UserProfile } from '@/types';
import { authService } from '@/services/auth/authService';
import { settingsService } from '@/services/settings/settingsService';
import { Navbar } from '@/components/layout/Navbar';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { NewDiscussion } from '@/pages/NewDiscussion';
import { DiscussionView } from '@/pages/Discussion';
import { HistoryView } from '@/pages/History';
import { FilesView } from '@/pages/Files';
import { SettingsView } from '@/pages/Settings';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [activeDiscussionId, setActiveDiscussionId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

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

    return () => {
      mounted = false;
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
    setCurrentTab('dashboard');
  };

  const handleSignOut = async () => {
    await authService.signOut();
    setUser(null);
    setCurrentTab('dashboard');
  };

  const handleNavigate = (tab: string, discussionId?: string) => {
    if (tab === 'discussion' && discussionId) {
      setActiveDiscussionId(discussionId);
      setCurrentTab('discussion');
    } else {
      setCurrentTab(tab);
    }
  };

  const handleDiscussionCreated = (discussionId: string) => {
    setActiveDiscussionId(discussionId);
    setCurrentTab('discussion');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  // Protected Routes Check (Requirement #11)
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      <Navbar
        currentTab={currentTab}
        onNavigate={handleNavigate}
        user={user}
        onSignOut={handleSignOut}
        theme={theme}
        onThemeChange={setTheme}
      />

      <main className="flex-1 pb-16">
        {currentTab === 'dashboard' && (
          <Dashboard user={user} onNavigate={handleNavigate} />
        )}

        {currentTab === 'new-discussion' && (
          <NewDiscussion
            user={user}
            onDiscussionCreated={handleDiscussionCreated}
            onNavigateToSettings={() => setCurrentTab('settings')}
          />
        )}

        {currentTab === 'discussion' && activeDiscussionId && (
          <DiscussionView
            discussionId={activeDiscussionId}
            onNavigateNew={() => setCurrentTab('new-discussion')}
          />
        )}

        {currentTab === 'history' && (
          <HistoryView
            user={user}
            onOpenDiscussion={(id: string) => handleNavigate('discussion', id)}
            onNavigateNew={() => setCurrentTab('new-discussion')}
          />
        )}

        {currentTab === 'files' && (
          <FilesView user={user} />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            user={user}
            theme={theme}
            onThemeChange={setTheme}
          />
        )}
      </main>
    </div>
  );
}
