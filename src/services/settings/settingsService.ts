import { ProviderId, UserSettings } from '@/types';
import { isSupabaseConfigured, supabase } from '../supabase/client';

const LOCAL_SETTINGS_KEY = 'aihub_user_settings';

export class SettingsService {
  private getLocalSettings(userId: string): UserSettings {
    const defaultSettings: UserSettings = {
      id: 'settings-' + userId,
      user_id: userId,
      default_rounds: 3,
      default_moderator: 'openai',
      theme: 'system',
    };

    if (typeof window === 'undefined' || !window.localStorage) return defaultSettings;
    try {
      const raw = window.localStorage.getItem(LOCAL_SETTINGS_KEY + '_' + userId);
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  }

  private setLocalSettings(userId: string, settings: UserSettings): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(LOCAL_SETTINGS_KEY + '_' + userId, JSON.stringify(settings));
      } catch {
        // ignore
      }
    }
  }

  public async getSettings(userId: string): Promise<UserSettings> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (!error && data) {
          return data as UserSettings;
        }
      } catch (err) {
        console.error('Supabase getSettings error:', err);
      }
    }

    return this.getLocalSettings(userId);
  }

  public async updateSettings(
    userId: string,
    updates: Partial<{ default_rounds: number; default_moderator: ProviderId; theme: 'light' | 'dark' | 'system' }>
  ): Promise<UserSettings> {
    const current = await this.getSettings(userId);
    const updated: UserSettings = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('user_settings').upsert({
          id: updated.id,
          user_id: userId,
          default_rounds: updated.default_rounds,
          default_moderator: updated.default_moderator,
          theme: updated.theme,
          updated_at: updated.updated_at,
        });
      } catch (err) {
        console.error('Supabase updateSettings error:', err);
      }
    }

    this.setLocalSettings(userId, updated);
    return updated;
  }
}

export const settingsService = new SettingsService();
