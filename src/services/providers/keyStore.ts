import { ProviderConfig, ProviderId } from '@/types';

const STORAGE_PREFIX = 'aihub_provider_key_';
const MODEL_PREFIX = 'aihub_provider_model_';
const ENABLED_PREFIX = 'aihub_provider_enabled_';

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
  claude: 'claude-3-7-sonnet-20250219',
};

export const AVAILABLE_MODELS: Record<ProviderId, { id: string; name: string; description: string }[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Flagship model for complex analysis and synthesis' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'High-speed, cost-effective reasoning' },
    { id: 'o3-mini', name: 'o3-mini', description: 'Advanced mathematical and coding logic' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Next-generation ultra-fast multimodal intelligence' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Deep reasoning, advanced critique, and analytical breadth' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Massive context window analysis' },
  ],
  claude: [
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Leading hybrid reasoning model for critical review' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Exceptional nuanced reasoning and writing' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast, lightweight critical analysis' },
  ],
};

class ProviderKeyStore {
  private memoryKeys: Map<ProviderId, string> = new Map();

  constructor() {
    // Restore session keys if present in browser sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const providers: ProviderId[] = ['openai', 'gemini', 'claude'];
        for (const p of providers) {
          const stored = window.sessionStorage.getItem(STORAGE_PREFIX + p);
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
    return this.memoryKeys.get(provider) || '';
  }

  public setKey(provider: ProviderId, key: string): void {
    const trimmed = key.trim();
    if (trimmed) {
      this.memoryKeys.set(provider, trimmed);
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.setItem(STORAGE_PREFIX + provider, trimmed);
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
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(STORAGE_PREFIX + provider);
      } catch {
        // Ignore storage access errors
      }
    }
  }

  public getModel(provider: ProviderId): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(MODEL_PREFIX + provider);
      if (stored) return stored;
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
    // Default enabled for OpenAI, Gemini, Claude
    return true;
  }

  public setEnabled(provider: ProviderId, enabled: boolean): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ENABLED_PREFIX + provider, String(enabled));
    }
  }

  public getConfigs(): Record<ProviderId, ProviderConfig> {
    const providers: ProviderId[] = ['openai', 'gemini', 'claude'];
    const configs: Partial<Record<ProviderId, ProviderConfig>> = {};

    for (const p of providers) {
      const key = this.getKey(p);
      configs[p] = {
        id: p,
        name: p === 'openai' ? 'OpenAI' : p === 'gemini' ? 'Gemini' : 'Claude',
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
      this.getKey('claude')
    );
  }
}

export const providerKeyStore = new ProviderKeyStore();
