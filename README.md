# AIHUB — Multi-AI Discussion Platform

> **One question. Multiple AI minds. One stronger conclusion.**

AIHUB is a modern multi-AI deliberation workspace where a user inputs **one** question, architectural dilemma, document analysis, or problem, and multiple frontier AI models automatically analyze, critique, debate, and synthesize it together.

Users no longer need to manually copy and paste prompts and outputs between ChatGPT, Google Gemini, Anthropic Claude, and Groq. AIHUB serves as the orchestrator passing verified arguments between AI models across multiple structured rounds to produce an authoritative synthesized verdict.

---

## Architecture Flow

```text
                                User Question
                                      │
                                      ▼
                           Deliberation Orchestrator
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
   OpenAI (Lead)                Gemini (Alt)                 Groq / Claude
   [Per-Provider Queue]         [Per-Provider Queue]         [Per-Provider Queue]
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                      ▼
                            Round 2: Cross Review
                           (Trimmed token budgets)
                                      │
                                      ▼
                            Round 3: Final Debate
                                      │
                                      ▼
                             Final AI Moderator
                     (Synthesizes & notes missing voices)
                                      │
                                      ▼
                              Consensus Answer
```

---

## Key Features

- **Dynamic Model Discovery (`listModels`)**:
  - Connects to Groq, Gemini, OpenAI, Claude, and DeepSeek via serverless proxy (`/api/provider/models.ts`).
  - Fetches the exact real models accessible by your API key and presents an intuitive dropdown in Settings.
  - Discussion starts automatically validate selected models against active lists, auto-selecting sensible defaults (prioritizing `flash`, `instant`, `mini`, `haiku`) if a model is deprecated or unavailable.
- **Auto-Detect Provider from API Key**:
  - Type or paste an API key into the single "Add API key" input.
  - Automatically identifies the provider by key prefix (`gsk_` -> Groq, `sk-ant-` -> Claude, `AIza` -> Gemini, `sk-` -> OpenAI/DeepSeek).
  - Strict security: only queries candidate providers matched by the prefix.
- **Rate Limit & Quota Resilience (`withRetry`)**:
  - Exponential backoff with random jitter (2s, 4s, 8s, up to 20s) for HTTP 429 and 5xx errors.
  - Respects HTTP `Retry-After` response headers.
  - Fails fast on 400, 401, 403, and 404 with friendly, sanitized messages.
  - Supports cancelable `AbortController` execution without sleep lag.
- **Per-Provider Serialization Queue**:
  - Enforces at most 1 in-flight request per provider with a configurable request delay (default 1.5s, adjustable from 0.5s to 5.0s in Preferences).
  - Independent providers run concurrently in full parallel without blocking one another.
- **Graceful Fallback & In-Place Retry**:
  - If a provider fails after retries, deliberation continues with active models while the moderator notes the missing voice.
  - Automatic quota fallback to lighter models (e.g. Pro -> Flash, 70B -> 8B/instant) before giving up.
  - "Retry this response" button on failed cards to regenerate specific messages directly in the thread.
- **Bring Your Own Key (BYOK) Security**:
  - API keys reside solely in browser session memory and are dispatched via HTTPS only for execution.
  - Keys are **never** stored in Supabase database tables, disk, logs, or analytics.
- **Specialized AI Roles**:
  - **OpenAI (Lead Analyst)**: Builds initial solutions, identifies core assumptions, and establishes foundational models.
  - **Gemini (Alternative Analyst)**: Explores alternative paradigms, challenges defaults, and identifies blind spots.
  - **Claude (Critical Reviewer)**: Uncovers subtle vulnerabilities, stress-tests edge cases, and critiques trade-offs.
  - **Groq (Fast Synthesizer)**: High-throughput LPU inference using Meta Llama 3.3 and Mixtral.
  - **DeepSeek (Deep Reasoning Specialist)**: Algorithmic and architectural analysis using DeepSeek-V3 and R1.
  - **Mock AI (Simulation Engine)**: Zero-cost simulated offline mode for testing and development.
- **Document Attachments (Untrusted Input Sandboxing)**:
  - Upload PDF, TXT, MD, CSV, DOCX.
  - Text extraction with strict prompt isolation to neutralize prompt injection risks.
- **Theme Support**: Seamless Light, Dark, and System mode switching.
- **Strict UI Cleanliness**: No emojis in UI (exclusively Lucide icons).

---

## Local Development

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure your Supabase credentials:

```env
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key"
```

*(Note: AIHUB will automatically activate local demo mode if Supabase credentials are not yet configured, allowing instant exploration.)*

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Bring Your Own Key (BYOK) Security

AIHUB enforces zero-trust credential hygiene:

- API keys are **never** committed to Git or pushed to GitHub.
- API keys are **never** stored in Supabase database tables or file storage.
- API keys are held strictly in session storage and sent directly to provider APIs (or Vercel Serverless proxy).
- Users can clear their keys at any time from **Settings -> AI Providers**.

---

## License

Apache-2.0
