import { getAll, putMany, uid } from './db';
import type { Source, SourceKind, SyncedFolder } from './types';

const TEXT_EXT = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'srt', 'vtt', 'yaml', 'yml', 'rtf'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_BLOB_BYTES = 20 * 1024 * 1024;
const SKIP_DIRS = new Set(['node_modules', '.git', '.DS_Store', '__MACOSX']);

export const supportsFolderAccess = () => typeof window !== 'undefined' && !!window.showDirectoryPicker;

function ext(name: string) {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i + 1).toLowerCase();
}

export function kindForFile(name: string, type: string): SourceKind {
  const e = ext(name);
  if (IMAGE_EXT.includes(e) || ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type)) return 'image';
  if (type === 'application/pdf' || e === 'pdf') return 'pdf';
  if (type.startsWith('text/') || TEXT_EXT.includes(e)) return 'text';
  return 'unsupported';
}

function stripSubtitles(text: string, e: string) {
  if (e !== 'srt' && e !== 'vtt') return text;
  return text
    .split('\n')
    .filter((l) => l.trim() && !/^\d+$/.test(l.trim()) && !l.includes('-->') && !l.startsWith('WEBVTT'))
    .join(' ');
}

/** Read a File into the content fields of a Source. */
export async function readFileContent(file: File): Promise<Pick<Source, 'kind' | 'text' | 'blob' | 'mimeType' | 'size' | 'lastModified'>> {
  const kind = kindForFile(file.name, file.type);
  const base = { kind, mimeType: file.type || undefined, size: file.size, lastModified: file.lastModified };
  if (kind === 'text') {
    if (file.size > MAX_TEXT_BYTES) return { ...base, text: (await file.slice(0, MAX_TEXT_BYTES).text()) + '\n…[truncated]' };
    return { ...base, text: stripSubtitles(await file.text(), ext(file.name)) };
  }
  if ((kind === 'image' || kind === 'pdf') && file.size <= MAX_BLOB_BYTES) {
    return { ...base, blob: file, mimeType: file.type || (kind === 'pdf' ? 'application/pdf' : `image/${ext(file.name)}`) };
  }
  return { ...base, kind: 'unsupported' };
}

export async function sourceFromFile(file: File, extra: Partial<Source> = {}): Promise<Source> {
  const now = Date.now();
  return {
    id: uid(),
    title: file.name,
    origin: 'upload',
    tags: [],
    createdAt: now,
    updatedAt: now,
    ...(await readFileContent(file)),
    ...extra,
  };
}

async function* walk(dir: FileSystemDirectoryHandle, prefix = ''): AsyncGenerator<{ path: string; handle: FileSystemFileHandle }> {
  for await (const entry of dir.values()) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') yield* walk(entry as FileSystemDirectoryHandle, path);
    else yield { path, handle: entry as FileSystemFileHandle };
  }
}

export async function ensurePermission(folder: SyncedFolder, prompt: boolean): Promise<boolean> {
  const h = folder.handle;
  if (!h) return false;
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: 'read' })) === 'granted') return true;
  if (!prompt || !h.requestPermission) return false;
  return (await h.requestPermission({ mode: 'read' })) === 'granted';
}

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
  total: number;
}

/**
 * Scan a synced folder and reconcile it with the stored sources:
 * new files are added, changed files (by lastModified/size) are re-read,
 * and files that vanished are flagged `missing` (kept so pieces don't lose references).
 */
export async function syncFolder(folder: SyncedFolder): Promise<SyncResult> {
  if (!folder.handle) throw new Error('This folder was imported once and cannot be re-scanned. Re-import it to pick up changes.');
  const existing = (await getAll('sources')).filter((s) => s.folderId === folder.id);
  const byPath = new Map(existing.map((s) => [s.path!, s]));
  const seen = new Set<string>();
  const writes: Source[] = [];
  let added = 0;
  let updated = 0;

  for await (const { path, handle } of walk(folder.handle)) {
    seen.add(path);
    const file = await handle.getFile();
    const prev = byPath.get(path);
    if (prev && !prev.missing && prev.lastModified === file.lastModified && prev.size === file.size) continue;
    const content = await readFileContent(file);
    const now = Date.now();
    if (prev) {
      writes.push({ ...prev, ...content, missing: false, updatedAt: now });
      updated++;
    } else {
      writes.push({
        id: uid(),
        title: file.name,
        origin: 'folder',
        folderId: folder.id,
        path,
        tags: [folder.name],
        createdAt: now,
        updatedAt: now,
        ...content,
      });
      added++;
    }
  }

  let removed = 0;
  for (const s of existing) {
    if (!seen.has(s.path!) && !s.missing) {
      writes.push({ ...s, missing: true, updatedAt: Date.now() });
      removed++;
    }
  }
  await putMany('sources', writes);
  return { added, updated, removed, total: seen.size };
}

/** Fallback for browsers without showDirectoryPicker: a one-time import from <input webkitdirectory>. */
export async function importFileList(files: FileList, folder: SyncedFolder): Promise<Source[]> {
  const out: Source[] = [];
  for (const file of Array.from(files)) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const path = rel.split('/').slice(1).join('/') || file.name;
    if (path.split('/').some((p) => p.startsWith('.') || SKIP_DIRS.has(p))) continue;
    out.push(await sourceFromFile(file, { origin: 'folder', folderId: folder.id, path, tags: [folder.name] }));
  }
  await putMany('sources', out);
  return out;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Downscale images so they fit the API's recommended size and keep requests small. */
export async function imageForApi(blob: Blob, maxEdge = 1568): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && blob.size < 3_500_000 && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(blob.type)) {
    bitmap.close();
    return { data: await blobToBase64(blob), mediaType: blob.type as 'image/jpeg' };
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const out = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.88));
  return { data: await blobToBase64(out), mediaType: 'image/jpeg' };
}
