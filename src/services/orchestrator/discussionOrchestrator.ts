import { DiscussionFile, DiscussionMessage, DiscussionStatus, ProviderId } from '@/types';
import { providerKeyStore } from '../providers/keyStore';
import { providerRegistry } from '../providers/registry';
import {
  buildChatTurnPrompt,
  buildModeratorPrompt,
  buildRound1Prompt,
  buildRound2Prompt,
  buildRound3Prompt,
  buildSequentialGroupChatPrompt,
  ROLE_DEFINITIONS,
} from './prompts';

export interface OrchestrationOptions {
  discussionId: string;
  question: string;
  participants: ProviderId[];
  rounds: number;
  moderator: ProviderId;
  files?: DiscussionFile[];
  history?: DiscussionMessage[];
  onMessageUpdate: (msg: DiscussionMessage) => void;
  onStatusChange: (status: DiscussionStatus) => void;
}

export class DiscussionOrchestrator {
  private abortController: AbortController | null = null;
  private isCancelled = false;

  public stop(): void {
    this.isCancelled = true;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  public async run(options: OrchestrationOptions): Promise<DiscussionMessage[]> {
    const {
      discussionId,
      question,
      participants,
      rounds,
      moderator,
      files,
      onMessageUpdate,
      onStatusChange,
    } = options;

    this.isCancelled = false;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    onStatusChange('running');

    const allMessages: DiscussionMessage[] = [];

    const createInitialMessage = (
      roundNumber: number,
      provider: ProviderId,
      role: 'analysis' | 'review' | 'debate' | 'final'
    ): DiscussionMessage => {
      const model = providerKeyStore.getModel(provider) || 'default';
      const uniqueSuffix = Math.random().toString(36).substring(2, 7);
      const msg: DiscussionMessage = {
        id: `${discussionId}-${Date.now()}-${provider}-${uniqueSuffix}`,
        discussion_id: discussionId,
        round_number: roundNumber,
        provider,
        model,
        role,
        content: '',
        status: 'thinking',
        created_at: new Date().toISOString(),
      };
      allMessages.push(msg);
      onMessageUpdate({ ...msg });
      return msg;
    };

    const updateMessage = (
      msgId: string,
      updates: Partial<DiscussionMessage>
    ): DiscussionMessage => {
      const idx = allMessages.findIndex((m) => m.id === msgId);
      if (idx !== -1) {
        allMessages[idx] = { ...allMessages[idx], ...updates };
        onMessageUpdate({ ...allMessages[idx] });
        return allMessages[idx];
      }
      throw new Error(`Message ${msgId} not found`);
    };

    // Filter participants to only those that actually have configured API keys!
    const configuredParticipants = participants.filter((p) => Boolean(providerKeyStore.getKey(p)));
    const targetParticipants = configuredParticipants.length > 0 ? configuredParticipants : participants;

    try {
      // ==========================================
      // ROUND 1: CONVERSATIONAL GROUP CHAT RESPONSES
      // ==========================================
      if (this.isCancelled) return allMessages;

      for (const p of targetParticipants) {
        if (this.isCancelled) break;
        const msg = createInitialMessage(1, p, 'analysis');
        const providerInstance = providerRegistry.get(p);
        const apiKey = providerKeyStore.getKey(p);
        const model = providerKeyStore.getModel(p);

        // Gather completed prior responses so this model speaks directly in the thread!
        const priorCompleted = allMessages.filter(
          (m) => m.status === 'completed' && Boolean(m.content)
        );
        const userPrompt = buildChatTurnPrompt(
          question,
          options.history || [],
          priorCompleted,
          p,
          files
        );

        try {
          const res = await providerInstance.generateResponse({
            provider: p,
            model,
            apiKey,
            role: 'analysis',
            systemPrompt: ROLE_DEFINITIONS[p]?.systemInstruction || '',
            userPrompt,
            signal,
          });

          updateMessage(msg.id, {
            content: res.content,
            status: 'completed',
            duration_ms: res.durationMs,
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Unknown provider error';
          updateMessage(msg.id, {
            status: this.isCancelled ? 'cancelled' : 'failed',
            error_message: errMsg,
          });
        }
      }

      if (this.isCancelled) {
        onStatusChange('cancelled');
        return allMessages;
      }

      const completedR1 = allMessages.filter((m) => m.round_number === 1 && m.status === 'completed');
      if (completedR1.length === 0) {
        const errorDetails = allMessages
          .filter((m) => m.round_number === 1 && m.error_message)
          .map((m) => `${m.provider.toUpperCase()}: ${m.error_message}`)
          .join('\n');
        throw new Error(errorDetails || 'All AI providers failed to respond in Round 1. Please check API keys in Settings.');
      }

      // ==========================================
      // ROUND 2: CROSS REVIEW (if rounds >= 2)
      // ==========================================
      if (rounds >= 2 && !this.isCancelled) {
        const r1Messages = allMessages.filter((m) => m.round_number === 1);

        const r2Promises = targetParticipants.map(async (p) => {
          const msg = createInitialMessage(2, p, 'review');
          const providerInstance = providerRegistry.get(p);
          const apiKey = providerKeyStore.getKey(p);
          const model = providerKeyStore.getModel(p);

          try {
            const res = await providerInstance.generateResponse({
              provider: p,
              model,
              apiKey,
              role: 'review',
              systemPrompt: ROLE_DEFINITIONS[p]?.systemInstruction || '',
              userPrompt: buildRound2Prompt(question, r1Messages, p, files),
              signal,
            });

            return updateMessage(msg.id, {
              content: res.content,
              status: 'completed',
              duration_ms: res.durationMs,
            });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Unknown provider error';
            return updateMessage(msg.id, {
              status: this.isCancelled ? 'cancelled' : 'failed',
              error_message: errMsg,
            });
          }
        });

        await Promise.allSettled(r2Promises);
        if (this.isCancelled) {
          onStatusChange('cancelled');
          return allMessages;
        }
      }

      // ==========================================
      // ROUND 3: FINAL DEBATE (if rounds >= 3)
      // ==========================================
      if (rounds >= 3 && !this.isCancelled) {
        const r1Messages = allMessages.filter((m) => m.round_number === 1);
        const r2Messages = allMessages.filter((m) => m.round_number === 2);

        const r3Promises = targetParticipants.map(async (p) => {
          const msg = createInitialMessage(3, p, 'debate');
          const providerInstance = providerRegistry.get(p);
          const apiKey = providerKeyStore.getKey(p);
          const model = providerKeyStore.getModel(p);

          try {
            const res = await providerInstance.generateResponse({
              provider: p,
              model,
              apiKey,
              role: 'debate',
              systemPrompt: ROLE_DEFINITIONS[p]?.systemInstruction || '',
              userPrompt: buildRound3Prompt(question, r1Messages, r2Messages, p, files),
              signal,
            });

            return updateMessage(msg.id, {
              content: res.content,
              status: 'completed',
              duration_ms: res.durationMs,
            });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Unknown provider error';
            return updateMessage(msg.id, {
              status: this.isCancelled ? 'cancelled' : 'failed',
              error_message: errMsg,
            });
          }
        });

        await Promise.allSettled(r3Promises);
        if (this.isCancelled) {
          onStatusChange('cancelled');
          return allMessages;
        }
      }

      // ==========================================
      // FINAL AI MODERATOR SYNTHESIS
      // ==========================================
      if (!this.isCancelled) {
        const finalRoundNum = rounds + 1;
        const finalMsg = createInitialMessage(finalRoundNum, moderator, 'final');

        // Check if moderator is valid or fallback to any completed provider
        let activeMod = moderator;
        if (!participants.includes(moderator) || !providerKeyStore.getKey(moderator)) {
          const candidate = participants.find((p) => providerKeyStore.getKey(p));
          if (candidate) activeMod = candidate;
        }

        const providerInstance = providerRegistry.get(activeMod);
        const apiKey = providerKeyStore.getKey(activeMod);
        const model = providerKeyStore.getModel(activeMod);

        const { systemPrompt, userPrompt } = buildModeratorPrompt(question, allMessages, files);

        try {
          const res = await providerInstance.generateResponse({
            provider: activeMod,
            model,
            apiKey,
            role: 'final',
            systemPrompt,
            userPrompt,
            signal,
          });

          updateMessage(finalMsg.id, {
            content: res.content,
            status: 'completed',
            duration_ms: res.durationMs,
            provider: activeMod,
          });

          onStatusChange('completed');
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Moderator synthesis failed';
          updateMessage(finalMsg.id, {
            status: this.isCancelled ? 'cancelled' : 'failed',
            error_message: errMsg,
          });
          onStatusChange(this.isCancelled ? 'cancelled' : 'failed');
        }
      }
    } catch (err: unknown) {
      if (this.isCancelled) {
        onStatusChange('cancelled');
      } else {
        const errMsg = err instanceof Error ? err.message : 'Deliberation failed';
        const failMsg: DiscussionMessage = {
          id: `${discussionId}-final-error`,
          discussion_id: discussionId,
          round_number: rounds + 1,
          provider: moderator,
          model: 'system',
          role: 'final',
          content: `### Deliberation Paused\n\n**Issue:** ${errMsg}\n\n**How to fix:**\nAIHUB connects directly to AI providers using your own API keys (Bring-Your-Own-Key). To get responses:\n1. Open **Settings** (gear icon in the top right or bottom left).\n2. Enter at least one API key for **Google Gemini (free)**, **OpenAI**, or **Anthropic Claude**.\n3. Click **Save API Keys & Models**.\n\nOnce saved, retry your message.`,
          status: 'failed',
          error_message: errMsg,
          created_at: new Date().toISOString(),
        };
        allMessages.push(failMsg);
        onMessageUpdate(failMsg);
        onStatusChange('failed');
      }
    }

    return allMessages;
  }
}
