import { ProviderConfig, ProviderId } from '@/types';
import { STATIC_FALLBACK_MODELS } from './modelUtils';

const STORAGE_PREFIX = 'aihub_provider_key_';
const MODEL_PREFIX = 'aihub_provider_model_';
const ENABLED_PREFIX = 'aihub_provider_enabled_';
const DELAY_KEY = 'aihub_request_delay_seconds';

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
  claude: 'claude-3-7-sonnet-20250219',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
  mock: 'mock-fast',
};

export const AVAILABLE_MODELS = STATIC_FALLBACK_MODELS;

export const ALL_PROVIDERS: ProviderId[] = ['openai', 'gemini', 'claude', 'deepseek', 'groq', 'mock'];

class ProviderKeyStore {
  private memoryKeys: Map<ProviderId, string> = new Map();

  constructor() {
    // Restore persistent keys from localStorage or sessionStorage
    if (typeof window !== 'undefined') {
      try {
        for (const p of ALL_PROVIDERS) {
          const stored =
            window.localStorage?.getItem(STORAGE_PREFIX + p) ||
            window.sessionStorage?.getItem(STORAGE_PREFIX + p);
          if (stored) {
            this.memoryKeys.set(p, stored);
          }
        }
      } catch {
        // Ignore storage access errors
      }
    }
  }

  public getKey(provider: ProviderId): string {
    if (provider === 'mock') {
      return 'mock-local-key';
    }
    if (this.memoryKeys.has(provider)) {
      return this.memoryKeys.get(provider) || '';
    }
    if (typeof window !== 'undefined') {
      try {
        const stored =
          window.localStorage?.getItem(STORAGE_PREFIX + provider) ||
          window.sessionStorage?.getItem(STORAGE_PREFIX + provider);
        if (stored) {
          this.memoryKeys.set(provider, stored);
          return stored;
        }
      } catch {
        // ignore
      }
    }
    return '';
  }

  public setKey(provider: ProviderId, key: string): void {
    const trimmed = key.trim();
    if (trimmed) {
      this.memoryKeys.set(provider, trimmed);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage?.setItem(STORAGE_PREFIX + provider, trimmed);
          window.sessionStorage?.setItem(STORAGE_PREFIX + provider, trimmed);
        } catch {
          // Ignore storage access errors
        }
      }
    } else {
      this.clearKey(provider);
    }
  }

  public clearKey(provider: ProviderId): void {
    this.memoryKeys.delete(provider);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.removeItem(STORAGE_PREFIX + provider);
        window.sessionStorage?.removeItem(STORAGE_PREFIX + provider);
      } catch {
        // Ignore storage access errors
      }
    }
  }

  public getConfiguredProviders(): ProviderId[] {
    return ALL_PROVIDERS.filter((p) => Boolean(this.getKey(p)));
  }

  public getModel(provider: ProviderId): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(MODEL_PREFIX + provider);
      if (stored) {
        return stored;
      }
    }
    return DEFAULT_MODELS[provider] || '';
  }

  public setModel(provider: ProviderId, model: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(MODEL_PREFIX + provider, model);
    }
  }

  public isEnabled(provider: ProviderId): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(ENABLED_PREFIX + provider);
      if (stored !== null) return stored === 'true';
    }
    return true;
  }

  public setEnabled(provider: ProviderId, enabled: boolean): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ENABLED_PREFIX + provider, String(enabled));
    }
  }

  /**
   * Request delay in seconds between consecutive calls to the same provider.
   * Default: 1.5 seconds.
   */
  public getRequestDelay(): number {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(DELAY_KEY);
      if (val) {
        const parsed = parseFloat(val);
        if (!isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    }
    return 1.5;
  }

  public setRequestDelay(seconds: number): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DELAY_KEY, String(Math.max(0, seconds)));
    }
  }

  public getConfigs(): Record<ProviderId, ProviderConfig> {
    const configs: Partial<Record<ProviderId, ProviderConfig>> = {};

    for (const p of ALL_PROVIDERS) {
      const key = this.getKey(p);
      configs[p] = {
        id: p,
        name:
          p === 'openai'
            ? 'OpenAI'
            : p === 'gemini'
            ? 'Gemini'
            : p === 'claude'
            ? 'Claude'
            : p === 'deepseek'
            ? 'DeepSeek'
            : p === 'groq'
            ? 'Groq'
            : 'Mock',
        enabled: this.isEnabled(p),
        apiKey: key,
        selectedModel: this.getModel(p),
        status: key ? 'connected' : 'untested',
      };
    }

    return configs as Record<ProviderId, ProviderConfig>;
  }

  public hasAnyKey(): boolean {
    return Boolean(
      this.getKey('openai') ||
      this.getKey('gemini') ||
      this.getKey('claude') ||
      this.getKey('deepseek') ||
      this.getKey('groq')
    );
  }
}

export const providerKeyStore = new ProviderKeyStore();
