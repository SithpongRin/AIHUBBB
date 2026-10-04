import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  ShieldCheck,
  Zap,
  Cpu,
  Sliders,
  User,
  Clock,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { DiscussionMessage, ProviderId } from '@/types';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface ResponseCardProps {
  message: DiscussionMessage;
  roundTitle?: string;
  onRetry?: (message: DiscussionMessage) => void;
}

export const ResponseCard: React.FC<ResponseCardProps> = ({ message, roundTitle, onRetry }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Provider branding styling
  const getProviderConfig = (provider: ProviderId | 'user') => {
    switch (provider) {
      case 'openai':
        return {
          name: 'OpenAI',
          badgeBg: 'bg-emerald-500/10 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-emerald-500/20',
          dotBg: 'bg-emerald-600 dark:bg-emerald-400',
          icon: Brain,
          defaultRole: 'Lead Analyst',
        };
      case 'gemini':
        return {
          name: 'Gemini',
          badgeBg: 'bg-blue-500/10 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300 border-blue-500/20',
          dotBg: 'bg-blue-600 dark:bg-blue-400',
          icon: Sparkles,
          defaultRole: 'Alternative Analyst',
        };
      case 'claude':
        return {
          name: 'Claude',
          badgeBg: 'bg-amber-500/10 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300 border-amber-500/20',
          dotBg: 'bg-amber-600 dark:bg-amber-400',
          icon: ShieldCheck,
          defaultRole: 'Critical Reviewer',
        };
      case 'groq':
        return {
          name: 'Groq',
          badgeBg: 'bg-orange-500/10 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300 border-orange-500/20',
          dotBg: 'bg-orange-600 dark:bg-orange-400',
          icon: Zap,
          defaultRole: 'Fast Synthesizer',
        };
      case 'deepseek':
        return {
          name: 'DeepSeek',
          badgeBg: 'bg-cyan-500/10 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300 border-cyan-500/20',
          dotBg: 'bg-cyan-600 dark:bg-cyan-400',
          icon: Cpu,
          defaultRole: 'Deep Reasoning',
        };
      case 'mock':
        return {
          name: 'Mock AI',
          badgeBg: 'bg-purple-500/10 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300 border-purple-500/20',
          dotBg: 'bg-purple-600 dark:bg-purple-400',
          icon: Sliders,
          defaultRole: 'Simulated Agent',
        };
      case 'user':
        return {
          name: 'You',
          badgeBg: 'bg-zinc-500/10 text-zinc-800 dark:bg-zinc-500/15 dark:text-zinc-300 border-zinc-500/20',
          dotBg: 'bg-zinc-600 dark:bg-zinc-400',
          icon: User,
          defaultRole: 'User Inquiry',
        };
      default:
        return {
          name: 'AI Council',
          badgeBg: 'bg-indigo-500/10 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300 border-indigo-500/20',
          dotBg: 'bg-indigo-600 dark:bg-indigo-400',
          icon: Brain,
          defaultRole: 'Synthesized Agent',
        };
    }
  };

  const pConfig = getProviderConfig(message.provider);
  const ProviderIcon = pConfig.icon;

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'analysis':
        return 'Round 1: Independent Analysis';
      case 'review':
        return 'Round 2: Cross Review';
      case 'debate':
        return 'Round 3: Final Debate';
      case 'final':
        return 'Final Synthesis';
      default:
        return role;
    }
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 shadow-xs overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/60 dark:bg-zinc-900/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            <ProviderIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                {pConfig.name}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${pConfig.badgeBg}`}>
                {message.model || pConfig.defaultRole}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {message.duration_ms !== undefined && message.duration_ms > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
              <Clock className="w-3 h-3" />
              <span>{(message.duration_ms / 1000).toFixed(1)}s</span>
            </span>
          )}

          {message.content && (
            <button
              type="button"
              onClick={copyToClipboard}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded transition-colors cursor-pointer"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 flex-1 overflow-y-auto max-h-[500px]">
        {message.status === 'thinking' && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="relative mb-3">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-600/20 border-t-indigo-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-2 h-2 rounded-full ${pConfig.dotBg}`} />
              </div>
            </div>
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {pConfig.name} is evaluating the problem...
            </p>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 mt-1">
              Applying {pConfig.defaultRole} paradigm
            </p>
          </div>
        )}

        {message.status === 'failed' && (
          <div className="p-4 rounded-xl bg-rose-50/90 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-800 dark:text-rose-300 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>Response Interrupted</span>
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(message)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry this response</span>
                </button>
              )}
            </div>
            <p className="text-rose-700 dark:text-rose-400 leading-relaxed text-[11px]">
              {message.error_message || 'The model did not return a response. Please check your API key in Settings.'}
            </p>
          </div>
        )}

        {message.status === 'cancelled' && (
          <div className="py-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
            Discussion was stopped before completion.
          </div>
        )}

        {message.content && (
          <MarkdownRenderer content={message.content} />
        )}
      </div>

      {/* Card Footer Subtitle */}
      {roundTitle && (
        <div className="px-4 py-1.5 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/30 text-[10px] text-zinc-600 dark:text-zinc-300 flex items-center justify-between">
          <span>{getRoleLabel(message.role)}</span>
          <span className="font-mono">Round {message.round_number}</span>
        </div>
      )}
    </div>
  );
};
