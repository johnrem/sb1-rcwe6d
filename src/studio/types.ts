export type SourceKind = 'text' | 'image' | 'pdf' | 'youtube' | 'note' | 'unsupported';

export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  /** Text content (file text, pasted note, YouTube transcript). */
  text?: string;
  /** Binary content for images / PDFs. */
  blob?: Blob;
  mimeType?: string;
  /** Where this came from: a synced folder, a manual upload, YouTube, or a note. */
  origin: 'folder' | 'upload' | 'youtube' | 'note';
  folderId?: string;
  /** Path relative to the synced folder root. */
  path?: string;
  lastModified?: number;
  size?: number;
  /** Set when a synced file disappears from its folder. */
  missing?: boolean;
  url?: string;
  youtube?: {
    videoId: string;
    author?: string;
    thumbnail: string;
  };
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SyncedFolder {
  id: string;
  name: string;
  /** Present only when the browser supports the File System Access API. */
  handle?: FileSystemDirectoryHandle;
  autoSync: boolean;
  lastSyncedAt?: number;
  fileCount: number;
}

export interface Project {
  id: string;
  name: string;
  /** Standing guidance sent with every generation: brand voice, product facts, do/don't. */
  guidelines: string;
  createdAt: number;
  updatedAt: number;
}

export interface SourceRef {
  sourceId: string;
  /** Optional instruction about how to use this source ("use the pricing only"). */
  note?: string;
}

export interface Piece {
  id: string;
  projectId: string;
  title: string;
  format: string;
  brief: string;
  tone: string;
  audience: string;
  length: string;
  sources: SourceRef[];
  body: string;
  createdAt: number;
  updatedAt: number;
}

export type VersionOrigin = 'manual' | 'generate' | 'refine' | 'restore' | 'before-generate' | 'duplicate';

export interface Version {
  id: string;
  pieceId: string;
  body: string;
  label: string;
  origin: VersionOrigin;
  starred: boolean;
  createdAt: number;
  meta?: {
    model?: string;
    brief?: string;
    instruction?: string;
    sourceTitles?: string[];
  };
}

export interface Settings {
  apiKey: string;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  syncIntervalSec: number;
}
