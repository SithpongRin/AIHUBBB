import React, { useState } from 'react';
import {
  BrainCircuit,
  Brain,
  Sparkles,
  ShieldCheck,
  Paperclip,
  X,
  AlertCircle,
  HelpCircle,
  Play,
  FileText,
  Info,
  Sliders,
  Check,
} from 'lucide-react';
import { DiscussionFile, ProviderId, UserProfile } from '@/types';
import { discussionService } from '@/services/discussions/discussionService';
import { fileService } from '@/services/files/fileService';
import { providerKeyStore } from '@/services/providers/keyStore';

interface NewDiscussionProps {
  user: UserProfile;
  onDiscussionCreated: (discussionId: string) => void;
  onNavigateToSettings: () => void;
}

export const NewDiscussion: React.FC<NewDiscussionProps> = ({
  user,
  onDiscussionCreated,
  onNavigateToSettings,
}) => {
  const [question, setQuestion] = useState('');
  const [participants, setParticipants] = useState<ProviderId[]>(['openai', 'gemini', 'claude']);
  const [rounds, setRounds] = useState<number>(3);
  const [moderator, setModerator] = useState<ProviderId>('openai');
  const [attachedFiles, setAttachedFiles] = useState<DiscussionFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Check key availability
  const hasKey = {
    openai: Boolean(providerKeyStore.getKey('openai')),
    gemini: Boolean(providerKeyStore.getKey('gemini')),
    claude: Boolean(providerKeyStore.getKey('claude')),
  };

  const hasAnyKey = hasKey.openai || hasKey.gemini || hasKey.claude;

  const toggleParticipant = (p: ProviderId) => {
    if (participants.includes(p)) {
      if (participants.length <= 1) {
        setError('At least one AI model is required, but multi-AI debate requires 2 or more.');
        return;
      }
      setParticipants(participants.filter((item) => item !== p));
    } else {
      setParticipants([...participants, p]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachedFiles.length + files.length > 5) {
      setError('You can attach a maximum of 5 files per discussion.');
      return;
    }

    setUploadingFile(true);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const record = await fileService.uploadFile(user.id, file);
        setAttachedFiles((prev) => [...prev, record]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(attachedFiles.filter((f) => f.id !== id));
  };

  const handleStart = async () => {
    const trimmed = question.trim();
    if (!trimmed) {
      setError('Please enter a question or problem to begin.');
      return;
    }

    if (participants.length < 2) {
      setError('AI-to-AI deliberation requires at least 2 AI participants.');
      return;
    }

    const missingKeys = participants.filter((p) => !hasKey[p as 'openai' | 'gemini' | 'claude']);
    if (missingKeys.length > 0) {
      setError(
        `Missing API key for: ${missingKeys.map((k) => k.toUpperCase()).join(', ')}. Please configure your provider key in Settings.`
      );
      return;
    }

    setStarting(true);
    setError(null);

    try {
      // Generate clean title from first sentence
      const title = trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed;

      const newDisc = await discussionService.createDiscussion({
        userId: user.id,
        title,
        question: trimmed,
        participants,
        rounds,
        moderator,
      });

      onDiscussionCreated(newDisc.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to launch discussion');
      setStarting(false);
    }
  };

  const sampleQuestions = [
    'Should we use Supabase or Firebase for a real-time collaborative mobile application?',
    'Evaluate the trade-offs between microservices vs modular monolith for an early-stage fintech platform.',
    'What is the optimal caching architecture for read-heavy distributed APIs with volatile consistency constraints?',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          New Multi-AI Discussion
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Assemble multiple AI models to cross-examine and synthesize solutions to your question.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{error}</span>
            {error.includes('Missing API key') && (
              <button
                onClick={onNavigateToSettings}
                className="ml-2 font-semibold underline hover:text-rose-900 dark:hover:text-white"
              >
                Go to Settings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="space-y-6">
        {/* 1. Question Input */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            What should the AI team analyze or debate?
          </label>
          <div className="relative">
            <textarea
              rows={4}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter your question, architecture dilemma, technical comparison, or problem..."
              className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
          </div>

          {/* Quick inspiration prompts */}
          <div className="pt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400">Try asking:</span>
            {sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setQuestion(q)}
                className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 transition-colors"
              >
                {q.slice(0, 35)}...
              </button>
            ))}
          </div>
        </div>

        {/* 2. File Attachments (Optional) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-zinc-400" />
              <span>Reference Documents (Untrusted Input)</span>
            </label>
            <span className="text-xs text-zinc-400">PDF, TXT, MD, CSV, DOCX (Max 5MB)</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors">
              <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
              <span>{uploadingFile ? 'Extracting text...' : 'Attach Document'}</span>
              <input
                type="file"
                multiple
                accept=".pdf,.txt,.md,.csv,.docx,.json"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="hidden"
              />
            </label>
          </div>

          {/* Attached Files List */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {attachedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-medium truncate max-w-[180px]">{file.file_name}</span>
                  <span className="text-[10px] text-zinc-400">({Math.round(file.file_size / 1024)} KB)</span>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="text-zinc-400 hover:text-rose-500 p-0.5 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. AI Participants Selection */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              AI Participants (Select 2 or more)
            </label>
            <span className="text-xs text-zinc-400">
              {participants.length} selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* OpenAI Card */}
            <div
              onClick={() => toggleParticipant('openai')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                participants.includes('openai')
                  ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-xs'
                  : 'border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">OpenAI</span>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  participants.includes('openai') ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-400'
                }`}>
                  {participants.includes('openai') && <Check className="w-3 h-3" />}
                </div>
              </div>
              <div className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Lead Analyst
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
                Initial structure, assumption breakdown, and foundational solution.
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
                <span className="font-mono">{providerKeyStore.getModel('openai')}</span>
                <span>{hasKey.openai ? 'Key Ready' : 'Key Needed'}</span>
              </div>
            </div>

            {/* Gemini Card */}
            <div
              onClick={() => toggleParticipant('gemini')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                participants.includes('gemini')
                  ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-xs'
                  : 'border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">Gemini</span>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  participants.includes('gemini') ? 'bg-blue-500 border-blue-500 text-white' : 'border-zinc-400'
                }`}>
                  {participants.includes('gemini') && <Check className="w-3 h-3" />}
                </div>
              </div>
              <div className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-400">
                Alternative Analyst
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
                Alternative paradigms, challenges assumptions, uncovers blind spots.
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
                <span className="font-mono">{providerKeyStore.getModel('gemini')}</span>
                <span>{hasKey.gemini ? 'Key Ready' : 'Key Needed'}</span>
              </div>
            </div>

            {/* Claude Card */}
            <div
              onClick={() => toggleParticipant('claude')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                participants.includes('claude')
                  ? 'border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs'
                  : 'border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span className="font-bold text-sm text-zinc-900 dark:text-white">Claude</span>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  participants.includes('claude') ? 'bg-amber-500 border-amber-500 text-white' : 'border-zinc-400'
                }`}>
                  {participants.includes('claude') && <Check className="w-3 h-3" />}
                </div>
              </div>
              <div className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                Critical Reviewer
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">
                Stress-tests logic, catches edge cases, exposes operational vulnerabilities.
              </div>
              <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between">
                <span className="font-mono">{providerKeyStore.getModel('claude')}</span>
                <span>{hasKey.claude ? 'Key Ready' : 'Key Needed'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Rounds & Moderator Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Rounds */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Discussion Depth (Rounds)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { r: 1, label: '1 Round', sub: 'Independent' },
                { r: 2, label: '2 Rounds', sub: '+ Cross Review' },
                { r: 3, label: '3 Rounds', sub: '+ Debate' },
              ].map((item) => (
                <button
                  key={item.r}
                  type="button"
                  onClick={() => setRounds(item.r)}
                  className={`py-2 px-2 rounded-lg text-center border transition-all ${
                    rounds === item.r
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 border-transparent font-semibold shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="text-xs">{item.label}</div>
                  <div className="text-[10px] text-zinc-400 font-normal">{item.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Moderator */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Final Synthesis Moderator
            </label>
            <select
              value={moderator}
              onChange={(e) => setModerator(e.target.value as ProviderId)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="openai">OpenAI (Synthesizes comprehensive consensus)</option>
              <option value="gemini">Gemini (Synthesizes broad-spectrum consensus)</option>
              <option value="claude">Claude (Synthesizes risk-weighted consensus)</option>
            </select>
            <p className="text-[11px] text-zinc-400">
              The moderator analyzes all arguments and writes the authoritative verdict.
            </p>
          </div>
        </div>

        {/* 5. Cost & API Request Transparency */}
        <div className="p-4 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              Requests are sent directly to your configured provider accounts using your BYOK keys.
            </span>
          </div>

          <div className="text-[11px] text-zinc-400 sm:text-right shrink-0">
            <span>Estimated API calls: </span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              {participants.length * rounds + 1} requests
            </span>
          </div>
        </div>

        {/* 6. Start Button */}
        <div className="pt-4 flex items-center justify-between gap-4">
          <div className="text-xs text-zinc-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>AI responses are cross-reviewed automatically in parallel</span>
          </div>

          <button
            onClick={handleStart}
            disabled={starting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{starting ? 'Launching Engine...' : 'Start Discussion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
