import { ProviderId } from '@/types';

export interface ProviderPrefixRule {
  prefix: string;
  candidateProviders: ProviderId[];
  displayName: string;
  isAmbiguous?: boolean;
}

/**
 * Single configuration table for provider detection rules.
 * New providers and prefix patterns can be added here in one place.
 */
export const PROVIDER_PREFIX_RULES: ProviderPrefixRule[] = [
  {
    prefix: 'gsk_',
    candidateProviders: ['groq'],
    displayName: 'Groq',
  },
  {
    prefix: 'sk-ant-',
    candidateProviders: ['claude'],
    displayName: 'Anthropic Claude',
  },
  {
    prefix: 'AIza',
    candidateProviders: ['gemini'],
    displayName: 'Google Gemini',
  },
  {
    prefix: 'sk-proj-',
    candidateProviders: ['openai'],
    displayName: 'OpenAI (Project Key)',
  },
  {
    prefix: 'sk-or-',
    candidateProviders: [],
    displayName: 'OpenRouter',
  },
  {
    prefix: 'xai-',
    candidateProviders: [],
    displayName: 'xAI (Grok)',
  },
  {
    prefix: 'sk-',
    candidateProviders: ['openai', 'deepseek'],
    displayName: 'OpenAI or DeepSeek',
    isAmbiguous: true,
  },
];

export interface DetectResult {
  detectedProvider: ProviderId | null;
  candidateProviders: ProviderId[];
  displayName: string;
  isAmbiguous: boolean;
  isUnknown: boolean;
  matchedPrefix?: string;
}

/**
 * Detect provider candidate(s) from a pasted API key using prefix matching.
 * SECURITY: Only returns matched candidate providers. Never suggests probing unrelated providers.
 */
export function detectProvider(apiKey: string): DetectResult {
  const trimmed = (apiKey || '').trim();

  if (!trimmed) {
    return {
      detectedProvider: null,
      candidateProviders: [],
      displayName: '',
      isAmbiguous: false,
      isUnknown: false,
    };
  }

  for (const rule of PROVIDER_PREFIX_RULES) {
    if (trimmed.startsWith(rule.prefix)) {
      if (rule.isAmbiguous) {
        return {
          detectedProvider: null,
          candidateProviders: rule.candidateProviders,
          displayName: rule.displayName,
          isAmbiguous: true,
          isUnknown: false,
          matchedPrefix: rule.prefix,
        };
      }

      const singleProvider = rule.candidateProviders[0] || null;
      return {
        detectedProvider: singleProvider,
        candidateProviders: rule.candidateProviders,
        displayName: rule.displayName,
        isAmbiguous: false,
        isUnknown: rule.candidateProviders.length === 0,
        matchedPrefix: rule.prefix,
      };
    }
  }

  return {
    detectedProvider: null,
    candidateProviders: [],
    displayName: 'Unrecognized format',
    isAmbiguous: false,
    isUnknown: true,
  };
}
