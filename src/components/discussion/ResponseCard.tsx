import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Copy,
  Check,
  Loader2,
  XCircle,
} from 'lucide-react';
import { DiscussionMessage, ProviderId } from '@/types';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface ResponseCardProps {
  message: DiscussionMessage;
  roundTitle?: string;
}

export const ResponseCard: React.FC<ResponseCardProps> = ({ message, roundTitle }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Provider branding styling
  const getProviderConfig = (provider: ProviderId) => {
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
      default:
        return {
          name: 'AI Simulator',
          badgeBg: 'bg-purple-500/10 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300 border-purple-500/20',
          dotBg: 'bg-purple-600 dark:bg-purple-400',
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
              <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${pConfig.badgeBg}`}>
                {pConfig.defaultRole}
              </span>
            </div>
            <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-300 truncate">
              {message.model || 'auto'}
            </div>
          </div>
        </div>

        {/* Status / Timing / Copy */}
        <div className="flex items-center gap-2 shrink-0">
          {message.status === 'thinking' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Analyzing</span>
            </span>
          )}

          {message.status === 'completed' && (
            <>
              {message.duration_ms ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                  <Clock className="w-3 h-3" />
                  <span>{(message.duration_ms / 1000).toFixed(1)}s</span>
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Ready</span>
              </span>
            </>
          )}

          {message.status === 'failed' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>Failed</span>
            </span>
          )}

          {message.status === 'cancelled' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <XCircle className="w-3 h-3" />
              <span>Cancelled</span>
            </span>
          )}

          {message.content && (
            <button
              onClick={copyToClipboard}
              title="Copy response"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
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
          <div className="p-3.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>Provider Error</span>
            </p>
            <p className="text-rose-700 dark:text-rose-400 leading-relaxed">
              {message.error_message || 'The model did not return a response. Please verify your API key in Settings.'}
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
