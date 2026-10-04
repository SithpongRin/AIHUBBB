import { ModelInfo, ProviderRequest, ProviderResponse } from './types';
import { AIProvider } from './types';

export class MockProvider implements AIProvider {
  public id = 'mock' as const;
  public name = 'Mock Engine';
  public description = 'Simulated AI engine for zero-cost testing, deliberation debugging, and offline verification.';
  public defaultRoleName = 'Simulated Agent';
  public defaultModel = 'mock-fast';

  public async validateConnection(_apiKey: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  public async listModels(_apiKey: string): Promise<ModelInfo[]> {
    return [
      { id: 'mock-fast', label: 'Mock Fast 1.0 (Simulation)' },
      { id: 'mock-analyst', label: 'Mock Lead Analyst (Simulation)' },
      { id: 'mock-critic', label: 'Mock Critical Reviewer (Simulation)' },
    ];
  }

  public async generateResponse(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();
    const { model, role, userPrompt, signal } = request;

    // Small simulated delay (300-600ms)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 400);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Mock request cancelled', 'AbortError'));
        });
      }
    });

    const rawQuery = (userPrompt || '').trim();
    const queryExcerpt = rawQuery ? (rawQuery.length > 80 ? rawQuery.slice(0, 80) + '...' : rawQuery) : 'the inquiry';

    let mockText = '';
    if (role === 'analysis') {
      mockText = `### Independent Analysis (Simulated by Mock ${model})\n\n**Topic:** "${queryExcerpt}"\n\n1. **Status:** Offline simulated analysis.\n2. **Perspective:** Analysis simulation for "${queryExcerpt}".\n3. **Notice:** Connect a live AI provider (such as Groq, Google Gemini, OpenAI) in Settings to receive live model responses.`;
    } else if (role === 'review') {
      mockText = `### Critique & Cross-Review (Simulated by Mock ${model})\n\n**Topic:** "${queryExcerpt}"\n\n- Validated pipeline execution in offline test mode.\n- To analyze this query with real AI, configure API keys in Settings.`;
    } else if (role === 'debate') {
      mockText = `### Deliberation Stance (Simulated by Mock ${model})\n\n**Topic:** "${queryExcerpt}"\n\nSimulation confirmed. Live models are ready once keys are added in Settings.`;
    } else if (role === 'final') {
      mockText = `## Synthesized Answer (Simulation Mode)\n\n### Response to: "${queryExcerpt}"\n\nThis is an offline simulation confirming your deliberation pipeline is functioning.\n\n> **Notice:** To receive real AI intelligence for "${queryExcerpt}", please open **Settings** (⚙️) and enter an API key (e.g. Groq, Google Gemini, OpenAI).`;
    } else {
      mockText = `[Simulated response to: ${queryExcerpt}]`;
    }

    return {
      provider: 'mock',
      model: model || this.defaultModel,
      content: mockText,
      durationMs: Date.now() - startTime,
    };
  }
}
