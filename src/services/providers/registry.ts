import { ProviderId } from '@/types';
import { AIProvider } from './types';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';
import { ClaudeProvider } from './claudeProvider';

class ProviderRegistry {
  private providers: Map<ProviderId, AIProvider> = new Map();

  constructor() {
    this.register(new OpenAIProvider());
    this.register(new GeminiProvider());
    this.register(new ClaudeProvider());
  }

  public register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  public get(id: ProviderId): AIProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Provider "${id}" is not registered.`);
    }
    return provider;
  }

  public getAll(): AIProvider[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new ProviderRegistry();
