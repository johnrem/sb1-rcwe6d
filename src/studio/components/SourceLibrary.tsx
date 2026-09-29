import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  FileQuestion,
  FileText,
  FolderOpen,
  FolderSync,
  Image as ImageIcon,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
  Upload,
  Youtube,
  FileType2,
} from 'lucide-react';
import type { Studio } from '../useStudio';
import type { Source, SourceKind, SyncedFolder } from '../types';
import { uid } from '../db';
import { importFileList, sourceFromFile, supportsFolderAccess } from '../files';
import { NoteModal, SourcePreviewModal, YouTubeModal } from './SourceModals';
import { timeAgo, useObjectUrl } from '../util';

const KIND_ICON: Record<SourceKind, typeof FileText> = {
  text: FileText,
  image: ImageIcon,
  pdf: FileType2,
  youtube: Youtube,
  note: StickyNote,
  unsupported: FileQuestion,
};

const FILTERS: { id: 'all' | 'attached' | SourceKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'attached', label: 'In use' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Images' },
  { id: 'pdf', label: 'PDF' },
  { id: 'note', label: 'Notes' },
];

function Thumb({ source }: { source: Source }) {
  const url = useObjectUrl(source.kind === 'image' ? source.blob : undefined);
  const Icon = KIND_ICON[source.kind];
  if (source.youtube) return <img src={source.youtube.thumbnail} alt="" className="h-9 w-14 flex-none rounded-md object-cover" />;
  if (url) return <img src={url} alt="" className="h-9 w-14 flex-none rounded-md object-cover" />;
  const tint = source.kind === 'note' ? 'bg-amber-50 text-amber-600' : source.kind === 'pdf' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500';
  return (
    <div className={`flex h-9 w-14 flex-none items-center justify-center rounded-md ${tint}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

function FolderRow({ folder, studio }: { folder: SyncedFolder; studio: Studio }) {
  const status = studio.folderStatus[folder.id];
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 flex-none text-indigo-500" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-800">{folder.name}</div>
          <div className="truncate text-[11px] text-slate-500">
            {status?.state === 'syncing'
              ? 'Scanning…'
              : status?.state === 'needs-permission'
                ? 'Click the key to reconnect'
                : status?.state === 'error'
                  ? status.message
                  : `${folder.fileCount} files${folder.lastSyncedAt ? ` · synced ${timeAgo(folder.lastSyncedAt)}` : ''}${status?.message ? ` · ${status.message}` : ''}`}
            {!folder.handle && ' · one-time import'}
          </div>
        </div>
        {folder.handle && status?.state === 'needs-permission' && (
          <button title="Grant access again" onClick={() => studio.runSync(folder, true)} className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50">
            <KeyRound className="h-3.5 w-3.5" />
          </button>
        )}
        {folder.handle && (
          <button title="Sync now" onClick={() => studio.runSync(folder, true)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            {status?.state === 'syncing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        )}
        <button title="Remove folder" onClick={() => setConfirm((c) => !c)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {folder.handle && (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
          <input type="checkbox" className="h-3.5 w-3.5 rounded accent-indigo-600" checked={folder.autoSync} onChange={(e) => studio.updateFolder({ ...folder, autoSync: e.target.checked })} />
          Auto-sync every {studio.settings.syncIntervalSec}s
        </label>
      )}
      {confirm && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          <button className="rounded-md bg-slate-100 px-2 py-1 hover:bg-slate-200" onClick={() => studio.removeFolder(folder, false)}>
            Stop syncing, keep files
          </button>
          <button className="rounded-md bg-rose-50 px-2 py-1 text-rose-700 hover:bg-rose-100" onClick={() => studio.removeFolder(folder, true)}>
            Remove folder & its files
          </button>
        </div>
      )}
    </div>
  );
}

export function SourceLibrary({ studio }: { studio: Studio }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<'youtube' | 'note' | null>(null);
  const [preview, setPreview] = useState<Source | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);
  const { piece } = studio;
  const attached = useMemo(() => new Set(piece?.sources.map((r) => r.sourceId)), [piece]);

  const list = useMemo(() => {
    const q = query.toLowerCase();
    return studio.sources
      .filter((s) => (filter === 'all' ? true : filter === 'attached' ? attached.has(s.id) : s.kind === filter))
      .filter((s) => !q || [s.title, s.path, s.text?.slice(0, 5000), ...s.tags].some((f) => f?.toLowerCase().includes(q)))
      .sort((a, b) => Number(attached.has(b.id)) - Number(attached.has(a.id)) || b.updatedAt - a.updatedAt);
  }, [studio.sources, query, filter, attached]);

  const toggle = (s: Source) => {
    if (!piece) return;
    const sources = attached.has(s.id) ? piece.sources.filter((r) => r.sourceId !== s.id) : [...piece.sources, { sourceId: s.id }];
    studio.updatePiece(piece.id, { sources });
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = await Promise.all(Array.from(files).map((f) => sourceFromFile(f)));
    await studio.addSources(list);
    if (piece) studio.updatePiece(piece.id, { sources: [...piece.sources, ...list.map((s) => ({ sourceId: s.id }))] });
  };

  const connectFolder = async () => {
    setMenu(false);
    if (!supportsFolderAccess()) return dirInput.current?.click();
    try {
      const handle = await window.showDirectoryPicker!({ id: 'content-studio', mode: 'read' });
      await studio.addFolder({ id: uid(), name: handle.name, handle, autoSync: true, fileCount: 0 });
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') alert(`Couldn't open that folder: ${(e as Error).message}`);
    }
  };

  const importDir = async (files: FileList) => {
    const name = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] || 'Imported folder';
    const folder: SyncedFolder = { id: uid(), name, autoSync: false, fileCount: files.length, lastSyncedAt: Date.now() };
    await importFileList(files, folder);
    await studio.addFolder(folder);
  };

  const add = (s: Source) => {
    studio.addSources([s]);
    if (piece) studio.updatePiece(piece.id, { sources: [...piece.sources, { sourceId: s.id }] });
  };
  const addMany = (list: Source[]) => {
    studio.addSources(list);
    if (piece) studio.updatePiece(piece.id, { sources: [...piece.sources, ...list.map((s) => ({ sourceId: s.id }))] });
  };

  return (
    <aside
      className={`relative flex h-full w-full flex-col border-r border-slate-200 bg-slate-50/70 ${dragging ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sources</h2>
          <p className="text-[11px] text-slate-500">Check a source to use it in the current piece</p>
        </div>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500">
            <Plus className="h-3.5 w-3.5" /> Add <ChevronDown className="h-3 w-3" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10">
                {[
                  { icon: FolderSync, label: 'Connect a folder', hint: supportsFolderAccess() ? 'Auto-syncs new & changed files' : 'One-time import in this browser', on: connectFolder },
                  { icon: Upload, label: 'Upload files', hint: 'Text, images, PDFs, captions', on: () => { setMenu(false); fileInput.current?.click(); } },
                  { icon: Youtube, label: 'YouTube video', hint: 'Link + transcript', on: () => { setMenu(false); setModal('youtube'); } },
                  { icon: StickyNote, label: 'Paste text / note', hint: 'Web copy, reviews, chat output', on: () => { setMenu(false); setModal('note'); } },
                ].map((i) => (
                  <button key={i.label} onClick={i.on} className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-slate-50">
                    <i.icon className="mt-0.5 h-4 w-4 text-indigo-500" />
                    <span>
                      <span className="block text-sm text-slate-800">{i.label}</span>
                      <span className="block text-[11px] text-slate-500">{i.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <input ref={fileInput} type="file" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files).then(() => (e.target.value = ''))} />
      <input
        ref={dirInput}
        type="file"
        hidden
        multiple
        {...({ webkitdirectory: '' } as Record<string, string>)}
        onChange={(e) => e.target.files?.length && importDir(e.target.files).then(() => (e.target.value = ''))}
      />

      {studio.folders.length > 0 && (
        <div className="space-y-2 px-4 pb-3">
          {studio.folders.map((f) => (
            <FolderRow key={f.id} folder={f} studio={studio} />
          ))}
        </div>
      )}

      <div className="px-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, text, tags…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="scrollbar-hide -mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition ${filter === f.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
            >
              {f.label}
              {f.id === 'attached' && attached.size > 0 && ` · ${attached.size}`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {list.length === 0 && (
          <div className="mx-2 mt-6 rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
            <Upload className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-xs text-slate-500">
              {studio.sources.length ? 'Nothing matches.' : 'Drop files here, connect a folder, or add a YouTube video.'}
            </p>
          </div>
        )}
        {list.map((s) => {
          const on = attached.has(s.id);
          return (
            <div key={s.id} className={`group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition ${on ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-white'}`}>
              <button
                onClick={() => toggle(s)}
                disabled={!piece || s.kind === 'unsupported'}
                title={on ? 'Remove from this piece' : 'Use in this piece'}
                className={`flex h-4 w-4 flex-none items-center justify-center rounded border transition ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white group-hover:border-indigo-400'} disabled:opacity-30`}
              >
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>
              <button onClick={() => setPreview(s)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <Thumb source={s} />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-xs font-medium ${s.missing ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{s.title}</div>
                  <div className="flex items-center gap-1 truncate text-[10px] text-slate-500">
                    {s.missing && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                    {s.kind === 'youtube' ? (s.text ? `${s.youtube?.author ?? 'YouTube'} · transcript` : `${s.youtube?.author ?? 'YouTube'} · no transcript`) : s.path ?? s.origin}
                    {s.tags.filter((t) => t !== 'youtube').slice(0, 2).map((t) => (
                      <span key={t} className="rounded bg-slate-200/70 px-1 text-slate-600">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {modal === 'youtube' && <YouTubeModal onClose={() => setModal(null)} onAdd={addMany} />}
      {modal === 'note' && <NoteModal onClose={() => setModal(null)} onAdd={add} />}
      {preview && (
        <SourcePreviewModal
          source={preview}
          onClose={() => setPreview(null)}
          onSave={studio.updateSource}
          onDelete={() => {
            studio.deleteSources([preview.id]);
            setPreview(null);
          }}
        />
      )}
    </aside>
  );
}
