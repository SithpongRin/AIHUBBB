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
  Cpu,
  Zap,
  RotateCcw,
} from 'lucide-react';

const MENTION_OPTIONS = [
  {
    id: 'all',
    tag: '@all',
    name: 'AI Council (All Configured Models)',
    role: 'Multi-AI Deliberation',
    icon: BrainCircuit,
    color: 'text-indigo-600 dark:text-indigo-400',
    description: 'Runs structured debate across all your configured AI models to synthesize consensus.',
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
  {
    id: 'deepseek',
    tag: '@deepseek',
    name: 'DeepSeek (V3 / R1)',
    role: 'Deep Reasoning & Code',
    icon: Cpu,
    color: 'text-purple-600 dark:text-purple-400',
    description: 'Advanced mathematical logic, code architecture, and chain-of-thought problem solving.',
    strengths: ['Algorithmic reasoning', 'Code optimization', 'Math & Logic'],
  },
  {
    id: 'groq',
    tag: '@groq',
    name: 'Groq (Llama 3.3 70B)',
    role: 'Ultra-Fast Inference',
    icon: Zap,
    color: 'text-orange-600 dark:text-orange-400',
    description: 'Blazing fast inference on LPU chips with Meta Llama 3.3 70B & 8B.',
    strengths: ['Sub-second latency', 'High throughput', 'Concise synthesis'],
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
import { ALL_PROVIDERS, providerKeyStore } from '@/services/providers/keyStore';
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
  const [activeViewMode, setActiveViewMode] = useState<'chat' | 'consensus'>('chat');
  const [selectedPerspective, setSelectedPerspective] = useState<ProviderId>('openai');

  // Input bar state
  const [inputPrompt, setInputPrompt] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<DiscussionFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [configuredProviders, setConfiguredProviders] = useState<ProviderId[]>(() => providerKeyStore.getConfiguredProviders());
  const [rounds, setRounds] = useState<number>(1);
  const [participants, setParticipants] = useState<ProviderId[]>(() => {
    const list = providerKeyStore.getConfiguredProviders();
    return list.length > 0 ? list : ['gemini'];
  });
  const [moderator, setModerator] = useState<ProviderId>(() => {
    const list = providerKeyStore.getConfiguredProviders();
    return list[0] || 'gemini';
  });
  const [showConfigPopover, setShowConfigPopover] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [showCapabilitiesModal, setShowCapabilitiesModal] = useState(false);

  // UI state
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const orchestratorRef = useRef<DiscussionOrchestrator | null>(null);
  const isRunningRef = useRef(false);
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

      const existingMessages = disc.messages || [];
      // Ensure initial question is represented as a user message if created before
      if (disc.question && !existingMessages.some((m) => m.role === 'user')) {
        const initialUserMsg: DiscussionMessage = {
          id: `${disc.id}-initial-user`,
          discussion_id: disc.id,
          round_number: 1,
          provider: 'user',
          model: 'User',
          role: 'user',
          content: disc.question,
          status: 'completed',
          created_at: disc.created_at,
        };
        setMessages([initialUserMsg, ...existingMessages]);
      } else {
        setMessages(existingMessages);
      }

      setRounds(disc.rounds || 1);
      setParticipants(disc.participants || ['gemini']);
    });

    return () => {
      mounted = false;
      if (orchestratorRef.current) {
        orchestratorRef.current.stop();
        isRunningRef.current = false;
      }
    };
  }, [activeDiscussionId]);

  // Run Multi-AI Orchestrator with full conversation history
  const startOrchestration = (disc: Discussion, historySnapshot?: DiscussionMessage[]) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const orchestrator = new DiscussionOrchestrator();
    orchestratorRef.current = orchestrator;

    orchestrator.run({
      discussionId: disc.id,
      question: disc.question,
      participants: disc.participants,
      rounds: 1, // Normal chat mode is strictly 1 round per turn
      moderator: disc.moderator,
      files: disc.files,
      history: historySnapshot || messages,
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
        if (newStatus !== 'running') {
          isRunningRef.current = false;
        }
        discussionService.updateDiscussionStatus(disc.id, newStatus);
        loadHistory();
      },
      onNotice: (notice) => {
        setNoticeMessage(notice.message);
        setTimeout(() => setNoticeMessage(null), 6000);
      },
    });
  };

  const handleRetrySingleMessage = async (failedMsg: DiscussionMessage) => {
    if (isRunningRef.current) return;
    const orchestrator = orchestratorRef.current || new DiscussionOrchestrator();
    orchestratorRef.current = orchestrator;

    const question = currentDiscussion?.question || 'Follow-up inquiry';
    await orchestrator.retryMessage(
      failedMsg,
      question,
      messages,
      currentDiscussion?.files,
      (updated) => {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        discussionService.saveMessage(updated);
      }
    );
  };

  // Stop deliberation
  const handleStop = () => {
    isRunningRef.current = false;
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

    const configured = providerKeyStore.getConfiguredProviders();
    if (configured.length === 0) {
      setErrorMsg('No API key configured. Please enter your API key (e.g. Gemini, OpenAI, Claude) in Settings to get responses.');
      onOpenSettings();
      return;
    }

    // Dynamic mention detection
    let effectiveParticipants = participants;
    let effectiveRounds = rounds;

    if (textToSend.includes('@claude') && !textToSend.includes('@openai') && !textToSend.includes('@gemini') && !textToSend.includes('@all')) {
      if (!configured.includes('claude')) {
        setErrorMsg('Claude API key is not configured. Please open Settings and enter your Anthropic API key.');
        onOpenSettings();
        return;
      }
      effectiveParticipants = ['claude'];
      effectiveRounds = 1;
    } else if (textToSend.includes('@openai') && !textToSend.includes('@claude') && !textToSend.includes('@gemini') && !textToSend.includes('@all')) {
      if (!configured.includes('openai')) {
        setErrorMsg('OpenAI API key is not configured. Please open Settings and enter your OpenAI API key.');
        onOpenSettings();
        return;
      }
      effectiveParticipants = ['openai'];
      effectiveRounds = 1;
    } else if (textToSend.includes('@gemini') && !textToSend.includes('@claude') && !textToSend.includes('@openai') && !textToSend.includes('@all')) {
      if (!configured.includes('gemini')) {
        setErrorMsg('Gemini API key is not configured. Please open Settings and enter your Gemini API key.');
        onOpenSettings();
        return;
      }
      effectiveParticipants = ['gemini'];
      effectiveRounds = 1;
    } else if (textToSend.includes('@all')) {
      effectiveParticipants = configured;
      effectiveRounds = 1;
    } else {
      // Default deliberation: only use providers that are configured with keys!
      const available = effectiveParticipants.filter((p) => configured.includes(p));
      if (available.length > 0) {
        effectiveParticipants = available;
      } else {
        effectiveParticipants = configured;
      }
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

        const userMsg: DiscussionMessage = {
          id: `${newDisc.id}-user-${Date.now()}`,
          discussion_id: newDisc.id,
          round_number: 1,
          provider: 'user',
          model: 'User',
          role: 'user',
          content: textToSend,
          status: 'completed',
          created_at: new Date().toISOString(),
        };
        await discussionService.saveMessage(userMsg);

        setInputPrompt('');
        setAttachedFiles([]);
        onSelectDiscussion(newDisc.id);
        setCurrentDiscussion(newDisc);
        setStatus('running');
        setMessages([userMsg]);
        await loadHistory();
        startOrchestration(newDisc, [userMsg]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to start deliberation';
        setErrorMsg(msg);
      }
    } else {
      // Follow-up message in existing discussion!
      const userMsg: DiscussionMessage = {
        id: `${currentDiscussion.id}-user-${Date.now()}`,
        discussion_id: currentDiscussion.id,
        round_number: 1,
        provider: 'user',
        model: 'User',
        role: 'user',
        content: textToSend,
        status: 'completed',
        created_at: new Date().toISOString(),
      };
      await discussionService.saveMessage(userMsg);

      const updatedHistory = [...messages, userMsg];
      setMessages(updatedHistory);
      setInputPrompt('');
      setStatus('running');

      const updatedDisc: Discussion = {
        ...currentDiscussion,
        question: textToSend,
        participants: effectiveParticipants,
        status: 'running',
        rounds: 1,
      };

      setCurrentDiscussion(updatedDisc);
      startOrchestration(updatedDisc, updatedHistory);
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

  const finalMessage =
    messages.find((m) => m.role === 'final') ||
    messages.find((m) => m.status === 'completed' && Boolean(m.content)) ||
    messages.find((m) => m.status === 'failed' && Boolean(m.content));
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
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px]">
              {configuredProviders.length === 0 ? (
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  <AlertCircle className="w-3 h-3" />
                  <span>Configure API Keys</span>
                </button>
              ) : (
                configuredProviders.map((p, idx) => (
                  <React.Fragment key={p}>
                    {idx > 0 && <span className="text-zinc-300 dark:text-zinc-700">+</span>}
                    <span className="flex items-center gap-1 font-medium text-zinc-800 dark:text-zinc-200 capitalize">
                      {p === 'openai' && <Brain className="w-3 h-3 text-emerald-500" />}
                      {p === 'gemini' && <Sparkles className="w-3 h-3 text-blue-500" />}
                      {p === 'claude' && <ShieldCheck className="w-3 h-3 text-amber-500" />}
                      {p === 'deepseek' && <Cpu className="w-3 h-3 text-purple-500" />}
                      {p === 'groq' && <Zap className="w-3 h-3 text-orange-500" />}
                      <span>{p}</span>
                    </span>
                  </React.Fragment>
                ))
              )}
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
              /* Case B: Active Conversation Stream (Standard Natural Chat) */
              <div className="space-y-6 pb-4">
                {noticeMessage && (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{noticeMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNoticeMessage(null)}
                      className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 text-xs font-semibold cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {messages.map((msg) => {
                  // User Message (Right-aligned)
                  if (msg.role === 'user' || msg.provider === 'user') {
                    return (
                      <div key={msg.id} className="flex justify-end items-end gap-2.5 animate-fadeIn">
                        <div className="max-w-[85%] sm:max-w-[75%] rounded-3xl rounded-br-xs bg-zinc-900 text-white dark:bg-zinc-800 p-4 sm:p-5 shadow-sm space-y-2">
                          <p className="text-sm font-normal leading-relaxed whitespace-pre-wrap selection:bg-indigo-500 selection:text-white">
                            {msg.content}
                          </p>
                          <div className="text-[10px] text-zinc-400 text-right">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                          {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                      </div>
                    );
                  }

                  const isGemini = msg.provider === 'gemini';
                  const isOpenAI = msg.provider === 'openai';
                  const isClaude = msg.provider === 'claude';
                  const isDeepSeek = msg.provider === 'deepseek';
                  const isGroq = msg.provider === 'groq';
                  const isMock = msg.provider === 'mock';

                  const pName =
                    isOpenAI ? 'OpenAI' :
                    isGemini ? 'Google Gemini' :
                    isClaude ? 'Anthropic Claude' :
                    isDeepSeek ? 'DeepSeek' :
                    isGroq ? 'Groq' :
                    isMock ? 'Mock Engine (Simulation)' : 'AI Assistant';

                  const avatarBg =
                    isOpenAI ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                    isGemini ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                    isClaude ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' :
                    isDeepSeek ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                    isGroq ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' :
                    'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';

                  const borderAccent =
                    isOpenAI ? 'border-emerald-500/20 dark:border-emerald-500/15' :
                    isGemini ? 'border-blue-500/20 dark:border-blue-500/15' :
                    isClaude ? 'border-amber-500/20 dark:border-amber-500/15' :
                    isDeepSeek ? 'border-purple-500/20 dark:border-purple-500/15' :
                    isGroq ? 'border-orange-500/20 dark:border-orange-500/15' :
                    'border-zinc-500/20 dark:border-zinc-500/15';

                  return (
                    <div key={msg.id} className="flex items-start gap-3 sm:gap-4 animate-fadeIn">
                      <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs ${avatarBg}`}>
                        {isOpenAI && <Brain className="w-4 h-4" />}
                        {isGemini && <Sparkles className="w-4 h-4" />}
                        {isClaude && <ShieldCheck className="w-4 h-4" />}
                        {isDeepSeek && <Cpu className="w-4 h-4" />}
                        {isGroq && <Zap className="w-4 h-4" />}
                        {isMock && <Sliders className="w-4 h-4" />}
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Header */}
                        <div className="flex items-center justify-between text-xs px-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{pName}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                              {msg.model}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                            {msg.duration_ms ? (
                              <span className="font-mono">{(msg.duration_ms / 1000).toFixed(1)}s</span>
                            ) : null}
                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {msg.content && (
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(msg.content)}
                                className="p-1 hover:text-zinc-900 dark:hover:text-zinc-100 rounded cursor-pointer"
                                title="Copy message"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Content */}
                        <div className={`p-4 sm:p-5 rounded-3xl rounded-tl-xs border ${borderAccent} bg-white dark:bg-zinc-900 shadow-2xs space-y-3`}>
                          {msg.status === 'thinking' && !msg.content ? (
                            <div className="flex items-center gap-2 text-xs text-zinc-500 py-1 font-medium">
                              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                              <span>{pName} is thinking & replying...</span>
                            </div>
                          ) : msg.status === 'failed' && !msg.content ? (
                            <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-300 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                                  <AlertCircle className="w-4 h-4 shrink-0" />
                                  <span>Response Interrupted</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRetrySingleMessage(msg)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-xs"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Retry this response</span>
                                </button>
                              </div>
                              <p className="text-[11px] text-rose-700 dark:text-rose-300/90 leading-relaxed">
                                {msg.error_message || 'Failed to respond. Please check your API key or model in Settings.'}
                              </p>
                            </div>
                          ) : (
                            <div className="prose dark:prose-invert max-w-none text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">
                              <MarkdownRenderer content={msg.content} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* If AI is generating but message hasn't been added yet */}
                {status === 'running' && !messages.some((m) => m.status === 'thinking') && (
                  <div className="flex items-center gap-3 text-xs text-zinc-500 pl-12 py-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                    <span>AI is responding...</span>
                  </div>
                )}
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

            {/* Warning banner when no keys are configured */}
            {providerKeyStore.getConfiguredProviders().length === 0 && (
              <div className="mb-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">
                    No AI API keys configured. Add an API key in Settings to get responses.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition-colors shrink-0 cursor-pointer shadow-xs"
                >
                  Configure Keys
                </button>
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

                  {/* Multi-AI config toggle pill (Only if user has configured multiple models) */}
                  {configuredProviders.length > 1 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowConfigPopover(!showConfigPopover)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-800 cursor-pointer"
                      >
                        <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{rounds === 1 ? '1 Round' : `${rounds} Rounds`}</span>
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
                              {configuredProviders.map((prov) => (
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
                  )}
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
            <p className="mt-2 text-center text-[10px] text-zinc-600 dark:text-zinc-400">
              AIHUB Multi-AI Council &mdash; Powered by{' '}
              {(() => {
                const active = ALL_PROVIDERS
                  .filter((p) => p !== 'mock' && Boolean(providerKeyStore.getKey(p)))
                  .map((p) => {
                    const name =
                      p === 'openai'
                        ? 'OpenAI'
                        : p === 'gemini'
                        ? 'Google Gemini'
                        : p === 'claude'
                        ? 'Anthropic Claude'
                        : p === 'groq'
                        ? 'Groq'
                        : 'DeepSeek';
                    const m = providerKeyStore.getModel(p);
                    return m ? `${name} (${m})` : name;
                  });
                if (active.length === 0) {
                  return 'Multi-Model Deliberation Architecture (Configure API keys in Settings)';
                }
                return active.join(', ');
              })()}
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
