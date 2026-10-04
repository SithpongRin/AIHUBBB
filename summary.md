# AIHUB — Technical Architecture & Agent Reference Summary

This document provides a complete technical handover for future engineers and AI coding agents continuing development on **AIHUB**.

---

## 1. Project Overview

- **Project Name:** AIHUB
- **Product Designation:** Multi-AI Discussion Platform
- **Tagline:** One question. Multiple AI minds. One stronger conclusion.
- **Core Purpose:** Enable users to ask a single question or upload a technical task, then orchestrate an automatic multi-round debate between OpenAI, Google Gemini, Anthropic Claude, Groq, and DeepSeek. The platform synthesizes an authoritative consensus rather than displaying disjointed independent chatbot outputs.

---

## 2. Technology Stack

- **Frontend:**
  - React 19 + TypeScript
  - Vite 8
  - Tailwind CSS 4 (`@tailwindcss/vite`)
  - Lucide React (strictly no emojis in UI)
- **Backend & APIs:**
  - Vercel Serverless Functions:
    - `/api/provider/models.ts`: Dynamic model discovery proxy (Groq, Gemini, OpenAI, Claude, DeepSeek, Mock).
    - `/api/provider/test.ts`: Connection verification proxy.
    - `/api/discussion/round.ts`: Deliberation round executor.
    - `/api/discussion/finalize.ts`: Synthesis generation.
    - `/api/files/upload.ts`: File upload handler.
  - Native Fetch API with AbortController for cancelable requests.
  - Development Server Middleware: Integrated in `vite.config.ts` for zero-setup local dev serverless routing.
- **Database & Storage:**
  - Supabase PostgreSQL (with automatic triggers, foreign keys, and RLS)
  - Supabase Auth (Google OAuth)
  - Supabase Storage (`discussion-files` bucket)

---

## 3. Architecture & Data Flow

```text
User Question & Files
         │
         ▼
Discussion Orchestrator (`src/services/orchestrator/discussionOrchestrator.ts`)
         │
         ├──► Per-Provider Serialization Queue (`providerQueue.ts`)
         │    ├── OpenAI Queue (1 in-flight, configurable delay)
         │    ├── Gemini Queue (1 in-flight, configurable delay)
         │    ├── Claude Queue (1 in-flight, configurable delay)
         │    └── Groq Queue   (1 in-flight, configurable delay)
         │
         ├──► Round 1: Independent Analysis (Parallel across providers)
         │    ├── OpenAI (Lead Analyst)
         │    ├── Gemini (Alternative Analyst)
         │    ├── Claude (Critical Reviewer)
         │    └── Groq (Fast Synthesizer)
         │
         ├──► Round 2: Cross Review & Critique (Trimmed token history)
         │    └── Models evaluate & challenge each other's Round 1 arguments
         │
         ├──► Round 3: Final Debate & Risk Hardening
         │    └── Models resolve trade-offs and deliver definitive positions
         │
         └──► Final Synthesis
              └── Chosen AI Moderator produces structured verdict (notes any missing voices)
```

---

## 4. Bring Your Own Key (BYOK) & Security Model

1. **Zero Database Persistence:**
   - User AI API keys are **never** stored in Supabase tables, files, logs, or analytics.
   - Keys are held strictly in `sessionStorage` and browser memory via `src/services/providers/keyStore.ts`.
2. **Per-Request Dispatch:**
   - Keys are injected into request headers per call and immediately discarded once the response stream resolves.
3. **No Key Exposure in Errors:**
   - Provider errors are sanitized via `sanitizeMessage` in `withRetry.ts`. All raw API key patterns (`gsk_`, `sk-ant-`, `AIza`, `sk-`, Bearer tokens) are redacted before rendering or logging.
4. **Targeted Prefix Probing Only:**
   - `detectProvider.ts` only routes keys to candidate providers matched by prefix (`gsk_` -> Groq, `sk-ant-` -> Claude, `AIza` -> Gemini, etc.). Unrelated providers are never probed with candidate keys.

---

## 5. Provider Abstraction Interface & Dynamic Model Discovery

Defined in `src/services/providers/types.ts`:

```typescript
export interface ModelInfo {
  id: string;
  label?: string;
  description?: string;
}

export interface AIProvider {
  id: ProviderId; // 'openai' | 'gemini' | 'claude' | 'deepseek' | 'groq' | 'mock'
  name: string;
  description: string;
  defaultRoleName: string;
  defaultModel: string;
  validateConnection: (apiKey: string, model?: string) => Promise<{ success: boolean; error?: string }>;
  generateResponse: (request: ProviderRequest) => Promise<ProviderResponse>;
  listModels: (apiKey: string) => Promise<ModelInfo[]>;
}
```

Registered in `src/services/providers/registry.ts`:
- `OpenAIProvider`: Chat completions API with dynamic model discovery.
- `GeminiProvider`: Generative Language API with `generateContent` filtering.
- `ClaudeProvider`: Messages API with dynamic models discovery.
- `GroqProvider`: Ultra-fast inference on LPUs (Llama 3.3 70B, Mixtral, etc.).
- `DeepSeekProvider`: DeepSeek reasoning and chat models.
- `MockProvider`: Simulated AI engine for zero-cost offline testing and verification.

### Dynamic Discovery & Validation
- **Serverless Route `/api/provider/models.ts`**: Proxies model fetching to eliminate browser CORS obstacles.
- **Discussion Start Validation**: Orchestrator checks if the user's selected model is active in the provider's account. If obsolete or unavailable, it automatically switches to a sensible default (prioritizing `flash`, `instant`, `mini`, `haiku`) and displays a non-blocking toast.
- **Static Fallback**: `STATIC_FALLBACK_MODELS` is used only if dynamic discovery requests fail.

---

## 6. Rate Limit Handling, Retries, & Per-Provider Queues

1. **`withRetry` & `fetchWithRetry` (`src/services/providers/withRetry.ts`)**:
   - Automatically retries on HTTP 429 and 5xx errors (up to 3 attempts).
   - Exponential backoff with random jitter (2s, 4s, 8s, capped at 20s).
   - Honors HTTP `Retry-After` header (seconds or RFC date).
   - Fails fast on 400, 401, 403, 404 (model not found / invalid key).
   - Full `AbortController` cancellation support without sleeping through aborts.
2. **`ProviderQueue` (`src/services/orchestrator/providerQueue.ts`)**:
   - Enforces **at most 1 in-flight request per provider**.
   - Enforces a **configurable minimum gap** (default 1.5s, adjustable in Settings from 0.5s to 5.0s) between consecutive requests to the same provider.
   - Distinct providers run completely concurrently in parallel.
3. **Prompt Trimming (`src/services/orchestrator/prompts.ts`)**:
   - Trims history in Rounds 2 and 3 to bounded token budgets (1200-1600 characters per peer answer) to prevent hitting TPM/RPM rate limits.

---

## 7. Graceful Degradation & Fallback Strategy

1. **Partial Round Continuation**: If one provider fails after all retries, its card is marked as failed, but the discussion continues with the remaining models. The moderator is instructed to note the missing voice and synthesize the active models.
2. **Quota Lighter Model Fallback**: If a model hits quota during deliberation, the orchestrator automatically attempts the next lighter model from that provider's list (e.g., pro -> flash, 70b -> 8b/instant/mini) before failing.
3. **In-Place Message Retry**: Failed cards include a "Retry this response" button that re-executes only that specific failed message.
4. **Moderator Fallback**: If the chosen moderator fails, an alternate active participant automatically takes over synthesis.

---

## 8. Supabase Database Schema & RLS

Migrations are located in `supabase/migrations/20261004_init.sql`.

### Tables:
1. `profiles`: `(id UUID PK -> auth.users, email, full_name, avatar_url, created_at, updated_at)`
2. `discussions`: `(id UUID PK, user_id UUID -> profiles, title, question, status, participants, rounds, moderator, created_at, updated_at)`
3. `discussion_messages`: `(id UUID PK, discussion_id UUID -> discussions, round_number, provider, model, role, content, status, duration_ms, error_message, created_at)`
4. `user_settings`: `(id UUID PK, user_id UUID UNIQUE -> profiles, default_rounds, default_moderator, theme, request_delay_seconds, created_at, updated_at)`
5. `files`: `(id UUID PK, user_id UUID -> profiles, discussion_id UUID -> discussions, file_name, file_type, file_size, storage_path, extracted_text, created_at)`

---

## 9. File Structure Map

```text
/
├── .env.example
├── .gitignore
├── README.md
├── summary.md
├── index.html
├── metadata.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── api/
│   ├── discussion/
│   │   ├── round.ts
│   │   └── finalize.ts
│   ├── files/
│   │   └── upload.ts
│   └── provider/
│       ├── test.ts
│       └── models.ts
├── supabase/
│   ├── migrations/
│   │   └── 20261004_init.sql
│   └── seed.sql
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── types/
    │   └── index.ts
    ├── components/
    │   ├── layout/
    │   │   └── Navbar.tsx
    │   ├── chat/
    │   │   └── ModernChatWorkspace.tsx
    │   ├── discussion/
    │   │   ├── ResponseCard.tsx
    │   │   └── FinalSynthesisCard.tsx
    │   └── ui/
    │       └── MarkdownRenderer.tsx
    ├── pages/
    │   ├── Login.tsx
    │   ├── Dashboard.tsx
    │   ├── NewDiscussion.tsx
    │   ├── Discussion.tsx
    │   ├── History.tsx
    │   ├── Files.tsx
    │   └── Settings.tsx
    └── services/
        ├── auth/
        │   └── authService.ts
        ├── supabase/
        │   └── client.ts
        ├── discussions/
        │   └── discussionService.ts
        ├── files/
        │   └── fileService.ts
        ├── settings/
        │   └── settingsService.ts
        ├── providers/
        │   ├── types.ts
        │   ├── keyStore.ts
        │   ├── withRetry.ts
        │   ├── modelUtils.ts
        │   ├── detectProvider.ts
        │   ├── openaiProvider.ts
        │   ├── geminiProvider.ts
        │   ├── claudeProvider.ts
        │   ├── groqProvider.ts
        │   ├── deepseekProvider.ts
        │   ├── mockProvider.ts
        │   └── registry.ts
        └── orchestrator/
            ├── prompts.ts
            ├── parseSynthesis.ts
            ├── providerQueue.ts
            └── discussionOrchestrator.ts
```

---

## 10. Extension Points for Future Development

1. **Additional AI Providers:** Add a new prefix rule in `detectProvider.ts`, create a class implementing `AIProvider` in `src/services/providers/`, add its proxy handler to `api/provider/models.ts`, and register in `providerRegistry`.
2. **Streaming Support:** Extend `generateResponse` with an `onChunk` callback; the UI already tracks per-message state updates.
3. **Export Formats:** Add PDF/Markdown export utilities for the final synthesis transcript.
