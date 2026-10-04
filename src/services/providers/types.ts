import { MessageRole, ProviderId } from '@/types';

export interface ProviderRequest {
  provider: ProviderId;
  model: string;
  apiKey: string;
  role: MessageRole;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  provider: ProviderId;
  model: string;
  content: string;
  durationMs: number;
}

export interface AIProvider {
  id: ProviderId;
  name: string;
  description: string;
  defaultRoleName: string;
  defaultModel: string;
  validateConnection: (apiKey: string, model?: string) => Promise<{ success: boolean; error?: string }>;
  generateResponse: (request: ProviderRequest) => Promise<ProviderResponse>;
  fetchAvailableModels?: (apiKey: string) => Promise<{ id: string; name: string; description: string }[]>;
}
