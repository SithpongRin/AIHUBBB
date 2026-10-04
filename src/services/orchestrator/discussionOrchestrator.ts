import { DiscussionFile, DiscussionMessage, DiscussionStatus, ProviderId } from '@/types';
import { providerKeyStore } from '../providers/keyStore';
import { providerRegistry } from '../providers/registry';
import { findLighterFallbackModel, pickSensibleDefaultModel } from '../providers/modelUtils';
import { sanitizeMessage } from '../providers/withRetry';
import { providerQueue } from './providerQueue';
import {
  buildChatTurnPrompt,
  buildModeratorPrompt,
  buildRound1Prompt,
  buildRound2Prompt,
  buildRound3Prompt,
  ROLE_DEFINITIONS,
} from './prompts';

export interface OrchestrationNotice {
  provider: ProviderId;
  message: string;
}

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
  onNotice?: (notice: OrchestrationNotice) => void;
}

export function formatFriendlyErrorMessage(err: unknown): string {
  if (!err) return 'An unexpected error occurred.';
  const rawMsg = err instanceof Error ? err.message : String(err);
  const lower = rawMsg.toLowerCase();

  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return 'Rate limit or quota exceeded. Please wait a moment and retry, or choose a lighter model in Settings.';
  }
  if (lower.includes('404') || lower.includes('not found') || lower.includes('does not exist')) {
    return 'The selected model was not found or is unavailable on this account. Please select another model in Settings.';
  }
  if (lower.includes('401') || lower.includes('auth') || lower.includes('api key') || lower.includes('unauthorized')) {
    return 'Authentication failed. Please verify your API key in Settings.';
  }
  if (lower.includes('cancel') || lower.includes('abort')) {
    return 'Request was stopped by user.';
  }
  return sanitizeMessage(rawMsg) || 'Provider request failed. Please check your connection and retry.';
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
      onNotice,
    } = options;

    this.isCancelled = false;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    onStatusChange('running');

    // Configure per-provider queue gap from user preferences
    const delaySeconds = providerKeyStore.getRequestDelay();
    providerQueue.setGap(delaySeconds * 1000);

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

    // Filter participants to only those with configured keys
    const configuredParticipants = participants.filter((p) => Boolean(providerKeyStore.getKey(p)));
    const targetParticipants = configuredParticipants.length > 0 ? configuredParticipants : participants;

    // =========================================================================
    // VALIDATE MODELS AT DISCUSSION START
    // =========================================================================
    for (const p of targetParticipants) {
      if (this.isCancelled) break;
      const apiKey = providerKeyStore.getKey(p);
      if (!apiKey) continue;

      try {
        const pInstance = providerRegistry.get(p);
        const currentModel = providerKeyStore.getModel(p);
        const activeModels = await pInstance.listModels(apiKey);

        if (activeModels && activeModels.length > 0) {
          const isModelValid = activeModels.some((m) => m.id === currentModel);
          if (!isModelValid) {
            const fallbackModel = pickSensibleDefaultModel(activeModels);
            if (fallbackModel && fallbackModel !== currentModel) {
              providerKeyStore.setModel(p, fallbackModel);
              onNotice?.({
                provider: p,
                message: `${pInstance.name} model "${currentModel}" is unavailable. Auto-selected "${fallbackModel}".`,
              });
            }
          }
        }
      } catch {
        // Non-blocking: proceed with stored model
      }
    }

    if (this.isCancelled) {
      onStatusChange('cancelled');
      return allMessages;
    }

    // Helper: Execute provider call with lighter model quota fallback
    const callProviderWithFallback = async (
      p: ProviderId,
      role: 'analysis' | 'review' | 'debate' | 'final',
      userPrompt: string,
      systemPrompt: string
    ) => {
      const pInstance = providerRegistry.get(p);
      const apiKey = providerKeyStore.getKey(p);
      let targetModel = providerKeyStore.getModel(p);

      const doCall = async (modelToUse: string) => {
        return pInstance.generateResponse({
          provider: p,
          model: modelToUse,
          apiKey,
          role,
          systemPrompt,
          userPrompt,
          signal,
        });
      };

      try {
        return await providerQueue.enqueue(p, () => doCall(targetModel), signal);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : '';
        const isQuota =
          errMsg.includes('429') ||
          errMsg.toLowerCase().includes('quota') ||
          errMsg.toLowerCase().includes('rate limit');

        if (isQuota) {
          let availableList = undefined;
          try {
            availableList = await pInstance.listModels(apiKey);
          } catch {
            // ignore
          }

          const lighterModel = findLighterFallbackModel(p, targetModel, availableList);
          if (lighterModel && lighterModel !== targetModel) {
            onNotice?.({
              provider: p,
              message: `${pInstance.name} quota reached on "${targetModel}". Retrying with lighter model "${lighterModel}"...`,
            });
            targetModel = lighterModel;
            providerKeyStore.setModel(p, lighterModel);
            return await providerQueue.enqueue(p, () => doCall(lighterModel), signal);
          }
        }
        throw err;
      }
    };

    try {
      // =========================================================================
      // ROUND 1: INDEPENDENT ANALYSIS (Concurrent with per-provider serialization)
      // =========================================================================
      if (this.isCancelled) return allMessages;

      const r1Tasks = targetParticipants.map(async (p) => {
        if (this.isCancelled) return;
        const msg = createInitialMessage(1, p, 'analysis');

        // Conversational context if historical conversation exists
        const priorCompleted = allMessages.filter(
          (m) => m.status === 'completed' && Boolean(m.content)
        );
        const userPrompt = options.history && options.history.length > 0
          ? buildChatTurnPrompt(question, options.history, priorCompleted, p, files)
          : buildRound1Prompt(question, files);

        const systemPrompt = ROLE_DEFINITIONS[p]?.systemInstruction || '';

        try {
          const res = await callProviderWithFallback(p, 'analysis', userPrompt, systemPrompt);
          updateMessage(msg.id, {
            content: res.content,
            model: res.model,
            status: 'completed',
            duration_ms: res.durationMs,
          });
        } catch (err: unknown) {
          const friendlyErr = formatFriendlyErrorMessage(err);
          updateMessage(msg.id, {
            status: this.isCancelled ? 'cancelled' : 'failed',
            error_message: friendlyErr,
          });
        }
      });

      await Promise.allSettled(r1Tasks);

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

      // =========================================================================
      // ROUND 2: CROSS REVIEW (if rounds >= 2)
      // =========================================================================
      if (rounds >= 2 && !this.isCancelled) {
        const r1Messages = allMessages.filter((m) => m.round_number === 1);

        const r2Tasks = targetParticipants.map(async (p) => {
          if (this.isCancelled) return;
          const msg = createInitialMessage(2, p, 'review');
          const systemPrompt = ROLE_DEFINITIONS[p]?.systemInstruction || '';
          const userPrompt = buildRound2Prompt(question, r1Messages, p, files);

          try {
            const res = await callProviderWithFallback(p, 'review', userPrompt, systemPrompt);
            updateMessage(msg.id, {
              content: res.content,
              model: res.model,
              status: 'completed',
              duration_ms: res.durationMs,
            });
          } catch (err: unknown) {
            const friendlyErr = formatFriendlyErrorMessage(err);
            updateMessage(msg.id, {
              status: this.isCancelled ? 'cancelled' : 'failed',
              error_message: friendlyErr,
            });
          }
        });

        await Promise.allSettled(r2Tasks);
        if (this.isCancelled) {
          onStatusChange('cancelled');
          return allMessages;
        }
      }

      // =========================================================================
      // ROUND 3: FINAL DEBATE (if rounds >= 3)
      // =========================================================================
      if (rounds >= 3 && !this.isCancelled) {
        const r1Messages = allMessages.filter((m) => m.round_number === 1);
        const r2Messages = allMessages.filter((m) => m.round_number === 2);

        const r3Tasks = targetParticipants.map(async (p) => {
          if (this.isCancelled) return;
          const msg = createInitialMessage(3, p, 'debate');
          const systemPrompt = ROLE_DEFINITIONS[p]?.systemInstruction || '';
          const userPrompt = buildRound3Prompt(question, r1Messages, r2Messages, p, files);

          try {
            const res = await callProviderWithFallback(p, 'debate', userPrompt, systemPrompt);
            updateMessage(msg.id, {
              content: res.content,
              model: res.model,
              status: 'completed',
              duration_ms: res.durationMs,
            });
          } catch (err: unknown) {
            const friendlyErr = formatFriendlyErrorMessage(err);
            updateMessage(msg.id, {
              status: this.isCancelled ? 'cancelled' : 'failed',
              error_message: friendlyErr,
            });
          }
        });

        await Promise.allSettled(r3Tasks);
        if (this.isCancelled) {
          onStatusChange('cancelled');
          return allMessages;
        }
      }

      // =========================================================================
      // FINAL AI MODERATOR SYNTHESIS
      // =========================================================================
      if (!this.isCancelled) {
        const finalRoundNum = rounds + 1;
        const finalMsg = createInitialMessage(finalRoundNum, moderator, 'final');

        // Choose viable moderator (prefer user choice, or fallback to any provider that completed)
        let activeMod = moderator;
        const completedParticipants = Array.from(
          new Set(allMessages.filter((m) => m.status === 'completed').map((m) => m.provider as ProviderId))
        );

        if (!completedParticipants.includes(activeMod)) {
          if (completedParticipants.length > 0) {
            activeMod = completedParticipants[0];
          }
        }

        const { systemPrompt, userPrompt } = buildModeratorPrompt(question, allMessages, files);

        try {
          const res = await callProviderWithFallback(activeMod, 'final', userPrompt, systemPrompt);
          updateMessage(finalMsg.id, {
            content: res.content,
            model: res.model,
            status: 'completed',
            duration_ms: res.durationMs,
            provider: activeMod,
          });

          onStatusChange('completed');
        } catch (err: unknown) {
          // If first moderator choice fails, try an alternate completed provider once
          const alternateMod = completedParticipants.find((p) => p !== activeMod);
          if (alternateMod) {
            try {
              onNotice?.({
                provider: activeMod,
                message: `Moderator ${activeMod} encountered an error. Falling back to ${alternateMod} for synthesis...`,
              });
              const resAlt = await callProviderWithFallback(alternateMod, 'final', userPrompt, systemPrompt);
              updateMessage(finalMsg.id, {
                content: resAlt.content,
                model: resAlt.model,
                status: 'completed',
                duration_ms: resAlt.durationMs,
                provider: alternateMod,
              });
              onStatusChange('completed');
              return allMessages;
            } catch {
              // Both failed
            }
          }

          const friendlyErr = formatFriendlyErrorMessage(err);
          updateMessage(finalMsg.id, {
            status: this.isCancelled ? 'cancelled' : 'failed',
            error_message: friendlyErr,
          });
          onStatusChange(this.isCancelled ? 'cancelled' : 'failed');
        }
      }
    } catch (err: unknown) {
      if (this.isCancelled) {
        onStatusChange('cancelled');
      } else {
        const errMsg = err instanceof Error ? sanitizeMessage(err.message) : 'Deliberation failed';
        const failMsg: DiscussionMessage = {
          id: `${discussionId}-final-error`,
          discussion_id: discussionId,
          round_number: rounds + 1,
          provider: moderator,
          model: 'system',
          role: 'final',
          content: `### Deliberation Paused\n\n**Issue:** ${errMsg}\n\n**How to fix:**\n1. Open **Settings**.\n2. Verify your API keys for **Google Gemini**, **Groq**, **OpenAI**, or **Claude**.\n3. Verify your selected models or select lighter models if hitting rate limits.\n\nOnce saved, retry your message.`,
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

  /**
   * Retry a single failed message in-place.
   */
  public async retryMessage(
    failedMessage: DiscussionMessage,
    question: string,
    allMessages: DiscussionMessage[],
    files?: DiscussionFile[],
    onUpdate?: (msg: DiscussionMessage) => void
  ): Promise<DiscussionMessage> {
    if (failedMessage.provider === 'user') return failedMessage;

    const p = failedMessage.provider as ProviderId;
    const pInstance = providerRegistry.get(p);
    const apiKey = providerKeyStore.getKey(p);
    const model = providerKeyStore.getModel(p);

    if (!apiKey) {
      const updated: DiscussionMessage = {
        ...failedMessage,
        status: 'failed',
        error_message: `API key for ${pInstance.name} is missing in Settings.`,
      };
      onUpdate?.(updated);
      return updated;
    }

    // Set to thinking
    const thinkingMsg: DiscussionMessage = {
      ...failedMessage,
      status: 'thinking',
      error_message: undefined,
    };
    onUpdate?.(thinkingMsg);

    try {
      let userPrompt = '';
      let systemPrompt = ROLE_DEFINITIONS[p]?.systemInstruction || '';

      if (failedMessage.role === 'analysis') {
        userPrompt = buildRound1Prompt(question, files);
      } else if (failedMessage.role === 'review') {
        const r1 = allMessages.filter((m) => m.round_number === 1 && m.id !== failedMessage.id);
        userPrompt = buildRound2Prompt(question, r1, p, files);
      } else if (failedMessage.role === 'debate') {
        const r1 = allMessages.filter((m) => m.round_number === 1);
        const r2 = allMessages.filter((m) => m.round_number === 2 && m.id !== failedMessage.id);
        userPrompt = buildRound3Prompt(question, r1, r2, p, files);
      } else {
        const mod = buildModeratorPrompt(question, allMessages.filter((m) => m.id !== failedMessage.id), files);
        userPrompt = mod.userPrompt;
        systemPrompt = mod.systemPrompt;
      }

      const res = await providerQueue.enqueue(p, () => {
        return pInstance.generateResponse({
          provider: p,
          model,
          apiKey,
          role: failedMessage.role,
          systemPrompt,
          userPrompt,
        });
      });

      const completedMsg: DiscussionMessage = {
        ...failedMessage,
        content: res.content,
        model: res.model,
        status: 'completed',
        duration_ms: res.durationMs,
        error_message: undefined,
      };

      onUpdate?.(completedMsg);
      return completedMsg;
    } catch (err: unknown) {
      const friendlyErr = formatFriendlyErrorMessage(err);
      const failedUpdated: DiscussionMessage = {
        ...failedMessage,
        status: 'failed',
        error_message: friendlyErr,
      };
      onUpdate?.(failedUpdated);
      return failedUpdated;
    }
  }
}
