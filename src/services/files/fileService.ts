import { DiscussionFile } from '@/types';
import { isSupabaseConfigured, supabase } from '../supabase/client';

const LOCAL_FILES_KEY = 'aihub_local_files';

export class FileService {
  private getLocalFiles(): DiscussionFile[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(LOCAL_FILES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private setLocalFiles(files: DiscussionFile[]): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(files));
      } catch {
        // ignore
      }
    }
  }

  public async extractTextFromFile(file: File): Promise<string> {
    const fileType = file.type || '';
    const name = file.name.toLowerCase();

    // Plain text formats
    if (
      fileType.startsWith('text/') ||
      name.endsWith('.txt') ||
      name.endsWith('.md') ||
      name.endsWith('.csv') ||
      name.endsWith('.json')
    ) {
      const text = await file.text();
      return text.slice(0, 50000); // 50KB limit per file
    }

    // For PDF / Binary docx, extract readable alphanumeric character streams
    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let text = '';
      for (let i = 0; i < bytes.length && text.length < 50000; i++) {
        const char = bytes[i];
        if ((char >= 32 && char <= 126) || char === 10 || char === 13) {
          text += String.fromCharCode(char);
        } else if (text.length > 0 && text[text.length - 1] !== ' ') {
          text += ' ';
        }
      }
      const cleaned = text.replace(/\s+/g, ' ').trim();
      return cleaned.slice(0, 50000);
    } catch {
      return `[File ${file.name} uploaded, raw text extraction limited]`;
    }
  }

  public async uploadFile(
    userId: string,
    file: File,
    discussionId?: string
  ): Promise<DiscussionFile> {
    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error(`File ${file.name} exceeds the 5MB size limit.`);
    }

    const extractedText = await this.extractTextFromFile(file);
    const fileId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'file-' + Date.now();
    const storagePath = `${userId}/${fileId}-${file.name}`;

    const record: DiscussionFile = {
      id: fileId,
      user_id: userId,
      discussion_id: discussionId,
      file_name: file.name,
      file_type: file.type || 'application/octet-stream',
      file_size: file.size,
      storage_path: storagePath,
      extracted_text: extractedText,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        // Upload to storage bucket
        await supabase.storage.from('discussion-files').upload(storagePath, file, {
          upsert: true,
        });

        // Insert metadata record into files table
        await supabase.from('files').insert({
          id: record.id,
          user_id: record.user_id,
          discussion_id: record.discussion_id || null,
          file_name: record.file_name,
          file_type: record.file_type,
          file_size: record.file_size,
          storage_path: record.storage_path,
          extracted_text: record.extracted_text,
        });
      } catch (err) {
        console.error('Supabase file upload error:', err);
      }
    }

    const localList = this.getLocalFiles();
    localList.unshift(record);
    this.setLocalFiles(localList);

    return record;
  }

  public async getUserFiles(userId: string): Promise<DiscussionFile[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('files')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as DiscussionFile[];
        }
      } catch (err) {
        console.error('Supabase getUserFiles error:', err);
      }
    }

    return this.getLocalFiles().filter((f) => f.user_id === userId);
  }

  public async linkFileToDiscussion(fileId: string, discussionId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('files')
          .update({ discussion_id: discussionId })
          .eq('id', fileId);
      } catch (err) {
        console.error('Supabase linkFileToDiscussion error:', err);
      }
    }

    const list = this.getLocalFiles();
    const idx = list.findIndex((f) => f.id === fileId);
    if (idx !== -1) {
      list[idx].discussion_id = discussionId;
      this.setLocalFiles(list);
    }
  }

  public async getDiscussionFiles(discussionId: string): Promise<DiscussionFile[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('files')
          .select('*')
          .eq('discussion_id', discussionId);

        if (!error && data) {
          return data as DiscussionFile[];
        }
      } catch (err) {
        console.error('Supabase getDiscussionFiles error:', err);
      }
    }

    return this.getLocalFiles().filter((f) => f.discussion_id === discussionId);
  }

  public async deleteFile(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('files').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase deleteFile error:', err);
      }
    }

    const list = this.getLocalFiles().filter((f) => f.id !== id);
    this.setLocalFiles(list);
  }
}

export const fileService = new FileService();
