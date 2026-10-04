import React, { useEffect, useState } from 'react';
import {
  History as HistoryIcon,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  ArrowRight,
  PlusCircle,
  Brain,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { Discussion, UserProfile } from '@/types';
import { discussionService } from '@/services/discussions/discussionService';

interface HistoryProps {
  user: UserProfile;
  onOpenDiscussion: (id: string) => void;
  onNavigateNew: () => void;
}

export const HistoryView: React.FC<HistoryProps> = ({
  user,
  onOpenDiscussion,
  onNavigateNew,
}) => {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this discussion from history?')) {
      await discussionService.deleteDiscussion(id);
      setDiscussions(discussions.filter((d) => d.id !== id));
    }
  };

  const filtered = discussions.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.question.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Discussion History
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Review past multi-AI deliberations and final synthesized verdicts.
          </p>
        </div>

        <button
          onClick={onNavigateNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs transition-all shadow-xs"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Discussion</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or topics..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="running">In Progress</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-500">
          Loading history...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl space-y-2">
          <HistoryIcon className="w-8 h-8 text-zinc-400 mx-auto" />
          <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
            No discussions found
          </h3>
          <p className="text-[11px] text-zinc-500">
            {search ? 'Try adjusting your search criteria.' : 'Start your first multi-AI debate to build history.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
          {filtered.map((d) => (
            <div
              key={d.id}
              onClick={() => onOpenDiscussion(d.id)}
              className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                    {d.title || d.question}
                  </h3>
                  {d.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Completed
                    </span>
                  )}
                  {d.status === 'cancelled' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                      Cancelled
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                  {d.question}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-1">
                  <span>{new Date(d.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span>•</span>
                  <span>{d.rounds} Rounds</span>
                  <span>•</span>
                  <span>Moderator: {d.moderator.toUpperCase()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => handleDelete(e, d.id)}
                  title="Delete discussion"
                  className="p-2 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
