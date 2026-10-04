import React, { useState } from 'react';
import {
  BrainCircuit,
  Shield,
  Loader2,
} from 'lucide-react';
import { authService } from '@/services/auth/authService';
import { UserProfile } from '@/types';

interface LoginProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.signInWithGoogle();
      if (!res.success) {
        setError(res.error || 'Failed to authenticate with Google');
      } else {
        const user = await authService.getCurrentUser();
        if (user) {
          onLoginSuccess(user);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      {/* Background radial gradient accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/15 blur-[120px] rounded-full" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-lg">
            <BrainCircuit className="w-7 h-7 text-indigo-400 dark:text-indigo-600" />
          </div>
        </div>

        <h1 className="text-center text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          AIHUB
        </h1>
        <p className="mt-2 text-center text-sm font-medium text-zinc-600 dark:text-zinc-400 tracking-wide uppercase">
          Multi-AI Discussion Platform
        </p>

        <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400 italic">
          &ldquo;One question. Multiple AI minds. One stronger conclusion.&rdquo;
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <div className="bg-white dark:bg-zinc-900 py-8 px-6 sm:px-10 shadow-xl border border-zinc-200/80 dark:border-zinc-800 rounded-2xl space-y-6">
          {error && (
            <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
              {error}
            </div>
          )}

          {/* Primary Action: Google Login */}
          <div className="space-y-3">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 font-semibold text-sm transition-all shadow-xs disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3">
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider text-center">
              Multi-AI Orchestration Engine
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">OpenAI</div>
                <div className="text-[10px] text-zinc-500">Lead Analyst</div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">Gemini</div>
                <div className="text-[10px] text-zinc-500">Alt Analyst</div>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">Claude</div>
                <div className="text-[10px] text-zinc-500">Critic Review</div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>BYOK: Your API keys are never stored on any server</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
