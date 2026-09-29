import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as db from './db';
import { uid } from './db';
import type { Idea, Piece, Project, Settings, Source, SyncedFolder, Version, VersionOrigin } from './types';
import { fetchChannel } from './youtube';
import { ensurePermission, syncFolder } from './files';

const SETTINGS_KEY = 'content-studio:settings';
const ACTIVE_KEY = 'content-studio:active';

const DEFAULT_SETTINGS: Settings = { apiKey: '', model: 'claude-opus-5-5', effort: 'high', syncIntervalSec: 30 };

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode); settings just won't persist.
  }
}

export function newPiece(projectId: string, partial: Partial<Piece> = {}): Piece {
  const now = Date.now();
  return {
    id: uid(),
    projectId,
    title: 'Untitled piece',
    format: 'social-ad',
    brief: '',
    tone: '',
    audience: '',
    length: '',
    sources: [],
    body: '',
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export type FolderStatus = { state: 'idle' | 'syncing' | 'needs-permission' | 'error'; message?: string };

export function useStudio() {
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettingsState] = useState<Settings>(() => readLocal(SETTINGS_KEY, DEFAULT_SETTINGS));
  const [projects, setProjects] = useState<Project[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [folders, setFolders] = useState<SyncedFolder[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [folderStatus, setFolderStatus] = useState<Record<string, FolderStatus>>({});
  const [active, setActive] = useState<{ projectId?: string; pieceId?: string }>(() => readLocal(ACTIVE_KEY, {}));

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    writeLocal(SETTINGS_KEY, s);
  }, []);

  useEffect(() => writeLocal(ACTIVE_KEY, active), [active]);

  const reloadSources = useCallback(async () => setSources(await db.getAll('sources')), []);

  // Initial load; seed a first project so the editor is never empty.
  useEffect(() => {
    (async () => {
      let [p, pc] = await Promise.all([db.getAll('projects'), db.getAll('pieces')]);
      const [s, f] = await Promise.all([db.getAll('sources'), db.getAll('folders')]);
      if (!p.length) {
        const now = Date.now();
        const proj: Project = { id: uid(), name: 'My first campaign', guidelines: '', createdAt: now, updatedAt: now };
        const piece = newPiece(proj.id, { title: 'Launch ad' });
        await db.put('projects', proj);
        await db.put('pieces', piece);
        p = [proj];
        pc = [piece];
      }
      setProjects(p);
      setPieces(pc);
      setSources(s);
      setFolders(f);
      setActive((a) => {
        const projectId = p.some((x) => x.id === a.projectId) ? a.projectId! : p[0].id;
        const inProject = pc.filter((x) => x.projectId === projectId);
        const pieceId = inProject.some((x) => x.id === a.pieceId) ? a.pieceId : inProject[0]?.id;
        return { projectId, pieceId };
      });
      setLoaded(true);
    })();
  }, []);

  const project = projects.find((p) => p.id === active.projectId);
  const projectPieces = useMemo(
    () => pieces.filter((p) => p.projectId === active.projectId).sort((a, b) => a.createdAt - b.createdAt),
    [pieces, active.projectId],
  );
  const piece = projectPieces.find((p) => p.id === active.pieceId);
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  // Versions of the active piece.
  useEffect(() => {
    if (!active.pieceId) return setVersions([]);
    db.getByIndex('versions', 'pieceId', active.pieceId).then((v) => setVersions(v.sort((a, b) => b.createdAt - a.createdAt)));
  }, [active.pieceId]);

  // ---------- projects ----------
  const createProject = async (name: string) => {
    const now = Date.now();
    const proj: Project = { id: uid(), name, guidelines: '', createdAt: now, updatedAt: now };
    const pc = newPiece(proj.id);
    await db.put('projects', proj);
    await db.put('pieces', pc);
    setProjects((ps) => [...ps, proj]);
    setPieces((ps) => [...ps, pc]);
    setActive({ projectId: proj.id, pieceId: pc.id });
  };

  // Always patch the latest copy so back-to-back updates (e.g. making several ideas) don't overwrite each other.
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const updateProject = async (patch: Partial<Project> | ((p: Project) => Partial<Project>), id = active.projectId) => {
    const current = projectsRef.current.find((p) => p.id === id);
    if (!current) return;
    const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch), updatedAt: Date.now() };
    projectsRef.current = projectsRef.current.map((p) => (p.id === next.id ? next : p));
    setProjects(projectsRef.current);
    await db.put('projects', next);
  };

  const deleteProject = async (id: string) => {
    const doomed = pieces.filter((p) => p.projectId === id);
    for (const p of doomed) {
      const vs = await db.getByIndex('versions', 'pieceId', p.id);
      await db.removeMany('versions', vs.map((v) => v.id));
    }
    await db.removeMany('pieces', doomed.map((p) => p.id));
    await db.remove('projects', id);
    const rest = projects.filter((p) => p.id !== id);
    setProjects(rest);
    setPieces((ps) => ps.filter((p) => p.projectId !== id));
    if (rest.length) {
      const first = pieces.find((p) => p.projectId === rest[0].id);
      setActive({ projectId: rest[0].id, pieceId: first?.id });
    } else {
      await createProject('New campaign');
    }
  };

  // ---------- pieces ----------
  const saveTimers = useRef(new Map<string, number>());
  const updatePiece = useCallback((id: string, patch: Partial<Piece>) => {
    setPieces((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch, updatedAt: Date.now() };
        // Debounced autosave of the working draft (versions are separate, explicit snapshots).
        window.clearTimeout(saveTimers.current.get(id));
        saveTimers.current.set(id, window.setTimeout(() => db.put('pieces', next), 400));
        return next;
      }),
    );
  }, []);

  const addPiece = async (partial: Partial<Piece> = {}) => {
    if (!project) return;
    const pc = newPiece(project.id, partial);
    await db.put('pieces', pc);
    setPieces((ps) => [...ps, pc]);
    setActive((a) => ({ ...a, pieceId: pc.id }));
    return pc;
  };

  const duplicatePiece = async () => {
    if (!piece) return;
    const { title, format, brief, facts, tone, audience, length, sources: refs, body } = piece;
    const copy = newPiece(piece.projectId, { title: `${title} (copy)`, format, brief, facts, tone, audience, length, sources: refs, body });
    await db.put('pieces', copy);
    if (body.trim()) {
      const v: Version = { id: uid(), pieceId: copy.id, body, origin: 'duplicate', label: `Branched from "${title}"`, starred: false, createdAt: Date.now() };
      await db.put('versions', v);
    }
    setPieces((ps) => [...ps, copy]);
    setActive((a) => ({ ...a, pieceId: copy.id }));
  };

  const deletePiece = async (id: string) => {
    const vs = await db.getByIndex('versions', 'pieceId', id);
    await db.removeMany('versions', vs.map((v) => v.id));
    await db.remove('pieces', id);
    const rest = projectPieces.filter((p) => p.id !== id);
    setPieces((ps) => ps.filter((p) => p.id !== id));
    if (rest.length) setActive((a) => ({ ...a, pieceId: rest[0].id }));
    else await addPiece();
  };

  // ---------- versions ----------
  const snapshot = async (pieceId: string, body: string, origin: VersionOrigin, label: string, meta?: Version['meta']) => {
    const v: Version = { id: uid(), pieceId, body, origin, label, starred: false, createdAt: Date.now(), meta };
    await db.put('versions', v);
    if (pieceId === active.pieceId) setVersions((vs) => [v, ...vs]);
    return v;
  };

  const latestBody = versions[0]?.body;
  const hasUnsavedChanges = !!piece && piece.body.trim() !== '' && piece.body !== latestBody;

  const saveVersion = async (label?: string) => {
    if (!piece || !piece.body.trim()) return;
    await snapshot(piece.id, piece.body, 'manual', label || `Saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`);
  };

  const restoreVersion = async (v: Version) => {
    if (!piece) return;
    if (hasUnsavedChanges) await snapshot(piece.id, piece.body, 'manual', 'Auto-saved before restore');
    updatePiece(piece.id, { body: v.body });
    await snapshot(piece.id, v.body, 'restore', `Restored "${v.label}"`);
  };

  const updateVersion = async (v: Version, patch: Partial<Version>) => {
    const next = { ...v, ...patch };
    await db.put('versions', next);
    setVersions((vs) => vs.map((x) => (x.id === v.id ? next : x)));
  };

  const deleteVersion = async (v: Version) => {
    await db.remove('versions', v.id);
    setVersions((vs) => vs.filter((x) => x.id !== v.id));
  };

  // ---------- sources ----------
  const addSources = async (list: Source[]) => {
    await db.putMany('sources', list);
    setSources((s) => [...s, ...list]);
  };

  const updateSource = async (src: Source) => {
    const next = { ...src, updatedAt: Date.now() };
    await db.put('sources', next);
    setSources((s) => s.map((x) => (x.id === next.id ? next : x)));
  };

  const deleteSources = async (ids: string[]) => {
    await db.removeMany('sources', ids);
    const gone = new Set(ids);
    setSources((s) => s.filter((x) => !gone.has(x.id)));
    // Detach from every piece that referenced them.
    setPieces((ps) =>
      ps.map((p) => {
        if (!p.sources.some((r) => gone.has(r.sourceId))) return p;
        const next = { ...p, sources: p.sources.filter((r) => !gone.has(r.sourceId)) };
        db.put('pieces', next);
        return next;
      }),
    );
  };

  // ---------- YouTube channel (Auto) ----------
  /** Pulls the channel's uploads into the source library, updating stats for videos already there. */
  const syncChannel = async (input: string) => {
    if (!project) return;
    const result = await fetchChannel(input, settings.youtubeApiKey);
    const all = await db.getAll('sources');
    const byVideo = new Map(all.filter((s) => s.youtube).map((s) => [s.youtube!.videoId, s]));
    const now = Date.now();
    const writes: Source[] = result.videos.map((v) => {
      const prev = byVideo.get(v.videoId);
      const youtube = {
        ...prev?.youtube,
        videoId: v.videoId,
        author: result.title,
        thumbnail: v.thumbnail,
        description: v.description,
        publishedAt: v.publishedAt,
        views: v.views ?? prev?.youtube?.views,
        duration: v.duration ?? prev?.youtube?.duration,
        channelId: result.channelId,
      };
      if (prev) return { ...prev, title: v.title, youtube, updatedAt: now };
      return {
        id: uid(),
        kind: 'youtube',
        origin: 'youtube',
        title: v.title,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        youtube,
        text: '',
        tags: ['youtube', 'channel'],
        createdAt: now,
        updatedAt: now,
      };
    });
    await db.putMany('sources', writes);
    await reloadSources();
    await updateProject({
      channel: { input, channelId: result.channelId, title: result.title, lastSyncedAt: now, videoCount: result.videos.length, via: result.via },
    });
    return result;
  };

  /** Creates a piece from an Auto idea, with its videos attached as sources. */
  const pieceFromIdea = async (idea: Idea) => {
    if (!project) return;
    const byVideo = new Map(sources.filter((s) => s.youtube).map((s) => [s.youtube!.videoId, s.id]));
    const pc = newPiece(project.id, {
      title: idea.title,
      format: idea.format,
      brief: idea.brief,
      facts: [project.ideasGoal?.trim(), idea.facts?.trim()].filter(Boolean).join('\n'),
      tone: idea.tone ?? '',
      audience: idea.audience ?? '',
      length: idea.length ?? '',
      sources: idea.videoIds.map((v) => byVideo.get(v)).filter((id): id is string => !!id).map((sourceId) => ({ sourceId })),
    });
    await db.put('pieces', pc);
    setPieces((ps) => [...ps, pc]);
    await updateProject((p) => ({ ideas: (p.ideas ?? []).map((i) => (i.id === idea.id ? { ...i, pieceId: pc.id } : i)) }));
    return pc;
  };

  // ---------- folders ----------
  const syncingRef = useRef(new Set<string>());
  const runSync = useCallback(
    async (folder: SyncedFolder, prompt: boolean) => {
      if (!folder.handle || syncingRef.current.has(folder.id)) return;
      if (!(await ensurePermission(folder, prompt))) {
        setFolderStatus((s) => ({ ...s, [folder.id]: { state: 'needs-permission' } }));
        return;
      }
      syncingRef.current.add(folder.id);
      setFolderStatus((s) => ({ ...s, [folder.id]: { state: 'syncing' } }));
      try {
        const r = await syncFolder(folder);
        const next = { ...folder, lastSyncedAt: Date.now(), fileCount: r.total };
        await db.put('folders', next);
        setFolders((fs) => fs.map((f) => (f.id === next.id ? next : f)));
        if (r.added || r.updated || r.removed) await reloadSources();
        const changes = [r.added && `${r.added} new`, r.updated && `${r.updated} updated`, r.removed && `${r.removed} missing`].filter(Boolean).join(', ');
        setFolderStatus((s) => ({ ...s, [folder.id]: { state: 'idle', message: changes || undefined } }));
      } catch (e) {
        setFolderStatus((s) => ({ ...s, [folder.id]: { state: 'error', message: e instanceof Error ? e.message : String(e) } }));
      } finally {
        syncingRef.current.delete(folder.id);
      }
    },
    [reloadSources],
  );

  const addFolder = async (folder: SyncedFolder) => {
    await db.put('folders', folder);
    setFolders((fs) => [...fs, folder]);
    if (folder.handle) await runSync(folder, false);
    else await reloadSources();
  };

  const updateFolder = async (folder: SyncedFolder) => {
    await db.put('folders', folder);
    setFolders((fs) => fs.map((f) => (f.id === folder.id ? folder : f)));
  };

  const removeFolder = async (folder: SyncedFolder, deleteFiles: boolean) => {
    await db.remove('folders', folder.id);
    setFolders((fs) => fs.filter((f) => f.id !== folder.id));
    const ids = sources.filter((s) => s.folderId === folder.id).map((s) => s.id);
    if (deleteFiles) await deleteSources(ids);
  };

  // Auto-sync loop: rescans folders that have autoSync on and already-granted permission.
  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  useEffect(() => {
    if (!loaded) return;
    const tick = () => foldersRef.current.filter((f) => f.autoSync && f.handle).forEach((f) => runSync(f, false));
    tick();
    const id = window.setInterval(tick, Math.max(5, settings.syncIntervalSec) * 1000);
    return () => window.clearInterval(id);
  }, [loaded, runSync, settings.syncIntervalSec]);

  return {
    loaded,
    settings,
    setSettings,
    projects,
    project,
    projectPieces,
    piece,
    sources,
    sourceMap,
    folders,
    folderStatus,
    versions,
    hasUnsavedChanges,
    setActive,
    createProject,
    updateProject,
    deleteProject,
    addPiece,
    duplicatePiece,
    updatePiece,
    deletePiece,
    snapshot,
    saveVersion,
    restoreVersion,
    updateVersion,
    deleteVersion,
    addSources,
    updateSource,
    deleteSources,
    addFolder,
    updateFolder,
    removeFolder,
    runSync,
    syncChannel,
    pieceFromIdea,
    setPieces,
  };
}

export type Studio = ReturnType<typeof useStudio>;
