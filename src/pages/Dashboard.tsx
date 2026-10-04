import React, { useEffect, useState } from 'react';
import {
  PlusCircle,
  MessageSquare,
  CheckCircle2,
  Clock,
  ArrowRight,
  Brain,
  Sparkles,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Discussion, UserProfile } from '@/types';
import { discussionService } from '@/services/discussions/discussionService';
import { providerKeyStore } from '@/services/providers/keyStore';

interface DashboardProps {
  user: UserProfile;
  onNavigate: (tab: string, discussionId?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onNavigate }) => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    discussionService.getDiscussions(user.id).then((data: Discussion[]) => {
      if (mounted) {
        setDiscussions(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [user.id]);

  const totalCount = discussions.length;
  const completedCount = discussions.filter((d) => d.status === 'completed').length;
  const hasKeys = providerKeyStore.hasAnyKey();

  const recentDiscussions = discussions.slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Completed</span>
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-pulse">
            <Clock className="w-3 h-3 text-indigo-500" />
            <span>In Discussion</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Header & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Welcome back, {user.full_name || 'Collaborator'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            AIHUB multi-AI deliberation workspace
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('new-discussion')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-semibold text-sm transition-all shadow-sm group"
          >
            <PlusCircle className="w-4 h-4 text-indigo-400 dark:text-indigo-600 transition-transform group-hover:rotate-90 duration-300" />
            <span>New Discussion</span>
          </button>
        </div>
      </div>

      {/* BYOK Warning if no keys configured */}
      {!hasKeys && (
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-semibold text-amber-900 dark:text-amber-200">
                AI API Keys Not Configured Yet
              </span>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                AIHUB uses a Bring Your Own Key (BYOK) architecture. Configure your OpenAI, Gemini, or Claude keys in Settings, or use the Simulated Mode.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors shrink-0"
          >
            Configure Keys
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Total Discussions</span>
            <MessageSquare className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-white">
            {totalCount}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            Recorded in your workspace
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Completed Deliberations</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-white">
            {completedCount}
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            Synthesized across models
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Active AI Providers</span>
            <div className="flex items-center -space-x-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 inline-block" />
              <span className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-500/40 inline-block" />
              <span className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 inline-block" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-white">
            3 Models
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            OpenAI, Gemini & Claude
          </div>
        </div>
      </div>

      {/* Recent Discussions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            Recent Discussions
          </h2>
          {totalCount > 5 && (
            <button
              onClick={() => onNavigate('history')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500">
            Loading your discussions...
          </div>
        ) : recentDiscussions.length === 0 ? (
          <div className="p-12 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              No discussions yet
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Ask one question, and watch OpenAI, Gemini, and Claude automatically debate and synthesize a stronger conclusion.
            </p>
            <button
              onClick={() => onNavigate('new-discussion')}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs hover:bg-zinc-800 transition-colors shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400 dark:text-indigo-600" />
              <span>Start First Discussion</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
            {recentDiscussions.map((d) => (
              <div
                key={d.id}
                onClick={() => onNavigate('discussion', d.id)}
                className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {d.title || d.question}
                    </h3>
                    {getStatusBadge(d.status)}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                    {d.question}
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-zinc-400 pt-1">
                    <span>{new Date(d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    <span>•</span>
                    <span>{d.rounds} Rounds</span>
                    <span>•</span>
                    <span className="capitalize">{d.participants.length} AI Participants</span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
