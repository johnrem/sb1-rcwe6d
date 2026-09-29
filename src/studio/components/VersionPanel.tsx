import { useMemo, useState } from 'react';
import { GitCompare, History, RotateCcw, Star, Trash2, Sparkles, Wand2, Save, GitBranch } from 'lucide-react';
import type { Studio } from '../useStudio';
import type { Version, VersionOrigin } from '../types';
import { diffWords } from '../diff';
import { Btn, Modal } from './ui';
import { timeAgo } from '../util';

const ORIGIN: Record<VersionOrigin, { icon: typeof Save; cls: string; label: string }> = {
  manual: { icon: Save, cls: 'bg-slate-100 text-slate-600', label: 'Saved' },
  generate: { icon: Sparkles, cls: 'bg-indigo-100 text-indigo-700', label: 'Generated' },
  refine: { icon: Wand2, cls: 'bg-violet-100 text-violet-700', label: 'Refined' },
  restore: { icon: RotateCcw, cls: 'bg-emerald-100 text-emerald-700', label: 'Restored' },
  'before-generate': { icon: History, cls: 'bg-amber-100 text-amber-800', label: 'Pre-AI' },
  duplicate: { icon: GitBranch, cls: 'bg-sky-100 text-sky-700', label: 'Branched' },
};

function CompareModal({ versions, initial, current, onClose, onRestore }: { versions: Version[]; initial: Version; current: string; onClose: () => void; onRestore: (v: Version) => void }) {
  const [leftId, setLeftId] = useState(initial.id);
  const [rightId, setRightId] = useState<string>('current');
  const pick = (id: string) => (id === 'current' ? current : versions.find((v) => v.id === id)?.body ?? '');
  const parts = useMemo(() => diffWords(pick(leftId), pick(rightId)), [leftId, rightId, current]); // eslint-disable-line react-hooks/exhaustive-deps
  const added = parts.filter((p) => p.type === 'add').reduce((n, p) => n + p.text.trim().split(/\s+/).filter(Boolean).length, 0);
  const removed = parts.filter((p) => p.type === 'del').reduce((n, p) => n + p.text.trim().split(/\s+/).filter(Boolean).length, 0);
  const left = versions.find((v) => v.id === leftId);

  const options = (
    <>
      <option value="current">Current draft</option>
      {versions.map((v) => (
        <option key={v.id} value={v.id}>
          {v.label} · {new Date(v.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </option>
      ))}
    </>
  );

  return (
    <Modal title="Compare versions" onClose={onClose} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <select className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={leftId} onChange={(e) => setLeftId(e.target.value)}>
          {options}
        </select>
        <span className="text-slate-400">→</span>
        <select className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" value={rightId} onChange={(e) => setRightId(e.target.value)}>
          {options}
        </select>
      </div>
      <div className="mb-2 flex items-center gap-3 text-xs">
        <span className="text-emerald-700">+{added} words</span>
        <span className="text-rose-700">−{removed} words</span>
      </div>
      <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50/60 p-4 font-mono text-[13px] leading-relaxed text-slate-800">
        {parts.map((p, i) =>
          p.type === 'same' ? (
            <span key={i}>{p.text}</span>
          ) : p.type === 'add' ? (
            <ins key={i} className="rounded bg-emerald-100 text-emerald-900 no-underline">{p.text}</ins>
          ) : (
            <del key={i} className="rounded bg-rose-100 text-rose-800">{p.text}</del>
          ),
        )}
      </div>
      {left && (
        <div className="mt-3 flex justify-end">
          <Btn
            variant="primary"
            onClick={() => {
              onRestore(left);
              onClose();
            }}
          >
            <RotateCcw className="h-4 w-4" /> Restore “{left.label}”
          </Btn>
        </div>
      )}
    </Modal>
  );
}

export function VersionPanel({ studio }: { studio: Studio }) {
  const { versions, piece } = studio;
  const [starredOnly, setStarredOnly] = useState(false);
  const [compare, setCompare] = useState<Version | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const list = starredOnly ? versions.filter((v) => v.starred) : versions;

  return (
    <aside className="flex h-full w-full flex-col border-l border-slate-200 bg-slate-50/70">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Version history</h2>
          <p className="text-[11px] text-slate-500">{versions.length} snapshots of this piece</p>
        </div>
        <button
          onClick={() => setStarredOnly((s) => !s)}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${starredOnly ? 'bg-amber-100 text-amber-800' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
        >
          <Star className={`h-3 w-3 ${starredOnly ? 'fill-amber-500 text-amber-500' : ''}`} /> Starred
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {list.length === 0 && (
          <div className="mx-1 mt-6 rounded-xl border-2 border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
            {starredOnly ? 'No starred versions yet.' : 'Every generation, refinement and manual save lands here, so you can compare and roll back anytime.'}
          </div>
        )}
        <ol className="relative space-y-2 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-slate-200">
          {list.map((v) => {
            const o = ORIGIN[v.origin];
            const isCurrent = v.body === piece?.body;
            const open = selected === v.id;
            return (
              <li key={v.id} className="relative pl-8">
                <span className={`absolute left-[7px] top-3 flex h-[18px] w-[18px] items-center justify-center rounded-full ring-4 ring-slate-50 ${o.cls}`}>
                  <o.icon className="h-2.5 w-2.5" />
                </span>
                <div className={`rounded-xl bg-white p-2.5 ring-1 transition ${open ? 'ring-indigo-300 shadow-sm' : 'ring-slate-200 hover:ring-slate-300'}`}>
                  <div className="flex items-start gap-1.5">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelected(open ? null : v.id)}>
                      {editing === v.id ? (
                        <input
                          autoFocus
                          defaultValue={v.label}
                          className="w-full rounded border border-indigo-300 px-1 text-xs"
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            studio.updateVersion(v, { label: e.target.value.trim() || v.label });
                            setEditing(null);
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        />
                      ) : (
                        <div className="truncate text-xs font-medium text-slate-800" onDoubleClick={() => setEditing(v.id)} title="Double-click to rename">
                          {v.label}
                        </div>
                      )}
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span className={`rounded px-1 py-px font-medium ${o.cls}`}>{o.label}</span>
                        {timeAgo(v.createdAt)}
                        {isCurrent && <span className="font-medium text-emerald-600">· current</span>}
                      </div>
                    </div>
                    <button onClick={() => studio.updateVersion(v, { starred: !v.starred })} className="rounded p-1 text-slate-300 hover:text-amber-500" title="Star">
                      <Star className={`h-3.5 w-3.5 ${v.starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  </div>
                  {open && (
                    <>
                      <p className="mt-2 line-clamp-6 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-600">{v.body}</p>
                      {v.meta && (
                        <div className="mt-2 space-y-0.5 text-[10px] text-slate-500">
                          {v.meta.model && <div>Model: {v.meta.model}</div>}
                          {v.meta.instruction && <div>Instruction: “{v.meta.instruction}”</div>}
                          {v.meta.sourceTitles && v.meta.sourceTitles.length > 0 && <div className="line-clamp-2">Sources: {v.meta.sourceTitles.join(', ')}</div>}
                        </div>
                      )}
                      <div className="mt-2 flex gap-1">
                        <Btn size="sm" disabled={isCurrent} onClick={() => studio.restoreVersion(v)}>
                          <RotateCcw className="h-3 w-3" /> Restore
                        </Btn>
                        <Btn size="sm" onClick={() => setCompare(v)}>
                          <GitCompare className="h-3 w-3" /> Compare
                        </Btn>
                        <Btn size="sm" variant="ghost" className="ml-auto" onClick={() => studio.deleteVersion(v)} title="Delete version">
                          <Trash2 className="h-3 w-3" />
                        </Btn>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {compare && piece && <CompareModal versions={versions} initial={compare} current={piece.body} onClose={() => setCompare(null)} onRestore={studio.restoreVersion} />}
    </aside>
  );
}
