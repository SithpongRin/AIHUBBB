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
} from 'lucide-react';
import { ProviderId, UserProfile, UserSettings } from '@/types';
import { AVAILABLE_MODELS, providerKeyStore } from '@/services/providers/keyStore';
import { providerRegistry } from '@/services/providers/registry';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { settingsService } from '@/services/settings/settingsService';

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

  // Provider states
  const [keys, setKeys] = useState<Record<ProviderId, string>>({
    openai: providerKeyStore.getKey('openai'),
    gemini: providerKeyStore.getKey('gemini'),
    claude: providerKeyStore.getKey('claude'),
    deepseek: providerKeyStore.getKey('deepseek'),
    groq: providerKeyStore.getKey('groq'),
  });

  const [models, setModels] = useState<Record<ProviderId, string>>({
    openai: providerKeyStore.getModel('openai'),
    gemini: providerKeyStore.getModel('gemini'),
    claude: providerKeyStore.getModel('claude'),
    deepseek: providerKeyStore.getModel('deepseek'),
    groq: providerKeyStore.getModel('groq'),
  });

  const [enabled, setEnabled] = useState<Record<ProviderId, boolean>>({
    openai: providerKeyStore.isEnabled('openai'),
    gemini: providerKeyStore.isEnabled('gemini'),
    claude: providerKeyStore.isEnabled('claude'),
    deepseek: providerKeyStore.isEnabled('deepseek'),
    groq: providerKeyStore.isEnabled('groq'),
  });

  const [showKey, setShowKey] = useState<Record<ProviderId, boolean>>({
    openai: false,
    gemini: false,
    claude: false,
    deepseek: false,
    groq: false,
  });

  const [testStatus, setTestStatus] = useState<
    Record<ProviderId, { state: 'idle' | 'testing' | 'success' | 'error'; message?: string }>
  >({
    openai: { state: 'idle' },
    gemini: { state: 'idle' },
    claude: { state: 'idle' },
    deepseek: { state: 'idle' },
    groq: { state: 'idle' },
  });

  // Dynamically fetched models from API keys
  const [dynamicModels, setDynamicModels] = useState<
    Record<ProviderId, { id: string; name: string; description: string }[]>
  >({
    openai: AVAILABLE_MODELS.openai,
    gemini: AVAILABLE_MODELS.gemini,
    claude: AVAILABLE_MODELS.claude,
    deepseek: AVAILABLE_MODELS.deepseek,
    groq: AVAILABLE_MODELS.groq,
  });

  // General settings
  const [defaultRounds, setDefaultRounds] = useState(3);
  const [defaultModerator, setDefaultModerator] = useState<ProviderId>('openai');
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Auto-fetch real models from Gemini key on load if key exists
  useEffect(() => {
    const geminiKey = keys.gemini;
    if (geminiKey) {
      const p = providerRegistry.get('gemini');
      if (p && 'fetchAvailableModels' in p && typeof (p as any).fetchAvailableModels === 'function') {
        (p as any).fetchAvailableModels(geminiKey).then((fetched: { id: string; name: string; description: string }[]) => {
          if (Array.isArray(fetched) && fetched.length > 0) {
            setDynamicModels((prev) => ({ ...prev, gemini: fetched }));
            const current = models.gemini;
            if (!fetched.some((m) => m.id === current)) {
              const best = fetched.find((m) => m.id.includes('3.8')) || fetched[0];
              if (best) {
                handleModelChange('gemini', best.id);
              }
            }
          }
        });
      }
    }
  }, []);

  const handleKeyChange = (provider: ProviderId, value: string) => {
    setKeys((prev) => ({ ...prev, [provider]: value }));
    providerKeyStore.setKey(provider, value);
    setTestStatus((prev) => ({ ...prev, [provider]: { state: 'idle' } }));

    // When Gemini key changes, dynamically fetch models for the new key
    if (provider === 'gemini' && value.trim()) {
      const p = providerRegistry.get('gemini');
      if (p && 'fetchAvailableModels' in p && typeof (p as any).fetchAvailableModels === 'function') {
        (p as any).fetchAvailableModels(value.trim()).then((fetched: { id: string; name: string; description: string }[]) => {
          if (Array.isArray(fetched) && fetched.length > 0) {
            setDynamicModels((prev) => ({ ...prev, gemini: fetched }));
            const best = fetched.find((m) => m.id.includes('3.8')) || fetched[0];
            if (best) {
              handleModelChange('gemini', best.id);
            }
          }
        });
      }
    }
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
        // If models were returned from the API key, update the dropdown!
        if ('models' in res && Array.isArray((res as any).models) && (res as any).models.length > 0) {
          const fetched = (res as any).models;
          setDynamicModels((prev) => ({ ...prev, [provider]: fetched }));
          const current = models[provider];
          if (!fetched.some((m: { id: string }) => m.id === current)) {
            const best = fetched.find((m: { id: string }) => m.id.includes('3.8')) || fetched[0];
            if (best) {
              handleModelChange(provider, best.id);
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

  const handleSavePreferences = async () => {
    await settingsService.updateSettings(user.id, {
      default_rounds: defaultRounds,
      default_moderator: defaultModerator,
      theme,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
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
          Manage your AI provider API keys, deliberation defaults, and system connections.
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
          <span>AI Providers (BYOK)</span>
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
          <span>Preferences & Theme</span>
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
                Your API keys are stored in browser session memory and used exclusively to send your prompts to the provider. Keys are NEVER saved to the Supabase database, disk, or logs.
              </p>
            </div>
          </div>

          {/* Provider Cards */}
          <div className="space-y-4">
            {/* 1. OpenAI */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">OpenAI</h3>
                    <p className="text-[11px] text-zinc-400">Designated Lead Analyst</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled.openai}
                      onChange={() => handleToggleEnabled('openai')}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Key Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    OpenAI API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey.openai ? 'text' : 'password'}
                      value={keys.openai}
                      onChange={(e) => handleKeyChange('openai', e.target.value)}
                      placeholder="sk-..."
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((prev) => ({ ...prev, openai: !prev.openai }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showKey.openai ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Model Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Model
                  </label>
                  <select
                    value={models.openai}
                    onChange={(e) => handleModelChange('openai', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {AVAILABLE_MODELS.openai.map((m: { id: string; name: string; description: string }) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions & Feedback */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('openai')}
                    disabled={testStatus.openai.state === 'testing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {testStatus.openai.state === 'testing' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Test Connection</span>
                  </button>

                  {keys.openai && (
                    <button
                      onClick={() => handleClearKey('openai')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      Clear Key
                    </button>
                  )}
                </div>

                {testStatus.openai.state === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Connection successful</span>
                  </span>
                )}

                {testStatus.openai.state === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{testStatus.openai.message || 'Connection failed'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 2. Gemini */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Google Gemini</h3>
                    <p className="text-[11px] text-zinc-400">Designated Alternative Analyst</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled.gemini}
                      onChange={() => handleToggleEnabled('gemini')}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey.gemini ? 'text' : 'password'}
                      value={keys.gemini}
                      onChange={(e) => handleKeyChange('gemini', e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((prev) => ({ ...prev, gemini: !prev.gemini }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showKey.gemini ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Model
                    </label>
                    {dynamicModels.gemini && dynamicModels.gemini.length > 0 && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Synced from API key
                      </span>
                    )}
                  </div>
                  <select
                    value={models.gemini}
                    onChange={(e) => handleModelChange('gemini', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {(dynamicModels.gemini?.length > 0 ? dynamicModels.gemini : AVAILABLE_MODELS.gemini).map(
                      (m: { id: string; name: string; description: string }) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.description}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('gemini')}
                    disabled={testStatus.gemini.state === 'testing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {testStatus.gemini.state === 'testing' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Test Connection</span>
                  </button>

                  {keys.gemini && (
                    <button
                      onClick={() => handleClearKey('gemini')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      Clear Key
                    </button>
                  )}
                </div>

                {testStatus.gemini.state === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Connection successful</span>
                  </span>
                )}

                {testStatus.gemini.state === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{testStatus.gemini.message || 'Connection failed'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 3. Claude */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Anthropic Claude</h3>
                    <p className="text-[11px] text-zinc-400">Designated Critical Reviewer</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled.claude}
                      onChange={() => handleToggleEnabled('claude')}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Anthropic API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey.claude ? 'text' : 'password'}
                      value={keys.claude}
                      onChange={(e) => handleKeyChange('claude', e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((prev) => ({ ...prev, claude: !prev.claude }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showKey.claude ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Model
                  </label>
                  <select
                    value={models.claude}
                    onChange={(e) => handleModelChange('claude', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {AVAILABLE_MODELS.claude.map((m: { id: string; name: string; description: string }) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('claude')}
                    disabled={testStatus.claude.state === 'testing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {testStatus.claude.state === 'testing' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Test Connection</span>
                  </button>

                  {keys.claude && (
                    <button
                      onClick={() => handleClearKey('claude')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      Clear Key
                    </button>
                  )}
                </div>

                {testStatus.claude.state === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Connection successful</span>
                  </span>
                )}

                {testStatus.claude.state === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{testStatus.claude.message || 'Connection failed'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 4. DeepSeek */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">DeepSeek</h3>
                    <p className="text-[11px] text-zinc-400">Deep Reasoning & Coding (DeepSeek-V3 / R1)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled.deepseek}
                      onChange={() => handleToggleEnabled('deepseek')}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    DeepSeek API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey.deepseek ? 'text' : 'password'}
                      value={keys.deepseek}
                      onChange={(e) => handleKeyChange('deepseek', e.target.value)}
                      placeholder="sk-..."
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((prev) => ({ ...prev, deepseek: !prev.deepseek }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showKey.deepseek ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Model
                  </label>
                  <select
                    value={models.deepseek}
                    onChange={(e) => handleModelChange('deepseek', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {AVAILABLE_MODELS.deepseek.map((m: { id: string; name: string; description: string }) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('deepseek')}
                    disabled={testStatus.deepseek.state === 'testing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {testStatus.deepseek.state === 'testing' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Test Connection</span>
                  </button>

                  {keys.deepseek && (
                    <button
                      onClick={() => handleClearKey('deepseek')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      Clear Key
                    </button>
                  )}
                </div>

                {testStatus.deepseek.state === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Connection successful</span>
                  </span>
                )}

                {testStatus.deepseek.state === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{testStatus.deepseek.message || 'Connection failed'}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 5. Groq */}
            <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Groq</h3>
                    <p className="text-[11px] text-zinc-400">Ultra-Fast LPU Inference (Llama 3.3 70B & 8B)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled.groq}
                      onChange={() => handleToggleEnabled('groq')}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
                    />
                    <span>Enabled</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Groq API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showKey.groq ? 'text' : 'password'}
                      value={keys.groq}
                      onChange={(e) => handleKeyChange('groq', e.target.value)}
                      placeholder="gsk_..."
                      className="w-full pl-3 pr-10 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((prev) => ({ ...prev, groq: !prev.groq }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      {showKey.groq ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Model
                  </label>
                  <select
                    value={models.groq}
                    onChange={(e) => handleModelChange('groq', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {AVAILABLE_MODELS.groq.map((m: { id: string; name: string; description: string }) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection('groq')}
                    disabled={testStatus.groq.state === 'testing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {testStatus.groq.state === 'testing' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    <span>Test Connection</span>
                  </button>

                  {keys.groq && (
                    <button
                      onClick={() => handleClearKey('groq')}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      Clear Key
                    </button>
                  )}
                </div>

                {testStatus.groq.state === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Connection successful</span>
                  </span>
                )}

                {testStatus.groq.state === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{testStatus.groq.message || 'Connection failed'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dedicated Save Action Bar for Providers */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Save AI Provider Configurations
              </p>
              <p className="text-[11px] text-zinc-500">
                Save active keys and selected models for OpenAI, Gemini, and Claude
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
          <div className="space-y-4">
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
                  <option value="gemini">Gemini (Alternative Perspectives)</option>
                  <option value="claude">Claude (Critical Edge-Case Weighting)</option>
                </select>
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
                    className={`py-2 px-3 rounded-xl border text-xs capitalize transition-all ${
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
              className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs hover:bg-zinc-800 transition-colors shadow-xs"
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
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
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
