import { useRef, useState } from 'react';
import { BookOpen, ChevronDown, Download, FolderKanban, History, Layers, Loader2, PenLine, Plus, Settings as SettingsIcon, Trash2, Upload, Zap } from 'lucide-react';
import { useStudio } from './useStudio';
import * as db from './db';
import type { Piece, Project, Source, Version } from './types';
import { SourceLibrary } from './components/SourceLibrary';
import { PieceEditor } from './components/PieceEditor';
import { VersionPanel } from './components/VersionPanel';
import { AutoPanel } from './components/AutoPanel';
import { GuidelinesModal, SettingsModal } from './components/StudioModals';
import { download } from './util';

interface Backup {
  kind: 'content-studio-backup';
  exportedAt: string;
  project: Project;
  pieces: Piece[];
  versions: Version[];
  sources: Omit<Source, 'blob'>[];
}

export function StudioApp() {
  const studio = useStudio();
  const [modal, setModal] = useState<'settings' | 'guidelines' | null>(null);
  const [projectMenu, setProjectMenu] = useState(false);
  const [mobilePane, setMobilePane] = useState<'sources' | 'editor' | 'history'>('editor');
  const [mode, setMode] = useState<'editor' | 'auto'>('editor');
  const [autoRunPieceId, setAutoRunPieceId] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const { project } = studio;

  if (!studio.loaded || !project) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const exportProject = async () => {
    const pieces = studio.projectPieces;
    const versions = (await Promise.all(pieces.map((p) => db.getByIndex('versions', 'pieceId', p.id)))).flat();
    const used = new Set(pieces.flatMap((p) => p.sources.map((r) => r.sourceId)));
    const sources = studio.sources.filter((s) => used.has(s.id)).map(({ blob: _blob, ...rest }) => (void _blob, rest));
    const backup: Backup = { kind: 'content-studio-backup', exportedAt: new Date().toISOString(), project, pieces, versions, sources };
    download(`${project.name.replace(/[^\w-]+/g, '_')}.studio.json`, JSON.stringify(backup, null, 2), 'application/json');
  };

  const importProject = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Backup;
      if (data.kind !== 'content-studio-backup') throw new Error('Not a Content Studio backup file.');
      await db.putMany('sources', data.sources.filter((s) => !studio.sourceMap.has(s.id)) as Source[]);
      await db.put('projects', data.project);
      await db.putMany('pieces', data.pieces);
      await db.putMany('versions', data.versions);
      window.location.reload();
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Studio toolbar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <Layers className="h-4 w-4" />
          </div>
          <div className="relative">
            <button onClick={() => setProjectMenu((m) => !m)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-left hover:bg-slate-100">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Project</div>
                <div className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                  <span className="max-w-[180px] truncate">{project.name}</span> <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>
            </button>
            {projectMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProjectMenu(false)} />
                <div className="absolute left-0 z-20 mt-1 w-64 rounded-xl bg-white py-1 shadow-xl ring-1 ring-slate-900/10">
                  {studio.projects.map((p) => (
                    <div key={p.id} className="group flex items-center">
                      <button
                        className={`flex flex-1 items-center gap-2 truncate px-3 py-2 text-left text-sm hover:bg-slate-50 ${p.id === project.id ? 'font-medium text-indigo-700' : 'text-slate-700'}`}
                        onClick={async () => {
                          const first = (await db.getByIndex('pieces', 'projectId', p.id))[0];
                          studio.setActive({ projectId: p.id, pieceId: first?.id });
                          setProjectMenu(false);
                        }}
                      >
                        <FolderKanban className="h-4 w-4 flex-none text-slate-400" /> <span className="truncate">{p.name}</span>
                      </button>
                      <button
                        title="Delete project"
                        className="mr-1 hidden rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 group-hover:block"
                        onClick={() => {
                          if (confirm(`Delete "${p.name}", all its pieces and versions? Sources are kept.`)) studio.deleteProject(p.id);
                          setProjectMenu(false);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      const name = prompt('Name the new project', 'New campaign');
                      if (name?.trim()) studio.createProject(name.trim());
                      setProjectMenu(false);
                    }}
                  >
                    <Plus className="h-4 w-4 text-indigo-500" /> New project
                  </button>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { exportProject(); setProjectMenu(false); }}>
                    <Download className="h-4 w-4 text-slate-400" /> Export project backup
                  </button>
                  <button className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { importInput.current?.click(); setProjectMenu(false); }}>
                    <Upload className="h-4 w-4 text-slate-400" /> Import backup
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="ml-2 flex items-center rounded-lg bg-slate-100 p-0.5">
          {([
            ['editor', 'Editor', PenLine],
            ['auto', 'Auto', Zap],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${mode === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Icon className={`h-3.5 w-3.5 ${id === 'auto' && mode === id ? 'text-indigo-600' : ''}`} /> {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setModal('guidelines')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Guidelines</span>
            {project.guidelines.trim() && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
          </button>
          <button onClick={() => setModal('settings')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
            <SettingsIcon className="h-4 w-4" /> <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
        <input ref={importInput} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importProject(e.target.files[0])} />
      </div>

      {/* Mobile pane switcher */}
      <div className="flex border-b border-slate-200 lg:hidden">
        {([
          ['sources', 'Sources', Layers],
          ['editor', 'Editor', PenLine],
          ['history', 'History', History],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setMobilePane(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-medium ${mobilePane === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className={`${mobilePane === 'sources' ? 'flex' : 'hidden'} w-full lg:flex lg:w-80 lg:flex-none`}>
          <SourceLibrary studio={studio} />
        </div>
        {mode === 'auto' ? (
          <div className={`${mobilePane === 'sources' ? 'hidden' : 'flex'} min-w-0 flex-1 lg:flex`}>
            <AutoPanel
              studio={studio}
              onOpenPiece={(pieceId, autoRun) => {
                studio.setActive((a) => ({ ...a, pieceId }));
                if (autoRun) setAutoRunPieceId(pieceId);
                setMode('editor');
                setMobilePane('editor');
              }}
            />
          </div>
        ) : (
          <>
            <div className={`${mobilePane === 'editor' ? 'flex' : 'hidden'} min-w-0 flex-1 lg:flex`}>
              <PieceEditor
                studio={studio}
                onOpenSettings={() => setModal('settings')}
                autoRunPieceId={autoRunPieceId}
                onAutoRunStarted={() => setAutoRunPieceId(null)}
              />
            </div>
            <div className={`${mobilePane === 'history' ? 'flex' : 'hidden'} w-full lg:flex lg:w-72 lg:flex-none xl:w-80`}>
              <VersionPanel studio={studio} />
            </div>
          </>
        )}
      </div>

      {modal === 'settings' && <SettingsModal settings={studio.settings} onSave={studio.setSettings} onClose={() => setModal(null)} />}
      {modal === 'guidelines' && <GuidelinesModal project={project} onSave={studio.updateProject} onClose={() => setModal(null)} />}
    </div>
  );
}
