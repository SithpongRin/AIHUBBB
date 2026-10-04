import { Discussion, DiscussionMessage, DiscussionStatus, ProviderId } from '@/types';
import { isSupabaseConfigured, supabase } from '../supabase/client';

const LOCAL_DISCUSSIONS_KEY = 'aihub_local_discussions';

export class DiscussionService {
  private getLocalDiscussions(): Discussion[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(LOCAL_DISCUSSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setLocalDiscussions(discussions: Discussion[]): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(LOCAL_DISCUSSIONS_KEY, JSON.stringify(discussions));
      } catch {
        // ignore
      }
    }
  }

  public async getDiscussions(userId: string): Promise<Discussion[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('discussions')
          .select('*, discussion_messages(*), files(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((d) => ({
            ...d,
            messages: d.discussion_messages || [],
            files: d.files || [],
          }));
        }
      } catch (err) {
        console.error('Supabase getDiscussions failed:', err);
      }
    }

    return this.getLocalDiscussions().filter((d) => d.user_id === userId);
  }

  public async getDiscussionById(id: string): Promise<Discussion | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('discussions')
          .select('*, discussion_messages(*), files(*)')
          .eq('id', id)
          .single();

        if (!error && data) {
          return {
            ...data,
            messages: (data.discussion_messages || []).sort(
              (a: DiscussionMessage, b: DiscussionMessage) =>
                a.round_number - b.round_number ||
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            ),
            files: data.files || [],
          };
        }
      } catch (err) {
        console.error('Supabase getDiscussionById failed:', err);
      }
    }

    const localList = this.getLocalDiscussions();
    return localList.find((d) => d.id === id) || null;
  }

  public async createDiscussion(params: {
    userId: string;
    title: string;
    question: string;
    participants: ProviderId[];
    rounds: number;
    moderator: ProviderId;
  }): Promise<Discussion> {
    const newDiscussion: Discussion = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'disc-' + Date.now(),
      user_id: params.userId,
      title: params.title,
      question: params.question,
      status: 'pending',
      participants: params.participants,
      rounds: params.rounds,
      moderator: params.moderator,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [],
      files: [],
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('discussions').insert({
          id: newDiscussion.id,
          user_id: newDiscussion.user_id,
          title: newDiscussion.title,
          question: newDiscussion.question,
          status: newDiscussion.status,
          participants: newDiscussion.participants,
          rounds: newDiscussion.rounds,
          moderator: newDiscussion.moderator,
        });
        if (error) {
          console.error('Error inserting discussion into Supabase:', error);
        }
      } catch (err) {
        console.error('Supabase createDiscussion error:', err);
      }
    }

    // Always keep local list up to date as well
    const list = this.getLocalDiscussions();
    list.unshift(newDiscussion);
    this.setLocalDiscussions(list);

    return newDiscussion;
  }

  public async updateDiscussionStatus(id: string, status: DiscussionStatus): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('discussions')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);
      } catch (err) {
        console.error('Supabase updateDiscussionStatus error:', err);
      }
    }

    const list = this.getLocalDiscussions();
    const target = list.find((d) => d.id === id);
    if (target) {
      target.status = status;
      target.updated_at = new Date().toISOString();
      this.setLocalDiscussions(list);
    }
  }

  public async saveMessage(message: DiscussionMessage): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('discussion_messages').upsert({
          id: message.id,
          discussion_id: message.discussion_id,
          round_number: message.round_number,
          provider: message.provider,
          model: message.model,
          role: message.role,
          content: message.content,
          status: message.status,
          duration_ms: message.duration_ms || 0,
          error_message: message.error_message || null,
        });
      } catch (err) {
        console.error('Supabase saveMessage error:', err);
      }
    }

    const list = this.getLocalDiscussions();
    const target = list.find((d) => d.id === message.discussion_id);
    if (target) {
      if (!target.messages) target.messages = [];
      const mIdx = target.messages.findIndex((m: DiscussionMessage) => m.id === message.id);
      if (mIdx !== -1) {
        target.messages[mIdx] = message;
      } else {
        target.messages.push(message);
      }
      target.updated_at = new Date().toISOString();
      this.setLocalDiscussions(list);
    }
  }

  public async deleteDiscussion(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('discussions').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase deleteDiscussion error:', err);
      }
    }

    const list = this.getLocalDiscussions().filter((d) => d.id !== id);
    this.setLocalDiscussions(list);
  }
}

export const discussionService = new DiscussionService();
