import { ModelInfo, ProviderId } from '@/types';

/**
 * Static fallback model lists used ONLY when dynamic model listing requests fail.
 */
export const STATIC_FALLBACK_MODELS: Record<ProviderId, ModelInfo[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    { id: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
    { id: 'llama3-70b-8192', label: 'Llama 3 70B' },
    { id: 'llama3-8b-8192', label: 'Llama 3 8B' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'o3-mini', label: 'o3-mini' },
    { id: 'o1', label: 'o1' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  claude: [
    { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ],
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
    { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
  ],
  mock: [
    { id: 'mock-fast', label: 'Mock Fast 1.0 (Simulation)' },
    { id: 'mock-analyst', label: 'Mock Lead Analyst (Simulation)' },
    { id: 'mock-critic', label: 'Mock Critical Reviewer (Simulation)' },
  ],
};

/**
 * Auto-select a sensible default from a list of models:
 * Prefer names containing "flash", "instant", "mini", "haiku", otherwise the first chat model.
 */
export function pickSensibleDefaultModel(models: ModelInfo[]): string {
  if (!models || models.length === 0) return '';

  const preferred = models.find((m) => {
    const lower = m.id.toLowerCase();
    return (
      lower.includes('flash') ||
      lower.includes('instant') ||
      lower.includes('mini') ||
      lower.includes('haiku')
    );
  });

  if (preferred) return preferred.id;
  return models[0].id;
}

/**
 * Find a lighter model for fallback when a model hits quota / 429.
 * E.g., pro -> flash, 70b -> 8b/instant/mini, sonnet -> haiku.
 */
export function findLighterFallbackModel(
  provider: ProviderId,
  currentModel: string,
  availableModels?: ModelInfo[]
): string | null {
  const models = availableModels && availableModels.length > 0
    ? availableModels
    : STATIC_FALLBACK_MODELS[provider] || [];

  const cur = (currentModel || '').toLowerCase();

  // If already using a lightweight model, don't fallback to the same
  const candidate = models.find((m) => {
    const lower = m.id.toLowerCase();
    if (lower === cur) return false;
    return (
      lower.includes('flash') ||
      lower.includes('instant') ||
      lower.includes('mini') ||
      lower.includes('haiku') ||
      lower.includes('8b')
    );
  });

  if (candidate) return candidate.id;

  // Fallback to any other model in list if different
  const anyDifferent = models.find((m) => m.id.toLowerCase() !== cur);
  return anyDifferent ? anyDifferent.id : null;
}
