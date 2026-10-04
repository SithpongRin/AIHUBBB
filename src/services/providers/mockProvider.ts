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

    let mockText = '';
    if (role === 'analysis') {
      mockText = `### Independent Analysis (Simulated by Mock ${model})\n\n**Core Assessment:**\nBased on first principles, the user's objective requires a structured balance between performance, reliability, and maintainability.\n\n1. **Key Requirement Analysis:** The request addresses system architecture and multi-model coordination.\n2. **Recommended Paradigm:** Adopt an asynchronous pipeline with localized fallback queues.\n3. **Identified Risk:** Unchecked parallel requests can trigger rate limits on downstream APIs.`;
    } else if (role === 'review') {
      mockText = `### Cross-Review & Critique (Simulated by Mock ${model})\n\n**Evaluation of Peer Positions:**\n- **Agreement:** Peer models correctly emphasize rate limit management.\n- **Disagreement:** Proposing synchronous blocking calls across rounds adds unnecessary latency.\n- **Recommended Refinement:** Implement exponential backoff with jitter and per-provider serialization queues.`;
    } else if (role === 'debate') {
      mockText = `### Final Debate & Stance (Simulated by Mock ${model})\n\n**Definitive Position:**\nThe optimal solution is a resilient per-provider request queue combined with dynamic model discovery. This resolves quota starvation without sacrificing multi-agent parallelism.`;
    } else if (role === 'final') {
      mockText = `## Final Synthesized Answer\n\n### Direct Answer\nThe Council recommends implementing per-provider serialization queues paired with dynamic model discovery and exponential backoff retry.\n\n### Key Reasoning\nThis architecture directly addresses the root causes of quota exhaustion while maintaining sub-second multi-model throughput.\n\n### Points of Agreement\nAll models agreed that hardcoded model names must be replaced with runtime discovery.\n\n### Important Disagreements\nDebate centered on parallel vs. sequential round execution; resolved by adopting per-provider isolation.\n\n### Best Conclusion\nAdopt dynamic model discovery with per-provider rate-limit spacing.\n\n### Practical Recommendation\n1. Use dynamic \`listModels\`.\n2. Wrap provider calls in \`withRetry\`.\n3. Space consecutive requests by 1.5s.\n\n### Remaining Uncertainty\nFree-tier quotas vary by region and account age.`;
    } else {
      mockText = `Mock response to: ${userPrompt.slice(0, 100)}...`;
    }

    return {
      provider: 'mock',
      model: model || this.defaultModel,
      content: mockText,
      durationMs: Date.now() - startTime,
    };
  }
}
