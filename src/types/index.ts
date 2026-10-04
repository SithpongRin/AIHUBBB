export type ProviderId = 'openai' | 'gemini' | 'claude';

export type DiscussionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type MessageRole = 'analysis' | 'review' | 'debate' | 'final' | 'system';

export type MessageStatus = 'waiting' | 'thinking' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  default_rounds: number;
  default_moderator: ProviderId;
  theme: 'light' | 'dark' | 'system';
  created_at?: string;
  updated_at?: string;
}

export interface DiscussionFile {
  id: string;
  user_id: string;
  discussion_id?: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path?: string;
  extracted_text?: string;
  created_at: string;
}

export interface DiscussionMessage {
  id: string;
  discussion_id: string;
  round_number: number;
  provider: ProviderId;
  model: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  duration_ms?: number;
  error_message?: string;
  created_at: string;
}

export interface Discussion {
  id: string;
  user_id: string;
  title: string;
  question: string;
  status: DiscussionStatus;
  participants: ProviderId[];
  rounds: number;
  moderator: ProviderId;
  created_at: string;
  updated_at: string;
  messages?: DiscussionMessage[];
  files?: DiscussionFile[];
}

export interface ProviderModelInfo {
  id: string;
  name: string;
  description: string;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  enabled: boolean;
  apiKey: string;
  selectedModel: string;
  status: 'untested' | 'connected' | 'error';
  errorMessage?: string;
}

export interface FinalSynthesisSections {
  directAnswer?: string;
  keyReasoning?: string;
  pointsOfAgreement?: string;
  importantDisagreements?: string;
  bestConclusion?: string;
  practicalRecommendation?: string;
  remainingUncertainty?: string;
  rawText: string;
}
