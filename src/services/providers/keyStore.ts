import { ProviderConfig, ProviderId } from '@/types';

const STORAGE_PREFIX = 'aihub_provider_key_';
const MODEL_PREFIX = 'aihub_provider_model_';
const ENABLED_PREFIX = 'aihub_provider_enabled_';

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: 'gpt-4o',
  gemini: 'gemini-3.8-flash',
  claude: 'claude-3-5-sonnet-20241022',
  deepseek: 'deepseek-chat',
  groq: 'llama-3.3-70b-versatile',
};

export const AVAILABLE_MODELS: Record<ProviderId, { id: string; name: string; description: string }[]> = {
  openai: [
    { id: 'gpt-4o', name: 'gpt-4o', description: 'Flagship model for high-intelligence reasoning' },
    { id: 'gpt-4o-mini', name: 'gpt-4o-mini', description: 'Affordable, fast model for everyday tasks' },
    { id: 'gpt-4-turbo', name: 'gpt-4-turbo', description: 'High-capability multimodal predecessor' },
  ],
  gemini: [
    { id: 'gemini-3.8-flash', name: 'gemini-3.8-flash', description: 'Latest next-gen high speed multimodal model (Recommended)' },
    { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', description: 'Fast performance across general tasks' },
    { id: 'gemini-1.5-flash', name: 'gemini-1.5-flash', description: 'Lightweight model for everyday tasks' },
    { id: 'gemini-1.5-pro', name: 'gemini-1.5-pro', description: 'Complex reasoning tasks, coding, and massive context' },
  ],
  claude: [
    { id: 'claude-3-5-sonnet-20241022', name: 'claude-3-5-sonnet-20241022', description: 'Anthropic flagship model for coding and deep reasoning' },
    { id: 'claude-3-5-haiku-20241022', name: 'claude-3-5-haiku-20241022', description: 'Ultra-fast lightweight model with near-instant responsiveness' },
    { id: 'claude-3-opus-20240229', name: 'claude-3-opus-20240229', description: 'Powerful model for highly complex analytical assignments' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'deepseek-chat', description: 'Official DeepSeek-V3 model for general chat and coding' },
    { id: 'deepseek-reasoner', name: 'deepseek-reasoner', description: 'Official DeepSeek-R1 reasoning model with CoT' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'llama-3.3-70b-versatile', description: 'Meta Llama 3.3 70B on Groq LPUs' },
    { id: 'llama-3.1-8b-instant', name: 'llama-3.1-8b-instant', description: 'Meta Llama 3.1 8B instant inference' },
    { id: 'mixtral-8x7b-32768', name: 'mixtral-8x7b-32768', description: 'Mistral Mixtral 8x7B MoE model' },
  ],
};

export const ALL_PROVIDERS: ProviderId[] = ['openai', 'gemini', 'claude', 'deepseek', 'groq'];

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
        if (provider === 'gemini' && (stored.includes('2.0') || stored === 'gemini-1.5-flash')) {
          this.setModel('gemini', 'gemini-3.8-flash');
          return 'gemini-3.8-flash';
        }
        if (provider === 'groq' && (stored.includes('llama-3.1-8b') || !stored)) {
          this.setModel('groq', 'llama-3.3-70b-versatile');
          return 'llama-3.3-70b-versatile';
        }
        const validList = AVAILABLE_MODELS[provider]?.map((m) => m.id) || [];
        if (validList.includes(stored)) {
          return stored;
        }
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
            : 'Groq',
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
