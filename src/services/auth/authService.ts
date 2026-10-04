import { UserProfile } from '@/types';
import { isSupabaseConfigured, supabase } from '../supabase/client';

const CACHED_USER_KEY = 'aihub_authenticated_user';

export class AuthService {
  public getCachedUser(): UserProfile | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const data = window.localStorage.getItem(CACHED_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public setCachedUser(user: UserProfile | null): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (user) {
        window.localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(CACHED_USER_KEY);
      }
    } catch {
      // ignore
    }
  }

  public async signInWithGoogle(): Promise<{ success: boolean; error?: string; redirectUrl?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase is not yet configured. Please verify your Supabase credentials.',
      };
    }

    try {
      const isInIframe = window.self !== window.top;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: isInIframe,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (isInIframe && data?.url) {
        window.open(data.url, '_blank');
        return { success: true, redirectUrl: data.url };
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google OAuth failed';
      return { success: false, error: msg };
    }
  }

  public onAuthStateChange(callback: (user: UserProfile | null) => void): () => void {
    if (!isSupabaseConfigured || !supabase) {
      return () => {};
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await this.getCurrentUser();
        if (profile) this.setCachedUser(profile);
        callback(profile);
      } else {
        this.setCachedUser(null);
        callback(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }

  public async getCurrentUser(): Promise<UserProfile | null> {
    const cached = this.getCachedUser();

    if (!isSupabaseConfigured || !supabase) {
      return cached;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const activeUser = session?.user;

      if (!activeUser) {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) {
          return cached;
        }
      }

      const user = activeUser || (await supabase.auth.getUser()).data.user;
      if (!user) return cached;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const userProfile: UserProfile = profile || {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      this.setCachedUser(userProfile);
      return userProfile;
    } catch (err) {
      console.error('Error fetching Supabase user:', err);
      return cached;
    }
  }

  public async signOut(): Promise<void> {
    this.setCachedUser(null);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
  }
}

export const authService = new AuthService();
