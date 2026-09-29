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
    description?: string;
    publishedAt?: string;
    views?: number;
    /** ISO 8601 duration from the Data API, e.g. PT42M10S. */
    duration?: string;
    /** Set when the video was imported by a channel sync. */
    channelId?: string;
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
  /** YouTube channel the Auto section reads from (URL, @handle or channel ID). */
  channel?: { input: string; channelId?: string; title?: string; lastSyncedAt?: number; videoCount?: number; via?: 'api' | 'feed' };
  /** Latest Auto recommendations for this project. */
  ideas?: Idea[];
  ideasGoal?: string;
  ideasGeneratedAt?: number;
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
  /** Hard facts and parameters Claude must respect (season status, counts, dates, prices). */
  facts?: string;
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

export interface Idea {
  id: string;
  title: string;
  /** One of the format preset ids. */
  format: string;
  why: string;
  brief: string;
  facts?: string;
  tone?: string;
  audience?: string;
  length?: string;
  /** YouTube video IDs from the channel to use as sources. */
  videoIds: string[];
  /** Piece created from this idea, once made. */
  pieceId?: string;
}

export interface Settings {
  apiKey: string;
  /** Optional YouTube Data API key: unlocks full channel history and stats. */
  youtubeApiKey?: string;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  syncIntervalSec: number;
}
