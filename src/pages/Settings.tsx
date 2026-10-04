import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Brain,
  Sparkles,
  ShieldCheck,
  Sliders,
  Database,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Zap,
  HelpCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { ModelInfo, ProviderId, UserProfile } from '@/types';
import { ALL_PROVIDERS, DEFAULT_MODELS, providerKeyStore } from '@/services/providers/keyStore';
import { providerRegistry } from '@/services/providers/registry';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { settingsService } from '@/services/settings/settingsService';
import { detectProvider } from '@/services/providers/detectProvider';
import { pickSensibleDefaultModel, STATIC_FALLBACK_MODELS } from '@/services/providers/modelUtils';

interface SettingsProps {
  user: UserProfile;
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

export const SettingsView: React.FC<SettingsProps> = ({
  user,
  theme,
  onThemeChange,
}) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'preferences' | 'database'>('providers');

  // Quick Add / Auto-Detect State
  const [quickKeyInput, setQuickKeyInput] = useState('');
  const [selectedTargetProvider, setSelectedTargetProvider] = useState<ProviderId>('openai');
  const [quickAddStatus, setQuickAddStatus] = useState<{
    state: 'idle' | 'detecting' | 'validating' | 'success' | 'error';
    message?: string;
  }>({ state: 'idle' });

  // Provider states
  const [keys, setKeys] = useState<Record<ProviderId, string>>({
    openai: providerKeyStore.getKey('openai'),
    gemini: providerKeyStore.getKey('gemini'),
    claude: providerKeyStore.getKey('claude'),
    deepseek: providerKeyStore.getKey('deepseek'),
    groq: providerKeyStore.getKey('groq'),
    mock: providerKeyStore.getKey('mock'),
  });

  const [models, setModels] = useState<Record<ProviderId, string>>({
    openai: providerKeyStore.getModel('openai'),
    gemini: providerKeyStore.getModel('gemini'),
    claude: providerKeyStore.getModel('claude'),
    deepseek: providerKeyStore.getModel('deepseek'),
    groq: providerKeyStore.getModel('groq'),
    mock: providerKeyStore.getModel('mock'),
  });

  const [customModelMode, setCustomModelMode] = useState<Record<ProviderId, boolean>>({
    openai: false,
    gemini: false,
    claude: false,
    deepseek: false,
    groq: false,
    mock: false,
  });

  const [enabled, setEnabled] = useState<Record<ProviderId, boolean>>({
    openai: providerKeyStore.isEnabled('openai'),
    gemini: providerKeyStore.isEnabled('gemini'),
    claude: providerKeyStore.isEnabled('claude'),
    deepseek: providerKeyStore.isEnabled('deepseek'),
    groq: providerKeyStore.isEnabled('groq'),
    mock: providerKeyStore.isEnabled('mock'),
  });

  const [showKey, setShowKey] = useState<Record<ProviderId, boolean>>({
    openai: false,
    gemini: false,
    claude: false,
    deepseek: false,
    groq: false,
    mock: false,
  });

  const [testStatus, setTestStatus] = useState<
    Record<ProviderId, { state: 'idle' | 'testing' | 'success' | 'error'; message?: string }>
  >({
    openai: { state: 'idle' },
    gemini: { state: 'idle' },
    claude: { state: 'idle' },
    deepseek: { state: 'idle' },
    groq: { state: 'idle' },
    mock: { state: 'idle' },
  });

  // Dynamically fetched models from API keys
  const [dynamicModels, setDynamicModels] = useState<Record<ProviderId, ModelInfo[]>>({
    openai: STATIC_FALLBACK_MODELS.openai,
    gemini: STATIC_FALLBACK_MODELS.gemini,
    claude: STATIC_FALLBACK_MODELS.claude,
    deepseek: STATIC_FALLBACK_MODELS.deepseek,
    groq: STATIC_FALLBACK_MODELS.groq,
    mock: STATIC_FALLBACK_MODELS.mock,
  });

  // General settings
  const [defaultRounds, setDefaultRounds] = useState(3);
  const [defaultModerator, setDefaultModerator] = useState<ProviderId>('openai');
  const [requestDelay, setRequestDelay] = useState<number>(() => providerKeyStore.getRequestDelay());
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Auto-fetch real models on load for all configured keys
  useEffect(() => {
    ALL_PROVIDERS.forEach(async (p) => {
      const key = keys[p];
      if (key && p !== 'mock') {
        try {
          const pInstance = providerRegistry.get(p);
          const fetched = await pInstance.listModels(key);
          if (Array.isArray(fetched) && fetched.length > 0) {
            setDynamicModels((prev) => ({ ...prev, [p]: fetched }));
          }
        } catch {
          // ignore error on mount
        }
      }
    });
  }, []);

  // Update quick add candidate when quick key changes
  const detected = detectProvider(quickKeyInput);

  useEffect(() => {
    if (detected.detectedProvider) {
      setSelectedTargetProvider(detected.detectedProvider);
    } else if (detected.candidateProviders.length > 0) {
      setSelectedTargetProvider(detected.candidateProviders[0]);
    }
  }, [quickKeyInput]);

  const handleKeyChange = (provider: ProviderId, value: string) => {
    setKeys((prev) => ({ ...prev, [provider]: value }));
    providerKeyStore.setKey(provider, value);
    setTestStatus((prev) => ({ ...prev, [provider]: { state: 'idle' } }));
  };

  const handleModelChange = (provider: ProviderId, model: string) => {
    setModels((prev) => ({ ...prev, [provider]: model }));
    providerKeyStore.setModel(provider, model);
  };

  const handleToggleEnabled = (provider: ProviderId) => {
    const next = !enabled[provider];
    setEnabled((prev) => ({ ...prev, [provider]: next }));
    providerKeyStore.setEnabled(provider, next);
  };

  const handleClearKey = (provider: ProviderId) => {
    providerKeyStore.clearKey(provider);
    setKeys((prev) => ({ ...prev, [provider]: '' }));
    setTestStatus((prev) => ({ ...prev, [provider]: { state: 'idle' } }));
  };

  const handleRefreshModels = async (provider: ProviderId) => {
    const key = keys[provider];
    if (!key) return;

    try {
      const pInstance = providerRegistry.get(provider);
      const fetched = await pInstance.listModels(key);
      if (fetched && fetched.length > 0) {
        setDynamicModels((prev) => ({ ...prev, [provider]: fetched }));
        const current = models[provider];
        if (!fetched.some((m) => m.id === current)) {
          const sensible = pickSensibleDefaultModel(fetched);
          if (sensible) {
            handleModelChange(provider, sensible);
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const handleTestConnection = async (provider: ProviderId) => {
    const key = keys[provider];
    if (!key) {
      setTestStatus((prev) => ({
        ...prev,
        [provider]: { state: 'error', message: 'Enter an API key first' },
      }));
      return;
    }

    setTestStatus((prev) => ({ ...prev, [provider]: { state: 'testing' } }));

    try {
      const pInstance = providerRegistry.get(provider);
      const res = await pInstance.validateConnection(key, models[provider]);
      if (res.success) {
        // Automatically fetch and update models
        const fetched = await pInstance.listModels(key);
        if (fetched && fetched.length > 0) {
          setDynamicModels((prev) => ({ ...prev, [provider]: fetched }));
          const current = models[provider];
          if (!fetched.some((m) => m.id === current)) {
            const best = pickSensibleDefaultModel(fetched);
            if (best) {
              handleModelChange(provider, best);
            }
          }
        }
        setTestStatus((prev) => ({
          ...prev,
          [provider]: { state: 'success', message: 'Connection successful' },
        }));
      } else {
        setTestStatus((prev) => ({
          ...prev,
          [provider]: { state: 'error', message: res.error || 'Connection failed' },
        }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setTestStatus((prev) => ({
        ...prev,
        [provider]: { state: 'error', message: msg },
      }));
    }
  };

  // Quick Add Connect & Discover
  const handleQuickAddConnect = async () => {
    const cleanKey = quickKeyInput.trim();
    if (!cleanKey) return;

    const target = selectedTargetProvider;
    setQuickAddStatus({ state: 'validating' });

    try {
      const pInstance = providerRegistry.get(target);
      const res = await pInstance.validateConnection(cleanKey);

      if (!res.success) {
        setQuickAddStatus({
          state: 'error',
          message: res.error || `Failed to connect to ${pInstance.name}. Verify your API key.`,
        });
        return;
      }

      // 1. Save key to session/memory store (BYOK: never saved to Supabase database)
      providerKeyStore.setKey(target, cleanKey);
      setKeys((prev) => ({ ...prev, [target]: cleanKey }));
      setEnabled((prev) => ({ ...prev, [target]: true }));
      providerKeyStore.setEnabled(target, true);

      // 2. Discover models dynamically
      const fetched = await pInstance.listModels(cleanKey);
      if (fetched && fetched.length > 0) {
        setDynamicModels((prev) => ({ ...prev, [target]: fetched }));
        const sensible = pickSensibleDefaultModel(fetched);
        if (sensible) {
          providerKeyStore.setModel(target, sensible);
          setModels((prev) => ({ ...prev, [target]: sensible }));
        }
      }

      setQuickAddStatus({
        state: 'success',
        message: `Successfully connected to ${pInstance.name}! Available models discovered.`,
      });
      setQuickKeyInput('');
      setTimeout(() => {
        setQuickAddStatus({ state: 'idle' });
      }, 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setQuickAddStatus({ state: 'error', message: msg });
    }
  };

  const handleSavePreferences = async () => {
    providerKeyStore.setRequestDelay(requestDelay);
    await settingsService.updateSettings(user.id, {
      default_rounds: defaultRounds,
      default_moderator: defaultModerator,
      theme,
      request_delay_seconds: requestDelay,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const getProviderIcon = (p: ProviderId) => {
    switch (p) {
      case 'openai':
        return <Brain className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case 'gemini':
        return <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'claude':
        return <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case 'groq':
        return <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />;
      case 'deepseek':
        return <Cpu className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />;
      case 'mock':
        return <Sliders className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
    }
  };

  const getProviderBadge = (p: ProviderId) => {
    switch (p) {
      case 'openai':
        return 'Lead Analyst';
      case 'gemini':
        return 'Alternative Analyst';
      case 'claude':
        return 'Critical Reviewer';
      case 'groq':
        return 'Fast Synthesizer';
      case 'deepseek':
        return 'Deep Reasoning';
      case 'mock':
        return 'Simulation Mode';
    }
  };

  const sqlMigrationSchema = `-- Supabase Schema for AIHUB
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  participants JSONB DEFAULT '["openai", "gemini", "claude"]'::jsonb,
  rounds INT NOT NULL DEFAULT 3,
  moderator TEXT NOT NULL DEFAULT 'openai',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.discussion_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'waiting',
  duration_ms INT DEFAULT 0,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_rounds INT DEFAULT 3,
  default_moderator TEXT DEFAULT 'openai',
  theme TEXT DEFAULT 'system',
  request_delay_seconds NUMERIC DEFAULT 1.5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  discussion_id UUID REFERENCES public.discussions(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT,
  extracted_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Settings & Configuration
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Manage your AI provider API keys, dynamic models, deliberation rates, and system preferences.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('providers')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'providers'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>AI Providers & Models</span>
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'preferences'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Preferences & Rate Limits</span>
        </button>

        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'database'
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-semibold'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Supabase Status</span>
        </button>
      </div>

      {/* ================= TAB 1: AI PROVIDERS ================= */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          {/* Security Banner */}
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-emerald-950 dark:text-emerald-200">
                Zero-Persistence Key Security (BYOK)
              </span>
              <p className="text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                API keys are kept strictly in browser session memory and dispatched per request over HTTPS. Keys are NEVER stored in the Supabase database, disk, or logs.
              </p>
            </div>
          </div>

          {/* SINGLE "ADD API KEY" AUTO-DETECTION FIELD */}
          <div className="p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/50 via-white to-zinc-50 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-zinc-900/80 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-100 dark:border-indigo-950">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                    Quick Connect API Key (Auto-Detect)
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Paste any provider API key to automatically identify the service and retrieve its available models.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type="password"
                  value={quickKeyInput}
                  onChange={(e) => setQuickKeyInput(e.target.value)}
                  placeholder="Paste your API key here (e.g. gsk_..., sk-ant-..., AIza..., sk-...)"
                  className="w-full px-4 py-2.5 pr-10 text-xs font-mono rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {quickKeyInput.trim() && (
                <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    {getProviderIcon(selectedTargetProvider)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {detected.isUnknown ? 'Provider:' : `Detected: ${detected.displayName}`}
                        </span>
                        {detected.detectedProvider && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            Auto-matched by prefix
                          </span>
                        )}
                        {detected.isAmbiguous && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Ambiguous prefix
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {detected.isUnknown
                          ? 'Unrecognized key prefix. Please pick the corresponding provider manually.'
                          : 'You can manually change the provider before connecting.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-[11px] text-zinc-500 font-medium">Provider:</label>
                    <select
                      value={selectedTargetProvider}
                      onChange={(e) => setSelectedTargetProvider(e.target.value as ProviderId)}
                      className="px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 font-medium cursor-pointer"
                    >
                      {ALL_PROVIDERS.map((p) => (
                        <option key={p} value={p}>
                          {p === 'openai'
                            ? 'OpenAI'
                            : p === 'gemini'
                            ? 'Google Gemini'
                            : p === 'claude'
                            ? 'Anthropic Claude'
                            : p === 'groq'
                            ? 'Groq'
                            : p === 'deepseek'
                            ? 'DeepSeek'
                            : 'Mock Simulation'}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleQuickAddConnect}
                      disabled={quickAddStatus.state === 'validating'}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {quickAddStatus.state === 'validating' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <span>Connect & Fetch Models</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {quickAddStatus.message && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    quickAddStatus.state === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {quickAddStatus.state === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{quickAddStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Provider Cards */}
          <div className="space-y-4">
            {ALL_PROVIDERS.map((p) => {
              const isEnabled = enabled[p];
              const pKey = keys[p];
              const pModel = models[p];
              const status = testStatus[p];
              const availableList = dynamicModels[p] || [];
              const isCustom = customModelMode[p] || !availableList.some((m) => m.id === pModel);

              const pName =
                p === 'openai'
                  ? 'OpenAI'
                  : p === 'gemini'
                  ? 'Google Gemini'
                  : p === 'claude'
                  ? 'Anthropic Claude'
                  : p === 'groq'
                  ? 'Groq'
                  : p === 'deepseek'
                  ? 'DeepSeek'
                  : 'Mock Simulator';

              return (
                <div
                  key={p}
                  className={`p-5 rounded-2xl border transition-all ${
                    isEnabled
                      ? 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs'
                      : 'border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/40 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        {getProviderIcon(p)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{pName}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                            {getProviderBadge(p)}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {p === 'groq'
                            ? 'Ultra-Fast LPUs (Meta Llama & Mixtral models)'
                            : p === 'gemini'
                            ? 'Google Multimodal API (Generative Language API)'
                            : p === 'claude'
                            ? 'Anthropic Messages API'
                            : p === 'deepseek'
                            ? 'DeepSeek Reasoning & Chat API'
                            : p === 'mock'
                            ? 'Simulated AI engine for testing without API keys'
                            : 'OpenAI Chat Completions API'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => handleToggleEnabled(p)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
                        />
                        <span>Enabled</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    {/* Key Input */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {pName} API Key
                      </label>
                      <div className="relative">
                        <input
                          type={showKey[p] ? 'text' : 'password'}
                          value={pKey}
                          onChange={(e) => handleKeyChange(p, e.target.value)}
                          placeholder={p === 'mock' ? 'Mock key not required' : `Enter ${pName} API key`}
                          disabled={p === 'mock'}
                          className="w-full px-3 py-2 pr-10 text-xs font-mono rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden disabled:opacity-50"
                        />
                        {p !== 'mock' && (
                          <button
                            type="button"
                            onClick={() => setShowKey((prev) => ({ ...prev, [p]: !prev[p] }))}
                            className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                          >
                            {showKey[p] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Model Dropdown & Custom Option */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Selected Model
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRefreshModels(p)}
                            disabled={!pKey}
                            className="text-[11px] text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            title="Refetch available models from API"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Refresh</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomModelMode((prev) => ({ ...prev, [p]: !isCustom }))}
                            className="text-[11px] text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                          >
                            {isCustom ? 'Show dropdown' : 'Custom model'}
                          </button>
                        </div>
                      </div>

                      {isCustom ? (
                        <input
                          type="text"
                          value={pModel}
                          onChange={(e) => handleModelChange(p, e.target.value)}
                          placeholder="Type custom model id..."
                          className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      ) : (
                        <select
                          value={pModel}
                          onChange={(e) => handleModelChange(p, e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden cursor-pointer"
                        >
                          {availableList.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label || m.id}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="text-[10px] text-zinc-500">
                        {availableList.length > 0
                          ? `${availableList.length} models discovered for this key`
                          : 'Static fallback models'}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 mt-4">
                    <div className="flex items-center gap-2">
                      {status.state === 'testing' && (
                        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Validating connection...</span>
                        </span>
                      )}
                      {status.state === 'success' && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{status.message || 'Connected successfully'}</span>
                        </span>
                      )}
                      {status.state === 'error' && (
                        <span className="flex items-center gap-1.5 text-xs text-rose-500 font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{status.message}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {pKey && p !== 'mock' && (
                        <button
                          type="button"
                          onClick={() => handleClearKey(p)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          Clear Key
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleTestConnection(p)}
                        disabled={status.state === 'testing'}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Test Connection
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save Bar */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Save AI Provider Configurations
              </p>
              <p className="text-[11px] text-zinc-500">
                Persist selected models and active provider states locally
              </p>
            </div>

            <div className="flex items-center gap-3">
              {savedNotice && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved successfully</span>
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  Object.entries(keys).forEach(([p, val]) => {
                    providerKeyStore.setKey(p as ProviderId, val);
                  });
                  Object.entries(models).forEach(([p, model]) => {
                    providerKeyStore.setModel(p as ProviderId, model);
                  });
                  Object.entries(enabled).forEach(([p, isEn]) => {
                    providerKeyStore.setEnabled(p as ProviderId, isEn);
                  });
                  setSavedNotice(true);
                  setTimeout(() => setSavedNotice(false), 2500);
                }}
                className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 font-semibold text-xs transition-all shadow-xs cursor-pointer"
              >
                Save API Keys & Models
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: PREFERENCES ================= */}
      {activeTab === 'preferences' && (
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-6">
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Default Deliberation Depth
                </label>
                <select
                  value={defaultRounds}
                  onChange={(e) => setDefaultRounds(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  <option value={1}>1 Round (Independent Analysis)</option>
                  <option value={2}>2 Rounds (Analysis + Cross-Review)</option>
                  <option value={3}>3 Rounds (Analysis + Cross-Review + Debate)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Default Final Moderator
                </label>
                <select
                  value={defaultModerator}
                  onChange={(e) => setDefaultModerator(e.target.value as ProviderId)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  <option value="openai">OpenAI (Structured Consensus)</option>
                  <option value="gemini">Google Gemini (Alternative Perspectives)</option>
                  <option value="claude">Anthropic Claude (Critical Edge-Case Weighting)</option>
                  <option value="groq">Groq (High-Throughput Synthesis)</option>
                  <option value="deepseek">DeepSeek (Algorithmic Reasoning)</option>
                </select>
              </div>
            </div>

            {/* REQUEST DELAY (RATE LIMIT CONTROL) */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Request Delay Between Provider Calls
                  </label>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {requestDelay}s
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Minimum pause enforced between consecutive requests to the same provider. Different providers run concurrently in parallel. If using free-tier keys (e.g. Google Gemini 15 RPM), increase this delay to 2.0s - 3.0s to avoid HTTP 429 quota errors.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.5"
                  value={requestDelay}
                  onChange={(e) => setRequestDelay(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>0.5s (Fast / Tier 2+)</span>
                <span>1.5s (Standard Default)</span>
                <span>5.0s (Strict Free Tier)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Appearance & Theme
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onThemeChange(t)}
                    className={`py-2 px-3 rounded-xl border text-xs capitalize transition-all cursor-pointer ${
                      theme === t
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {t} Mode
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            {savedNotice ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>Preferences updated successfully</span>
              </span>
            ) : (
              <span />
            )}

            <button
              onClick={handleSavePreferences}
              className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs hover:bg-zinc-800 transition-colors shadow-xs cursor-pointer"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 3: SUPABASE DATABASE ================= */}
      {activeTab === 'database' && (
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                Supabase Connection Status
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                PostgreSQL database and Row Level Security for persistent discussions.
              </p>
            </div>

            {isSupabaseConfigured ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected & Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <span>Local Session Fallback</span>
              </span>
            )}
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                PostgreSQL Database Schema (RLS Ready)
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sqlMigrationSchema);
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {copiedSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSql ? 'Copied' : 'Copy SQL Schema'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 max-h-48 overflow-y-auto">
              {sqlMigrationSchema}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
