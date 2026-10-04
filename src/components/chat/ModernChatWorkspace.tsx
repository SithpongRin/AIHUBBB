import React, { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  Plus,
  Send,
  Square,
  Paperclip,
  X,
  Search,
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Brain,
  FileText,
  AlertCircle,
  Download,
  Share2,
  Sliders,
  ChevronDown,
  Layers,
  ArrowUp,
  MessageSquare,
  Trash2,
  AtSign,
  Info,
} from 'lucide-react';

const MENTION_OPTIONS = [
  {
    id: 'all',
    tag: '@all',
    name: 'AI Council (All Models)',
    role: 'Multi-AI Deliberation',
    icon: BrainCircuit,
    color: 'text-indigo-600 dark:text-indigo-400',
    description: 'Runs structured multi-round debate across OpenAI, Gemini & Claude to synthesize consensus.',
    strengths: ['Multi-perspective synthesis', 'Eliminates model bias', 'Finds optimal trade-offs'],
  },
  {
    id: 'openai',
    tag: '@openai',
    name: 'OpenAI (GPT-4o)',
    role: 'Lead Architect & Logic',
    icon: Brain,
    color: 'text-emerald-600 dark:text-emerald-400',
    description: 'System architecture, backend logic, step-by-step reasoning, primary solutions, and balanced moderation.',
    strengths: ['Architecture design', 'Structured reasoning', 'Algorithmic logic'],
  },
  {
    id: 'gemini',
    tag: '@gemini',
    name: 'Google Gemini 1.5 Pro',
    role: 'Alternative Perspectives & Context',
    icon: Sparkles,
    color: 'text-blue-600 dark:text-blue-400',
    description: 'Massive document context processing, non-obvious paradigms, challenging default assumptions, high speed.',
    strengths: ['Massive document ingestion', 'Creative alternative angles', 'Rapid processing'],
  },
  {
    id: 'claude',
    tag: '@claude',
    name: 'Anthropic Claude 3.5 Sonnet',
    role: 'Critical Reviewer & Security Auditor',
    icon: ShieldCheck,
    color: 'text-amber-600 dark:text-amber-400',
    description: 'Deep code auditing, identifying subtle edge-case failure modes, security vulnerabilities, nuanced reasoning.',
    strengths: ['Security vulnerability audits', 'Edge-case bug detection', 'High-precision prose'],
  },
];
import {
  Discussion,
  DiscussionFile,
  DiscussionMessage,
  DiscussionStatus,
  ProviderId,
  UserProfile,
} from '@/types';
import { discussionService } from '@/services/discussions/discussionService';
import { fileService } from '@/services/files/fileService';
import { providerKeyStore } from '@/services/providers/keyStore';
import { DiscussionOrchestrator } from '@/services/orchestrator/discussionOrchestrator';
import { parseFinalSynthesis } from '@/services/orchestrator/parseSynthesis';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

interface ModernChatWorkspaceProps {
  user: UserProfile;
  activeDiscussionId: string | null;
  onSelectDiscussion: (id: string | null) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

export const ModernChatWorkspace: React.FC<ModernChatWorkspaceProps> = ({
  user,
  activeDiscussionId,
  onSelectDiscussion,
  onOpenSettings,
  onSignOut,
  theme,
  onThemeChange,
}) => {
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Active conversation state
  const [currentDiscussion, setCurrentDiscussion] = useState<Discussion | null>(null);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [status, setStatus] = useState<DiscussionStatus>('pending');
  const [activeViewMode, setActiveViewMode] = useState<'verdict' | 'models' | 'rounds'>('verdict');
  const [selectedPerspective, setSelectedPerspective] = useState<ProviderId>('openai');

  // Input bar state
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<DiscussionFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [rounds, setRounds] = useState<number>(3);
  const [participants, setParticipants] = useState<ProviderId[]>(['openai', 'gemini', 'claude']);
  const [moderator, setModerator] = useState<ProviderId>('openai');
  const [showConfigPopover, setShowConfigPopover] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showCapabilitiesModal, setShowCapabilitiesModal] = useState(false);

  // UI state
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const orchestratorRef = useRef<DiscussionOrchestrator | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat feed to bottom when messages update
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, status]);

  // Load user's discussion history
  const loadHistory = async () => {
    const list = await discussionService.getDiscussions(user.id);
    setDiscussions(list);
  };

  useEffect(() => {
    loadHistory();
  }, [user.id]);

  // Load specific discussion when activeDiscussionId changes
  useEffect(() => {
    let mounted = true;

    if (!activeDiscussionId) {
      setCurrentDiscussion(null);
      setMessages([]);
      setStatus('pending');
      return;
    }

    discussionService.getDiscussionById(activeDiscussionId).then((disc) => {
      if (!mounted || !disc) return;
      setCurrentDiscussion(disc);
      setStatus(disc.status);
      setMessages(disc.messages || []);
      setRounds(disc.rounds || 3);
      setParticipants(disc.participants || ['openai', 'gemini', 'claude']);

      // If pending and newly created, kick off orchestrator
      if (disc.status === 'pending') {
        startOrchestration(disc);
      }
    });

    return () => {
      mounted = false;
      if (orchestratorRef.current) {
        orchestratorRef.current.stop();
      }
    };
  }, [activeDiscussionId]);

  // Run Multi-AI Orchestrator
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
        loadHistory();
      },
    });
  };

  // Stop deliberation
  const handleStop = () => {
    if (orchestratorRef.current) {
      orchestratorRef.current.stop();
      setStatus('cancelled');
      if (currentDiscussion) {
        discussionService.updateDiscussionStatus(currentDiscussion.id, 'cancelled');
      }
    }
  };

  // Submit Prompt from Input Box
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputPrompt).trim();
    if (!textToSend || status === 'running') return;

    setErrorMsg(null);
    setShowMentionMenu(false);

    // Dynamic mention detection
    let effectiveParticipants = participants;
    let effectiveRounds = rounds;

    if (textToSend.includes('@claude') && !textToSend.includes('@openai') && !textToSend.includes('@gemini') && !textToSend.includes('@all')) {
      effectiveParticipants = ['claude'];
      effectiveRounds = 1;
    } else if (textToSend.includes('@openai') && !textToSend.includes('@claude') && !textToSend.includes('@gemini') && !textToSend.includes('@all')) {
      effectiveParticipants = ['openai'];
      effectiveRounds = 1;
    } else if (textToSend.includes('@gemini') && !textToSend.includes('@claude') && !textToSend.includes('@openai') && !textToSend.includes('@all')) {
      effectiveParticipants = ['gemini'];
      effectiveRounds = 1;
    } else if (textToSend.includes('@all')) {
      effectiveParticipants = ['openai', 'gemini', 'claude'];
      effectiveRounds = Math.max(rounds, 2);
    }

    // If starting a fresh discussion
    if (!currentDiscussion) {
      const title = textToSend.slice(0, 48) + (textToSend.length > 48 ? '...' : '');

      try {
        const newDisc = await discussionService.createDiscussion({
          userId: user.id,
          title,
          question: textToSend,
          participants: effectiveParticipants,
          rounds: effectiveRounds,
          moderator,
        });

        // Link attached files
        if (attachedFiles.length > 0) {
          for (const f of attachedFiles) {
            await fileService.linkFileToDiscussion(f.id, newDisc.id);
          }
          newDisc.files = [...attachedFiles];
        }

        setInputPrompt('');
        setAttachedFiles([]);
        onSelectDiscussion(newDisc.id);
        setCurrentDiscussion(newDisc);
        setStatus('running');
        setMessages([]);
        await loadHistory();
        startOrchestration(newDisc);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to start deliberation';
        setErrorMsg(msg);
      }
    } else {
      // Follow-up question in existing discussion
      const followUpPrompt = `${currentDiscussion.question}\n\n---\n**Follow-up Question from User:**\n${textToSend}`;
      setInputPrompt('');
      setStatus('running');

      const updatedDisc: Discussion = {
        ...currentDiscussion,
        question: followUpPrompt,
        participants: effectiveParticipants,
        status: 'running',
        rounds: Math.min(effectiveRounds, 2), // Efficient follow-up round
      };

      setCurrentDiscussion(updatedDisc);
      startOrchestration(updatedDisc);
    }
  };

  // Handle Enter key for submit (Shift+Enter for newline)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionMenu && (e.key === 'Escape')) {
      setShowMentionMenu(false);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      if (showMentionMenu) {
        // do not submit if mention menu is active
        return;
      }
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-resize textarea & detect @ mention typing
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputPrompt(val);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }

    // Check for @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);
    if (match) {
      setShowMentionMenu(true);
      setMentionFilter(match[1].toLowerCase());
    } else {
      setShowMentionMenu(false);
    }
  };

  // Insert mention into input
  const handleSelectMention = (tag: string) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = inputPrompt.slice(0, cursorPos);
    const textAfterCursor = inputPrompt.slice(cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1) {
      const newText = textBeforeCursor.slice(0, atIndex) + tag + ' ' + textAfterCursor;
      setInputPrompt(newText);
      setShowMentionMenu(false);

      if (tag === '@openai') {
        setParticipants(['openai']);
        setRounds(1);
      } else if (tag === '@gemini') {
        setParticipants(['gemini']);
        setRounds(1);
      } else if (tag === '@claude') {
        setParticipants(['claude']);
        setRounds(1);
      } else if (tag === '@all') {
        setParticipants(['openai', 'gemini', 'claude']);
        setRounds(3);
      }

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = atIndex + tag.length + 1;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 50);
    }
  };

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachedFiles.length + files.length > 5) {
      setErrorMsg('You can attach up to 5 files per deliberation.');
      return;
    }

    setUploadingFile(true);
    setErrorMsg(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const uploaded = await fileService.uploadFile(user.id, files[i]);
        setAttachedFiles((prev) => [...prev, uploaded]);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Delete discussion from history
  const handleDeleteDiscussion = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await discussionService.deleteDiscussion(id);
    if (activeDiscussionId === id) {
      onSelectDiscussion(null);
    }
    loadHistory();
  };

  // Copy consensus answer
  const handleCopyVerdict = () => {
    const finalMsg = messages.find((m) => m.role === 'final');
    if (finalMsg?.content) {
      navigator.clipboard.writeText(finalMsg.content);
      setCopiedAnswer(true);
      setTimeout(() => setCopiedAnswer(false), 2000);
    }
  };

  // Export as Markdown file
  const handleExportMarkdown = () => {
    if (!currentDiscussion) return;
    const finalMsg = messages.find((m) => m.role === 'final');
    const mdContent = `# ${currentDiscussion.title}\n\n**Question:**\n${currentDiscussion.question}\n\n---\n\n## Final AI Consensus Verdict\n\n${finalMsg?.content || 'In deliberation...'}`;
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDiscussion.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter history by search
  const filteredDiscussions = discussions.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.question.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group discussions by date
  const todayDiscussions: Discussion[] = [];
  const yesterdayDiscussions: Discussion[] = [];
  const olderDiscussions: Discussion[] = [];

  const now = new Date();
  filteredDiscussions.forEach((disc) => {
    const dDate = new Date(disc.created_at);
    const diffDays = Math.floor((now.getTime() - dDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays === 0) todayDiscussions.push(disc);
    else if (diffDays === 1) yesterdayDiscussions.push(disc);
    else olderDiscussions.push(disc);
  });

  const finalMessage = messages.find((m) => m.role === 'final');
  const r1Messages = messages.filter((m) => m.round_number === 1 && m.role === 'analysis');
  const r2Messages = messages.filter((m) => m.round_number === 2 && m.role === 'review');
  const r3Messages = messages.filter((m) => m.round_number === 3 && m.role === 'debate');

  // Starter Prompts for Welcome Screen
  const starterPrompts = [
    {
      title: 'Council Deliberation (@all)',
      desc: 'All 3 models debate Next.js App Router vs Vite SPA for high-scale SaaS',
      prompt: '@all Compare Next.js App Router vs Vite SPA for building a high-scale production SaaS dashboard. Weigh performance, DX, caching complexity, and hosting costs.',
    },
    {
      title: 'Security Audit (@claude)',
      desc: 'Direct Claude to review authentication security & edge-case vulnerabilities',
      prompt: '@claude Audit this architectural pattern: PostgreSQL Row Level Security (RLS) vs Application-layer authorization. Where are the subtle security risks?',
    },
    {
      title: 'System Design (@openai)',
      desc: 'Direct OpenAI to build step-by-step scalable system architecture',
      prompt: '@openai Design a step-by-step scalable database and caching strategy for a multi-tenant application handling 100k daily active users.',
    },
    {
      title: 'Alternative Angles (@gemini)',
      desc: 'Direct Gemini to analyze non-obvious approaches and massive context',
      prompt: '@gemini Explore non-obvious alternative architectures for real-time data synchronization. What unconventional approaches exist beyond standard WebSockets?',
    },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR (ChatGPT / Claude Style) */}
      {/* ========================================================================= */}
      <aside
        className={`${
          sidebarOpen ? 'w-72 sm:w-80' : 'w-0'
        } transition-all duration-300 ease-in-out shrink-0 border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 flex flex-col h-full overflow-hidden relative z-30`}
      >
        {/* Sidebar Header: App Title & New Chat */}
        <div className="p-3.5 space-y-3 border-b border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-xs">
                <BrainCircuit className="w-4 h-4 text-indigo-400 dark:text-indigo-600" />
              </div>
              <div>
                <span className="font-extrabold text-sm tracking-tight text-zinc-900 dark:text-white">
                  AIHUB
                </span>
                <span className="block text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                  Council Chat
                </span>
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* "+ New Chat" Button */}
          <button
            onClick={() => onSelectDiscussion(null)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold shadow-xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400 transition-transform group-hover:scale-110" />
              <span>New Deliberation</span>
            </div>
            <span className="text-[10px] text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5">
              Ctrl+N
            </span>
          </button>

          {/* Search history input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-200/50 dark:bg-zinc-800/50 border border-transparent focus:border-zinc-300 dark:focus:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
            />
          </div>
        </div>

        {/* Discussion History Feed */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs">
          {discussions.length === 0 ? (
            <div className="p-4 text-center text-zinc-400">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="font-medium text-xs">No conversations yet</p>
              <p className="text-[11px] text-zinc-500 mt-1">Start your first multi-AI debate</p>
            </div>
          ) : (
            <>
              {/* Today */}
              {todayDiscussions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    Today
                  </div>
                  {todayDiscussions.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => onSelectDiscussion(d.id)}
                      className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                        activeDiscussionId === d.id
                          ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <span className="truncate pr-2">{d.title || d.question}</span>
                      <button
                        onClick={(e) => handleDeleteDiscussion(e, d.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))}
                </div>
              )}

              {/* Yesterday */}
              {yesterdayDiscussions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    Yesterday
                  </div>
                  {yesterdayDiscussions.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => onSelectDiscussion(d.id)}
                      className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                        activeDiscussionId === d.id
                          ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <span className="truncate pr-2">{d.title || d.question}</span>
                      <button
                        onClick={(e) => handleDeleteDiscussion(e, d.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))}
                </div>
              )}

              {/* Older */}
              {olderDiscussions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                    Previous
                  </div>
                  {olderDiscussions.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => onSelectDiscussion(d.id)}
                      className={`w-full group flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                        activeDiscussionId === d.id
                          ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-950 dark:text-white font-medium'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <span className="truncate pr-2">{d.title || d.question}</span>
                      <button
                        onClick={(e) => handleDeleteDiscussion(e, d.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Footer: Profile & Settings */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                {user.email.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                {user.full_name || user.email.split('@')[0]}
              </div>
              <div className="text-[10px] text-zinc-500 truncate">{user.email}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800"
              title="Settings & API Keys"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onSignOut}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CHAT WORKSPACE */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative bg-white dark:bg-zinc-950">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-zinc-200 dark:border-zinc-800/80 px-4 flex items-center justify-between shrink-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md z-20">
          <div className="flex items-center gap-3 min-w-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                title="Open sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {currentDiscussion ? currentDiscussion.title : 'AIHUB Multi-AI Council'}
              </span>
              {currentDiscussion && (
                <span className="hidden sm:inline-flex text-[11px] text-zinc-400">
                  • {currentDiscussion.rounds} Rounds
                </span>
              )}
            </div>
          </div>

          {/* Right Header: Models Indicator & Controls */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px]">
              <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300">
                <Brain className="w-3 h-3 text-emerald-600" />
                <span>OpenAI</span>
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">+</span>
              <span className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-300">
                <Sparkles className="w-3 h-3 text-blue-600" />
                <span>Gemini</span>
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">+</span>
              <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span>Claude</span>
              </span>
            </div>

            {currentDiscussion && (
              <>
                <button
                  onClick={handleExportMarkdown}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs flex items-center gap-1.5"
                  title="Export markdown"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setShowShareToast(true);
                    setTimeout(() => setShowShareToast(false), 2000);
                  }}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs flex items-center gap-1.5"
                  title="Share link"
                >
                  {showShareToast ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{showShareToast ? 'Copied' : 'Share'}</span>
                </button>
              </>
            )}

            <button
              onClick={() => setShowCapabilitiesModal(true)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs flex items-center gap-1.5"
              title="View Council Roles & Capabilities"
            >
              <AtSign className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Roles</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Configure API keys"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Error notification banner if any */}
        {errorMsg && (
          <div className="bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-900/50 px-4 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="p-1 hover:text-rose-950">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. CONVERSATION FEED */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          <div className="max-w-4xl mx-auto w-full space-y-8">
            {/* Case A: Welcome State (When No Active Discussion) */}
            {!currentDiscussion ? (
              <div className="py-12 sm:py-20 flex flex-col items-center justify-center text-center space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-xl">
                    <BrainCircuit className="w-8 h-8 text-indigo-400 dark:text-indigo-600" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-950 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>

                <div className="space-y-2 max-w-xl">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                    What would you like the AI Council to deliberate?
                  </h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Ask any complex question. OpenAI, Gemini, and Claude will independently analyze,
                    critique each other, and forge a definitive synthesized verdict.
                  </p>
                </div>

                {/* 4 Prompt Starter Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left pt-4">
                  {starterPrompts.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputPrompt(item.prompt);
                        textareaRef.current?.focus();
                      }}
                      className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-white dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-left group shadow-2xs cursor-pointer"
                    >
                      <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1 line-clamp-2">
                        {item.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Case B: Active Conversation Feed */
              <div className="space-y-8">
                {/* 1. User Message (ChatGPT/Claude User Prompt Bubble) */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-3xl rounded-tr-xs bg-zinc-900 text-white dark:bg-zinc-800 p-4 sm:p-5 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-zinc-800 dark:border-zinc-700/60 pb-2 mb-1">
                      <span className="font-semibold text-zinc-200">You</span>
                      <span>{new Date(currentDiscussion.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <p className="text-sm font-normal leading-relaxed whitespace-pre-wrap selection:bg-indigo-500 selection:text-white">
                      {currentDiscussion.question}
                    </p>

                    {/* Attached files preview in message */}
                    {currentDiscussion.files && currentDiscussion.files.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1.5 border-t border-zinc-800/80 dark:border-zinc-700/60">
                        {currentDiscussion.files.map((f: DiscussionFile) => (
                          <span
                            key={f.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 dark:bg-zinc-700 text-zinc-200 text-xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="truncate max-w-[160px]">{f.file_name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. AI Multi-Council Response Container */}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-9 h-9 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shrink-0 shadow-md">
                    <BrainCircuit className="w-5 h-5 text-indigo-400 dark:text-indigo-600" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-4">
                    {/* Council Deliberation Header Bar */}
                    <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                          AI Council Deliberation
                        </span>
                        {status === 'running' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping" />
                            <span>Deliberating...</span>
                          </span>
                        )}
                        {status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Consensus Reached</span>
                          </span>
                        )}
                        {status === 'cancelled' && (
                          <span className="text-[11px] text-zinc-400 font-medium">Stopped</span>
                        )}
                      </div>

                      {/* Mode Switcher Tabs (Consensus vs Model Perspectives vs Rounds) */}
                      <div className="flex items-center gap-1 p-0.5 rounded-xl bg-zinc-200/60 dark:bg-zinc-800 text-xs">
                        <button
                          onClick={() => setActiveViewMode('verdict')}
                          className={`px-3 py-1 rounded-lg font-medium transition-all ${
                            activeViewMode === 'verdict'
                              ? 'bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white shadow-xs font-semibold'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          Consensus
                        </button>
                        <button
                          onClick={() => setActiveViewMode('models')}
                          className={`px-3 py-1 rounded-lg font-medium transition-all ${
                            activeViewMode === 'models'
                              ? 'bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white shadow-xs font-semibold'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          Model Perspectives
                        </button>
                        <button
                          onClick={() => setActiveViewMode('rounds')}
                          className={`px-3 py-1 rounded-lg font-medium transition-all ${
                            activeViewMode === 'rounds'
                              ? 'bg-white text-zinc-900 dark:bg-zinc-700 dark:text-white shadow-xs font-semibold'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          Debate Transcript
                        </button>
                      </div>
                    </div>

                    {/* Content View 1: Final Synthesized Verdict (ChatGPT/Claude Style) */}
                    {activeViewMode === 'verdict' && (
                      <div className="p-5 sm:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
                        {status === 'running' && !finalMessage && (
                          <div className="py-12 text-center space-y-3">
                            <div className="w-10 h-10 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin mx-auto" />
                            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              OpenAI, Gemini, and Claude are actively debating your prompt...
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              Reviewing arguments across {currentDiscussion.rounds} rigorous rounds
                            </p>
                          </div>
                        )}

                        {finalMessage && (
                          <div className="space-y-4">
                            <div className="prose dark:prose-invert max-w-none text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                              <MarkdownRenderer content={finalMessage.content} />
                            </div>

                            {/* Actions toolbar at bottom of answer */}
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={handleCopyVerdict}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium transition-colors"
                                >
                                  {copiedAnswer ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{copiedAnswer ? 'Copied to clipboard' : 'Copy answer'}</span>
                                </button>
                                <button
                                  onClick={handleExportMarkdown}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium transition-colors"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Export</span>
                                </button>
                              </div>

                              {finalMessage.duration_ms ? (
                                <div className="flex items-center gap-1 text-[11px] font-mono">
                                  <Clock className="w-3 h-3 text-zinc-400" />
                                  <span>{(finalMessage.duration_ms / 1000).toFixed(1)}s total deliberation</span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content View 2: Model Perspectives (Side-by-Side/Tabs for OpenAI, Gemini, Claude) */}
                    {activeViewMode === 'models' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                          {(['openai', 'gemini', 'claude'] as ProviderId[]).map((prov) => {
                            const isSelected = selectedPerspective === prov;
                            return (
                              <button
                                key={prov}
                                onClick={() => setSelectedPerspective(prov)}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                }`}
                              >
                                {prov === 'openai' && <Brain className="w-3.5 h-3.5 text-emerald-500" />}
                                {prov === 'gemini' && <Sparkles className="w-3.5 h-3.5 text-blue-500" />}
                                {prov === 'claude' && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />}
                                <span className="capitalize">{prov}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Selected model's analysis & critiques */}
                        <div className="space-y-4">
                          {messages
                            .filter((m) => m.provider === selectedPerspective && m.role !== 'final')
                            .map((msg) => (
                              <div
                                key={msg.id}
                                className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-2xs space-y-2"
                              >
                                <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
                                  <span>Round {msg.round_number}: {msg.role.toUpperCase()}</span>
                                  <span className="font-mono text-[11px]">{msg.model}</span>
                                </div>
                                <div className="prose dark:prose-invert max-w-none text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">
                                  <MarkdownRenderer content={msg.content} />
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Content View 3: Debate Transcript (Full Round-by-Round Breakdown) */}
                    {activeViewMode === 'rounds' && (
                      <div className="space-y-6">
                        {/* Round 1 */}
                        {r1Messages.length > 0 && (
                          <div className="space-y-3">
                            <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                              Round 1: Independent Analysis
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {r1Messages.map((m) => (
                                <div key={m.id} className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-2">
                                  <div className="font-semibold text-zinc-900 dark:text-white capitalize flex items-center gap-1.5">
                                    <span>{m.provider}</span>
                                  </div>
                                  <div className="text-zinc-700 dark:text-zinc-300 max-h-60 overflow-y-auto">
                                    <MarkdownRenderer content={m.content} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Round 2 */}
                        {r2Messages.length > 0 && (
                          <div className="space-y-3">
                            <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                              Round 2: Cross Review & Critique
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {r2Messages.map((m) => (
                                <div key={m.id} className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-2">
                                  <div className="font-semibold text-zinc-900 dark:text-white capitalize">
                                    <span>{m.provider}</span>
                                  </div>
                                  <div className="text-zinc-700 dark:text-zinc-300 max-h-60 overflow-y-auto">
                                    <MarkdownRenderer content={m.content} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Round 3 */}
                        {r3Messages.length > 0 && (
                          <div className="space-y-3">
                            <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                              Round 3: Final Debate & Defense
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {r3Messages.map((m) => (
                                <div key={m.id} className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs space-y-2">
                                  <div className="font-semibold text-zinc-900 dark:text-white capitalize">
                                    <span>{m.provider}</span>
                                  </div>
                                  <div className="text-zinc-700 dark:text-zinc-300 max-h-60 overflow-y-auto">
                                    <MarkdownRenderer content={m.content} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. SIGNATURE MODERN AI CHAT INPUT (Sticky Bottom Bar) */}
        {/* ========================================================================= */}
        <div className="sticky bottom-0 w-full px-4 sm:px-6 pb-5 pt-2 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95 z-20">
          <div className="max-w-4xl mx-auto w-full">
            {/* Attached file tags preview */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-1">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200 font-medium"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="truncate max-w-[150px]">{file.file_name}</span>
                    <button
                      onClick={() => removeAttachedFile(file.id)}
                      className="p-0.5 hover:text-rose-500 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Box Card */}
            <div className="relative rounded-3xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg focus-within:border-zinc-400 dark:focus-within:border-zinc-600 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all p-3 sm:p-4">
              {/* Mention Suggestion Dropdown Popover */}
              {showMentionMenu && (
                <div className="absolute bottom-full left-0 mb-3 w-full max-w-md p-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl z-50 space-y-1">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-1">
                    <span>Direct Message to Model (@)</span>
                    <span className="text-[10px] font-mono lowercase">ESC to close</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1 pt-1">
                    {MENTION_OPTIONS.filter(
                      (item) =>
                        item.tag.toLowerCase().includes(mentionFilter) ||
                        item.name.toLowerCase().includes(mentionFilter) ||
                        item.role.toLowerCase().includes(mentionFilter)
                    ).map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectMention(item.tag)}
                          className="w-full flex items-start gap-3 p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-left transition-colors cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                            <Icon className={`w-4 h-4 ${item.color}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                                {item.tag}
                              </span>
                              <span className="text-[11px] text-zinc-500 font-medium">
                                {item.role}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={inputPrompt}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  currentDiscussion
                    ? 'Ask a follow-up or type @ to mention a specific model...'
                    : 'Message the AI Council... Type @ to direct to a model (Enter to send)'
                }
                rows={1}
                className="w-full resize-none bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none max-h-48 overflow-y-auto leading-relaxed"
              />

              {/* Bottom toolbar inside input box */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 mt-2">
                <div className="flex items-center gap-2">
                  {/* File Attachment Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.pdf,.json,.csv,.ts,.js,.py"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
                    title="Attach files (up to 5)"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Mention Roles Guide Button */}
                  <button
                    type="button"
                    onClick={() => setShowCapabilitiesModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-800 cursor-pointer"
                    title="View Model Roles & Capabilities"
                  >
                    <AtSign className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="hidden sm:inline">Roles (@)</span>
                  </button>

                  {/* Multi-AI config toggle pill */}
                  <div className="relative">
                    <button
                      onClick={() => setShowConfigPopover(!showConfigPopover)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-800 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{rounds} Rounds</span>
                      <ChevronDown className="w-3 h-3 text-zinc-400" />
                    </button>

                    {/* Popover config */}
                    {showConfigPopover && (
                      <div className="absolute bottom-10 left-0 w-64 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl z-50 space-y-3">
                        <div className="text-xs font-semibold text-zinc-900 dark:text-white">
                          Deliberation Settings
                        </div>

                        <div>
                          <label className="text-[11px] text-zinc-500 font-medium">Number of Rounds</label>
                          <div className="grid grid-cols-3 gap-1 mt-1">
                            {[1, 2, 3].map((r) => (
                              <button
                                key={r}
                                onClick={() => {
                                  setRounds(r);
                                  setShowConfigPopover(false);
                                }}
                                className={`py-1 rounded-lg text-xs font-medium ${
                                  rounds === r
                                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                                }`}
                              >
                                {r} {r === 1 ? 'Round' : 'Rounds'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] text-zinc-500 font-medium">Participating Models</label>
                          <div className="space-y-1 mt-1">
                            {(['openai', 'gemini', 'claude'] as ProviderId[]).map((prov) => (
                              <label key={prov} className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 capitalize cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={participants.includes(prov)}
                                  onChange={() => {
                                    if (participants.includes(prov) && participants.length > 1) {
                                      setParticipants(participants.filter((p) => p !== prov));
                                    } else if (!participants.includes(prov)) {
                                      setParticipants([...participants, prov]);
                                    }
                                  }}
                                  className="rounded text-indigo-600"
                                />
                                <span>{prov}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Send or Stop Button */}
                <div>
                  {status === 'running' ? (
                    <button
                      onClick={handleStop}
                      className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
                      title="Stop generation"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!inputPrompt.trim()}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm ${
                        inputPrompt.trim()
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 hover:scale-105'
                          : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600 cursor-not-allowed'
                      }`}
                      title="Send message"
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Micro disclaimer footer */}
            <p className="mt-2 text-center text-[10px] text-zinc-600 dark:text-zinc-300">
              AIHUB Multi-AI Council — Powered by OpenAI GPT-4o, Google Gemini 1.5, and Anthropic Claude 3.5.
            </p>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 5. AI COUNCIL ROLES & CAPABILITIES MODAL */}
      {/* ========================================================================= */}
      {showCapabilitiesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <AtSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                    AI Council Roles & Capabilities
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    How to direct questions and what each model does best
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCapabilitiesModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  How Mentions Work
                </span>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                  Type <code className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-[10px]">@</code> in the prompt bar to tag a specific model. Mentioning <code className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-[10px]">@claude</code>, <code className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-[10px]">@openai</code>, or <code className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-[10px]">@gemini</code> directly targets that model. Mentioning <code className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 font-mono text-[10px]">@all</code> (or leaving it blank) initiates the full 3-round multi-agent council debate.
                </p>
              </div>

              <div className="space-y-3">
                {MENTION_OPTIONS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                            <Icon className={`w-4 h-4 ${item.color}`} />
                          </div>
                          <div>
                            <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                              <span>{item.name}</span>
                              <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                                {item.tag}
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-500 font-medium">
                              {item.role}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            handleSelectMention(item.tag);
                            setShowCapabilitiesModal(false);
                          }}
                          className="px-3 py-1 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white transition-colors cursor-pointer"
                        >
                          Use {item.tag}
                        </button>
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.strengths.map((str, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium"
                          >
                            <Check className="w-2.5 h-2.5 text-emerald-500" />
                            <span>{str}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
