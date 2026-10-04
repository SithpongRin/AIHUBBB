import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  GitCompare,
  Lightbulb,
  Check,
  Copy,
  HelpCircle,
  TrendingUp,
  Brain,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { DiscussionMessage, ProviderId } from '@/types';
import { parseFinalSynthesis } from '@/services/orchestrator/parseSynthesis';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface FinalSynthesisCardProps {
  finalMessage?: DiscussionMessage;
  moderatorProvider: ProviderId;
}

export const FinalSynthesisCard: React.FC<FinalSynthesisCardProps> = ({
  finalMessage,
  moderatorProvider,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewRaw, setViewRaw] = useState(false);

  if (!finalMessage) return null;

  const sections = parseFinalSynthesis(finalMessage.content);

  const copyAll = () => {
    if (finalMessage.content) {
      navigator.clipboard.writeText(finalMessage.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getModeratorBadge = (mod: ProviderId) => {
    switch (mod) {
      case 'openai':
        return { name: 'OpenAI Moderator', icon: Brain, color: 'text-emerald-700 dark:text-emerald-300' };
      case 'gemini':
        return { name: 'Gemini Moderator', icon: Sparkles, color: 'text-blue-700 dark:text-blue-300' };
      case 'claude':
        return { name: 'Claude Moderator', icon: ShieldCheck, color: 'text-amber-800 dark:text-amber-300' };
      default:
        return { name: 'AI Moderator', icon: Award, color: 'text-indigo-700 dark:text-indigo-300' };
    }
  };

  const modInfo = getModeratorBadge(moderatorProvider);
  const ModIcon = modInfo.icon;

  return (
    <div className="rounded-2xl border-2 border-indigo-500/30 dark:border-indigo-500/40 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden transition-all">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-zinc-900 to-indigo-950 p-6 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Final Synthesized Verdict</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 border border-indigo-400/30 text-indigo-200">
                Consensus
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-300">
              <ModIcon className={`w-3.5 h-3.5 ${modInfo.color}`} />
              <span>Synthesized by {modInfo.name}</span>
              <span className="text-zinc-500">•</span>
              <span className="font-mono text-[11px] text-zinc-300">{finalMessage.model}</span>
              {finalMessage.duration_ms ? (
                <>
                  <span className="text-zinc-500">•</span>
                  <span>{(finalMessage.duration_ms / 1000).toFixed(1)}s</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewRaw(!viewRaw)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors"
          >
            {viewRaw ? 'Structured View' : 'Raw Markdown'}
          </button>
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-zinc-900 hover:bg-zinc-100 transition-all shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Verdict'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {viewRaw ? (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800">
            <MarkdownRenderer content={finalMessage.content} />
          </div>
        ) : (
          <>
            {/* 1. Direct Answer Highlight */}
            {sections.directAnswer && (
              <div className="p-5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-sm mb-2">
                  <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Direct Answer</span>
                </div>
                <div className="text-zinc-900 dark:text-zinc-100 font-medium leading-relaxed">
                  <MarkdownRenderer content={sections.directAnswer} />
                </div>
              </div>
            )}

            {/* 2. Key Reasoning */}
            {sections.keyReasoning && (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs tracking-wide uppercase mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Key Reasoning & Proof</span>
                </div>
                <MarkdownRenderer content={sections.keyReasoning} />
              </div>
            )}

            {/* 3. Grid: Points of Agreement & Disagreements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.pointsOfAgreement && (
                <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
                  <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-semibold text-xs tracking-wide uppercase mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Points of Agreement</span>
                  </div>
                  <MarkdownRenderer content={sections.pointsOfAgreement} />
                </div>
              )}

              {sections.importantDisagreements && (
                <div className="p-4 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-semibold text-xs tracking-wide uppercase mb-2">
                    <GitCompare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Key Trade-Offs & Disagreements</span>
                  </div>
                  <MarkdownRenderer content={sections.importantDisagreements} />
                </div>
              )}
            </div>

            {/* 4. Best Conclusion & Practical Recommendation */}
            {(sections.bestConclusion || sections.practicalRecommendation) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.bestConclusion && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs tracking-wide uppercase mb-2">
                      <Award className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Best Conclusion</span>
                    </div>
                    <MarkdownRenderer content={sections.bestConclusion} />
                  </div>
                )}

                {sections.practicalRecommendation && (
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold text-xs tracking-wide uppercase mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Practical Action Steps</span>
                    </div>
                    <MarkdownRenderer content={sections.practicalRecommendation} />
                  </div>
                )}
              </div>
            )}

            {/* 5. Remaining Uncertainty */}
            {sections.remainingUncertainty && (
              <div className="p-4 rounded-xl bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-semibold text-xs tracking-wide uppercase mb-1">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Remaining Uncertainty & Variables</span>
                </div>
                <MarkdownRenderer content={sections.remainingUncertainty} />
              </div>
            )}

            {/* Fallback if sections could not be parsed individually */}
            {!sections.directAnswer && !sections.keyReasoning && (
              <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800">
                <MarkdownRenderer content={finalMessage.content} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
