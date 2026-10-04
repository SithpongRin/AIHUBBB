# AIHUB — Multi-AI Discussion Platform

> **One question. Multiple AI minds. One stronger conclusion.**

AIHUB is a modern multi-AI deliberation workspace where a user inputs **one** question, architectural dilemma, document analysis, or problem, and multiple frontier AI models automatically analyze, critique, debate, and synthesize it together.

Users no longer need to manually copy and paste prompts and outputs between ChatGPT, Google Gemini, and Anthropic Claude. AIHUB serves as the orchestrator passing verified arguments between AI models across multiple structured rounds to produce an authoritative synthesized verdict.

---

## Architecture Flow

```text
                    User Question
                          │
                          ▼
                  Discussion Engine
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     OpenAI (Lead)  Gemini (Alt)    Claude (Critic)
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                    Cross Review
                          │
                          ▼
                        Debate
                          │
                          ▼
                  Final AI Moderator
                          │
                          ▼
                    Final Answer
```

---

## Key Features

- **Supabase Authentication with Google OAuth**: Fast, secure user login with user profile synchronization.
- **Supabase PostgreSQL & Storage**: Strict Row Level Security (RLS) guaranteeing users only access their own discussions, files, and settings.
- **Bring Your Own Key (BYOK)**: No centralized AI API fees or shared tokens. Users provide their own OpenAI, Gemini, and Claude API keys.
- **Zero-Persistence Key Security**: API keys reside solely in browser session memory and are dispatched via HTTPS only for execution. Keys are **never** stored in the Supabase database, disk, logs, or analytics.
- **Provider Abstraction Architecture**: Standardized provider interface (`AIProvider`) decoupling the discussion UI from model-specific SDK nuances; easily extensible to DeepSeek, Mistral, Grok, etc.
- **Specialized AI Roles**:
  - **OpenAI (Lead Analyst)**: Builds initial solutions, identifies core assumptions, and establishes foundational models.
  - **Gemini (Alternative Analyst)**: Explores alternative paradigms, challenges defaults, and identifies blind spots.
  - **Claude (Critical Reviewer)**: Uncovers subtle vulnerabilities, stress-tests edge cases, and critiques trade-offs.
- **Three-Stage Deliberation Engine**:
  - **Round 1 (Independent Analysis)**: Parallel analysis without cross-model visibility.
  - **Round 2 (Cross Review)**: Peer critique where each model challenges other models' arguments.
  - **Round 3 (Final Debate)**: Consolidation of positions, trade-off analysis, and final defenses.
- **Final AI Moderator Synthesis**:
  - Direct Answer
  - Key Reasoning
  - Points of Agreement
  - Important Disagreements & Trade-offs
  - Best Conclusion
  - Practical Recommendation
  - Remaining Uncertainty
- **Document Attachments (Untrusted Input Sandboxing)**:
  - Upload PDF, TXT, MD, CSV, DOCX.
  - Text extraction with strict prompt isolation to neutralize prompt injection risks.
- **Simulated AI Engine (Mock Mode)**: Zero-cost offline testing mode to validate multi-round workflows without consuming real API credits.
- **Theme Support**: Seamless Light, Dark, and System mode switching.
- **Responsive Workspace**: Mobile-first layout designed for smartphones, tablets, and wide displays.

---

## Local Development

### 1. Install Dependencies

```bash
npm install
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

## Supabase Database & Auth Setup

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Authentication -> Providers** and enable **Google**. Configure your Google Cloud OAuth Client ID and Secret.
3. Open the **SQL Editor** in your Supabase dashboard.
4. Execute the SQL script located in:
   ```text
   supabase/migrations/20261004_init.sql
   ```
   This creates:
   - `profiles` table with automatic user signup trigger.
   - `discussions` table with foreign key cascading.
   - `discussion_messages` table scoped to discussion ownership.
   - `user_settings` table (never stores keys).
   - `files` table for document attachments.
   - Complete Row Level Security (RLS) policies for all tables.
5. Create a storage bucket named `discussion-files` in **Storage**.

---

## Bring Your Own Key (BYOK) Security

AIHUB enforces zero-trust credential hygiene:

- API keys are **never** committed to Git or pushed to GitHub.
- API keys are **never** stored in Supabase database tables or file storage.
- API keys are held strictly in memory / session storage and sent directly to provider APIs (or Vercel Serverless proxy).
- Users can clear their keys at any time from **Settings -> AI Providers**.

---

## GitHub & Vercel Deployment

### Pushing to GitHub

```bash
git init
git add .
git commit -m "feat: AIHUB multi-AI deliberation platform"
git branch -M main
git remote add origin https://github.com/<your-username>/aihub.git
git push -u origin main
```

### Deploying to Vercel

AIHUB is engineered to be deployed through Vercel:

1. Import your GitHub repository into Vercel.
2. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Click **Deploy**. Vercel will automatically build the React Vite application and deploy the API endpoints in `/api/`.

---

## License

Apache-2.0
