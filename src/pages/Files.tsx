import React, { useEffect, useState } from 'react';
import {
  FolderOpen,
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  FileCheck,
  CheckCircle,
  Database,
} from 'lucide-react';
import { DiscussionFile, UserProfile } from '@/types';
import { fileService } from '@/services/files/fileService';

interface FilesProps {
  user: UserProfile;
}

export const FilesView: React.FC<FilesProps> = ({ user }) => {
  const [files, setFiles] = useState<DiscussionFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<DiscussionFile | null>(null);

  useEffect(() => {
    let mounted = true;
    fileService.getUserFiles(user.id).then((data: DiscussionFile[]) => {
      if (mounted) {
        setFiles(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [user.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files;
    if (!uploaded || uploaded.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (let i = 0; i < uploaded.length; i++) {
        const file = uploaded[i];
        const record = await fileService.uploadFile(user.id, file);
        setFiles((prev) => [record, ...prev]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this file?')) {
      await fileService.deleteFile(id);
      setFiles(files.filter((f) => f.id !== id));
      if (selectedFileForPreview?.id === id) {
        setSelectedFileForPreview(null);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Reference Files & Documents
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Uploaded materials attached to discussions are treated strictly as untrusted reference data.
          </p>
        </div>

        <label className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs hover:bg-zinc-800 transition-all shadow-xs">
          <Upload className="w-3.5 h-3.5" />
          <span>{uploading ? 'Processing File...' : 'Upload Document'}</span>
          <input
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv,.docx,.json"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Grid: Files List + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: File List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="p-12 text-center text-xs text-zinc-500">
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl space-y-3">
              <FolderOpen className="w-8 h-8 text-zinc-400 mx-auto" />
              <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                No documents uploaded
              </h3>
              <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                Attach technical documentation, architecture specs, or benchmarks to let multiple AI models critique them.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
              {files.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedFileForPreview(f)}
                  className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                    selectedFileForPreview?.id === f.id
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {f.file_name}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                        <span>{Math.round(f.file_size / 1024)} KB</span>
                        <span>•</span>
                        <span>{new Date(f.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(f.id);
                      }}
                      className="p-1.5 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Extracted Content Preview */}
        <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Document Preview
            </h3>
            {selectedFileForPreview && (
              <span className="text-[10px] text-zinc-400 font-mono">
                {selectedFileForPreview.file_name}
              </span>
            )}
          </div>

          {selectedFileForPreview ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-h-[420px] overflow-y-auto">
                <pre className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {selectedFileForPreview.extracted_text || '[No text extracted]'}
                </pre>
              </div>
              <p className="text-[11px] text-zinc-400">
                Security Sandbox: Document text is injected into AI prompts with strict instruction-ignore boundaries.
              </p>
            </div>
          ) : (
            <div className="py-20 text-center text-xs text-zinc-400">
              Select a document to inspect its extracted text representation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
