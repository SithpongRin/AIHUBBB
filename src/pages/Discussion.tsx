import React, { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  StopCircle,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText,
  Share2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Discussion, DiscussionFile, DiscussionMessage, DiscussionStatus } from '@/types';
import { discussionService } from '@/services/discussions/discussionService';
import { DiscussionOrchestrator } from '@/services/orchestrator/discussionOrchestrator';
import { ResponseCard } from '@/components/discussion/ResponseCard';
import { FinalSynthesisCard } from '@/components/discussion/FinalSynthesisCard';

interface DiscussionProps {
  discussionId: string;
  onNavigateNew: () => void;
}

export const DiscussionView: React.FC<DiscussionProps> = ({
  discussionId,
  onNavigateNew,
}) => {
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [status, setStatus] = useState<DiscussionStatus>('pending');
  const [activeTabRound, setActiveTabRound] = useState<number | 'all'>('all');
  const [showQuestionFull, setShowQuestionFull] = useState(false);

  const orchestratorRef = useRef<DiscussionOrchestrator | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    discussionService.getDiscussionById(discussionId).then((data: Discussion | null) => {
      if (!mounted || !data) return;

      setDiscussion(data);
      setStatus(data.status);
      setMessages(data.messages || []);

      // If discussion was already completed or running, handle accordingly
      if (data.status === 'pending' && !hasStartedRef.current) {
        hasStartedRef.current = true;
        startOrchestration(data);
      }
    });

    return () => {
      mounted = false;
      if (orchestratorRef.current) {
        orchestratorRef.current.stop();
      }
    };
  }, [discussionId]);

  const startOrchestration = (disc: Discussion) => {
    const orchestrator = new DiscussionOrchestrator();
    orchestratorRef.current = orchestrator;

    orchestrator.run({
      discussionId: disc.id,
      question: disc.question,
      participants: disc.participants,
      rounds: disc.rounds,
      moderator: disc.moderator,
      files: disc.files,
      onMessageUpdate: (updatedMsg: DiscussionMessage) => {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === updatedMsg.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = updatedMsg;
            return next;
          }
          return [...prev, updatedMsg];
        });
        discussionService.saveMessage(updatedMsg);
      },
      onStatusChange: (newStatus: DiscussionStatus) => {
        setStatus(newStatus);
        discussionService.updateDiscussionStatus(disc.id, newStatus);
      },
    });
  };

  const handleStop = () => {
    if (orchestratorRef.current) {
      orchestratorRef.current.stop();
      setStatus('cancelled');
      discussionService.updateDiscussionStatus(discussionId, 'cancelled');
    }
  };

  if (!discussion) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-zinc-500">
        Loading discussion workspace...
      </div>
    );
  }

  // Filter messages by round
  const r1Messages = messages.filter((m) => m.round_number === 1 && m.role === 'analysis');
  const r2Messages = messages.filter((m) => m.round_number === 2 && m.role === 'review');
  const r3Messages = messages.filter((m) => m.round_number === 3 && m.role === 'debate');
  const finalMessage = messages.find((m) => m.role === 'final');

  const getStatusDisplay = () => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping" />
            <span>Discussion in Progress</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Consensus Reached</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <span>Stopped by User</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Deliberation Interrupted</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            {getStatusDisplay()}
            <span className="text-xs text-zinc-400">
              {discussion.rounds} Rounds • {discussion.participants.length} AI Models
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white truncate">
            {discussion.title || discussion.question}
          </h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {status === 'running' && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition-colors"
            >
              <StopCircle className="w-4 h-4 text-rose-500" />
              <span>Stop Discussion</span>
            </button>
          )}

          <button
            onClick={onNavigateNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 text-xs font-semibold transition-all shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Discussion</span>
          </button>
        </div>
      </div>

      {/* Collapsible Question Box */}
      <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          <span>Question Under Deliberation</span>
          <button
            onClick={() => setShowQuestionFull(!showQuestionFull)}
            className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium lowercase tracking-normal text-xs"
          >
            <span>{showQuestionFull ? 'collapse' : 'expand'}</span>
            {showQuestionFull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className={`text-sm text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed ${
          showQuestionFull ? '' : 'line-clamp-2'
        }`}>
          {discussion.question}
        </p>

        {discussion.files && discussion.files.length > 0 && (
          <div className="pt-2 flex flex-wrap gap-2 text-xs border-t border-zinc-200/60 dark:border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">Attached files:</span>
            {discussion.files.map((f: DiscussionFile) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px]"
              >
                <FileText className="w-3 h-3 text-indigo-500" />
                <span>{f.file_name}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Round Filtering Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTabRound('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTabRound === 'all'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          All Rounds & Verdict
        </button>

        <button
          onClick={() => setActiveTabRound(1)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTabRound === 1
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          Round 1: Independent Analysis ({r1Messages.length})
        </button>

        {discussion.rounds >= 2 && (
          <button
            onClick={() => setActiveTabRound(2)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTabRound === 2
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Round 2: Cross Review ({r2Messages.length})
          </button>
        )}

        {discussion.rounds >= 3 && (
          <button
            onClick={() => setActiveTabRound(3)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTabRound === 3
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Round 3: Final Debate ({r3Messages.length})
          </button>
        )}
      </div>

      {/* Main Deliberation Stream */}
      <div className="space-y-12">
        {/* ================= ROUND 1 ================= */}
        {(activeTabRound === 'all' || activeTabRound === 1) && (
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Round 1 — Independent Analysis
                </h2>
              </div>
              <span className="text-xs text-zinc-400">
                Models assess the problem independently with zero cross-contamination
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {r1Messages.map((msg) => (
                <ResponseCard key={msg.id} message={msg} roundTitle="Independent Analysis" />
              ))}
            </div>
          </section>
        )}

        {/* ================= ROUND 2 ================= */}
        {discussion.rounds >= 2 && (activeTabRound === 'all' || activeTabRound === 2) && (
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Round 2 — Cross Review & Critique
                </h2>
              </div>
              <span className="text-xs text-zinc-400">
                Models critique each other&apos;s initial positions and spot omissions
              </span>
            </div>

            {r2Messages.length === 0 && status === 'running' ? (
              <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-400">
                Awaiting completion of Round 1 before initiating cross-review...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {r2Messages.map((msg) => (
                  <ResponseCard key={msg.id} message={msg} roundTitle="Cross Review" />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================= ROUND 3 ================= */}
        {discussion.rounds >= 3 && (activeTabRound === 'all' || activeTabRound === 3) && (
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Round 3 — Final Debate & Hardening
                </h2>
              </div>
              <span className="text-xs text-zinc-400">
                Definitive stances, risk boundaries, and core trade-offs
              </span>
            </div>

            {r3Messages.length === 0 && status === 'running' ? (
              <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-400">
                Awaiting previous rounds to conclude before opening final debate...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {r3Messages.map((msg) => (
                  <ResponseCard key={msg.id} message={msg} roundTitle="Final Debate" />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================= FINAL SYNTHESIS ================= */}
        {activeTabRound === 'all' && (
          <section className="space-y-4 pt-4">
            {finalMessage && finalMessage.status === 'completed' && (
              <FinalSynthesisCard
                finalMessage={finalMessage}
                moderatorProvider={discussion.moderator}
              />
            )}

            {finalMessage && finalMessage.status === 'thinking' && (
              <div className="p-10 rounded-2xl border-2 border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/20 text-center space-y-3">
                <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  Moderator is Synthesizing Deliberation
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Extracting consensus points, resolving disputed trade-offs, and preparing the definitive verdict...
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
