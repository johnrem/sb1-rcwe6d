import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  CopyPlus,
  Download,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Square,
  Trash2,
  Wand2,
  X,
  Check,
} from 'lucide-react';
import type { Studio } from '../useStudio';
import { FORMATS, formatById } from '../formats';
import { describeError, generate } from '../claude';
import { Btn, inputCls, labelCls } from './ui';
import { download } from '../util';

const QUICK_REFINES = ['Make it shorter', 'Punchier hook', 'More urgency', 'Simpler words', 'More benefit-driven', 'Add social proof', 'Less salesy'];

export function PieceEditor({ studio, onOpenSettings }: { studio: Studio; onOpenSettings: () => void }) {
  const { piece, project, projectPieces, settings } = studio;
  const [briefOpen, setBriefOpen] = useState(true);
  const [variations, setVariations] = useState(1);
  const [instruction, setInstruction] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const busy = streaming !== null;

  // Cmd/Ctrl+S saves a version.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        studio.saveVersion();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio]);

  useEffect(() => {
    setError('');
    setConfirmDelete(false);
  }, [piece?.id]);

  if (!piece || !project) return <div className="flex-1" />;

  const set = (patch: Parameters<Studio['updatePiece']>[1]) => studio.updatePiece(piece.id, patch);
  const attached = piece.sources.map((r) => ({ ref: r, src: studio.sourceMap.get(r.sourceId) })).filter((x) => x.src);

  const run = async (mode: 'generate' | 'refine', instr?: string) => {
    if (!settings.apiKey) return onOpenSettings();
    setError('');
    if (studio.hasUnsavedChanges) await studio.snapshot(piece.id, piece.body, 'before-generate', 'Draft before AI edit');
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming('');
    try {
      const { text, model } = await generate({
        settings,
        project,
        piece,
        sources: studio.sourceMap,
        mode,
        instruction: instr,
        variations: mode === 'generate' ? variations : 1,
        onText: setStreaming,
        signal: controller.signal,
      });
      set({ body: text });
      await studio.snapshot(piece.id, text, mode, mode === 'refine' ? `Refined: ${instr}` : variations > 1 ? `Generated ${variations} variations` : 'Generated', {
        model,
        brief: piece.brief,
        instruction: instr,
        sourceTitles: attached.map((a) => a.src!.title),
      });
      if (mode === 'refine') setInstruction('');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setStreaming(null);
      abortRef.current = null;
    }
  };

  const body = streaming ?? piece.body;
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-white">
      {/* Piece tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 px-3 pt-2">
        <div className="scrollbar-hide flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {projectPieces.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              onClick={() => studio.setActive((a) => ({ ...a, pieceId: p.id }))}
              className={`max-w-[200px] truncate whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm transition ${
                p.id === piece.id ? 'border-indigo-600 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {p.title || 'Untitled'}
            </button>
          ))}
        </div>
        <button disabled={busy} onClick={() => studio.addPiece()} title="New piece" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <Plus className="h-4 w-4" />
        </button>
        <button disabled={busy} onClick={studio.duplicatePiece} title="Duplicate this piece (branch)" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <CopyPlus className="h-4 w-4" />
        </button>
        <button disabled={busy} onClick={() => setConfirmDelete((c) => !c)} title="Delete piece" className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {confirmDelete && (
        <div className="flex items-center justify-between gap-2 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          Delete “{piece.title}” and all its versions?
          <div className="flex gap-2">
            <Btn size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Btn>
            <Btn size="sm" variant="danger" onClick={() => studio.deletePiece(piece.id)}>Delete</Btn>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Brief */}
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <input
              value={piece.title}
              onChange={(e) => set({ title: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-slate-900 placeholder-slate-300 focus:outline-none"
              placeholder="Name this piece"
            />
            <button onClick={() => setBriefOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
              {briefOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Brief & controls
            </button>
          </div>

          {briefOpen && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2">
                <label className={labelCls}>Format</label>
                <select className={inputCls} value={piece.format} onChange={(e) => set({ format: e.target.value })}>
                  {FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
                {formatById(piece.format).guidance && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{formatById(piece.format).guidance}</p>}
              </div>
              <div className="lg:col-span-2">
                <label className={labelCls}>Brief: what should this piece do?</label>
                <textarea
                  className={`${inputCls} h-20`}
                  value={piece.brief}
                  onChange={(e) => set({ brief: e.target.value })}
                  placeholder="e.g. Drive ticket sales for the season finale. Lead with the fan-favourite bot rematch; mention the early-bird price."
                />
              </div>
              <div>
                <label className={labelCls}>Audience</label>
                <input className={inputCls} value={piece.audience} onChange={(e) => set({ audience: e.target.value })} placeholder="Who is this for?" />
              </div>
              <div>
                <label className={labelCls}>Tone</label>
                <input className={inputCls} value={piece.tone} onChange={(e) => set({ tone: e.target.value })} placeholder="e.g. high-energy, witty, no clichés" />
              </div>
              <div>
                <label className={labelCls}>Length</label>
                <input className={inputCls} value={piece.length} onChange={(e) => set({ length: e.target.value })} placeholder="e.g. under 60 words, 30-second read" />
              </div>
              <div>
                <label className={labelCls}>Variations</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setVariations(n)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${variations === n ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className={labelCls}>Sources in use ({attached.length})</label>
                {attached.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
                    No sources yet. Tick sources in the left panel, drop files there, or connect a folder. Claude will work only from the brief and guidelines.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {attached.map(({ ref, src }) => (
                      <div key={ref.sourceId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5 ring-1 ring-slate-200/70">
                        <span className={`max-w-[40%] truncate text-xs font-medium ${src!.missing ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{src!.title}</span>
                        <input
                          className="min-w-0 flex-1 rounded-md border-0 bg-white px-2 py-1 text-xs text-slate-700 placeholder-slate-400 ring-1 ring-slate-200 focus:outline-none focus:ring-indigo-300"
                          placeholder="How to use it (optional): e.g. only the pricing, quote the 2nd review…"
                          value={ref.note ?? ''}
                          onChange={(e) => set({ sources: piece.sources.map((r) => (r.sourceId === ref.sourceId ? { ...r, note: e.target.value } : r)) })}
                        />
                        <button onClick={() => set({ sources: piece.sources.filter((r) => r.sourceId !== ref.sourceId) })} className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {busy ? (
              <Btn variant="secondary" onClick={() => abortRef.current?.abort()}>
                <Square className="h-4 w-4 fill-current" /> Stop
              </Btn>
            ) : (
              <Btn variant="primary" onClick={() => run('generate')}>
                <Sparkles className="h-4 w-4" /> {piece.body ? 'Regenerate' : 'Generate'}
                {variations > 1 && ` ${variations} variations`}
              </Btn>
            )}
            {busy && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {streaming ? 'Writing…' : 'Reading sources and thinking…'}
              </span>
            )}
            {!settings.apiKey && !busy && (
              <button onClick={onOpenSettings} className="text-xs font-medium text-amber-700 underline decoration-amber-300 underline-offset-2">
                Add your API key to generate
              </button>
            )}
            {piece.body && !busy && <span className="text-[11px] text-slate-400">Your current draft is saved as a version first.</span>}
          </div>
          {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        </div>

        {/* Draft */}
        <div className="px-5 py-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium uppercase tracking-wide">Draft</span>
              <span>· {words} words · {body.length} chars</span>
              {studio.hasUnsavedChanges && !busy && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">unsaved changes</span>}
            </div>
            <div className="flex gap-1">
              <Btn size="sm" variant="ghost" disabled={busy || !studio.hasUnsavedChanges} onClick={() => studio.saveVersion()} title="Save version (Ctrl/Cmd+S)">
                <Save className="h-3.5 w-3.5" /> Save version
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                disabled={!body}
                onClick={() => {
                  navigator.clipboard.writeText(body);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </Btn>
              <Btn size="sm" variant="ghost" disabled={!body} onClick={() => download(`${piece.title || 'piece'}.md`, body)}>
                <Download className="h-3.5 w-3.5" /> .md
              </Btn>
            </div>
          </div>
          <textarea
            value={body}
            readOnly={busy}
            onChange={(e) => set({ body: e.target.value })}
            placeholder="Generate a draft, or start writing. Everything you type is autosaved; use Save version to keep a snapshot you can compare and restore."
            className={`min-h-[42vh] w-full resize-y rounded-xl border px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${
              busy ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 focus:border-indigo-300'
            }`}
          />
        </div>
      </div>

      {/* Refine */}
      <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-3">
        <div className="scrollbar-hide mb-2 flex gap-1.5 overflow-x-auto">
          {QUICK_REFINES.map((q) => (
            <button
              key={q}
              disabled={busy || !piece.body}
              onClick={() => run('refine', q)}
              className="whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200 disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (instruction.trim()) run('refine', instruction.trim());
          }}
        >
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={busy || !piece.body}
            placeholder={piece.body ? 'Tell Claude how to revise this draft… e.g. "Keep variation 2, rewrite the headline to mention the date"' : 'Generate or write a draft first, then refine it here'}
            className={inputCls}
          />
          <Btn type="submit" variant="primary" disabled={busy || !instruction.trim() || !piece.body}>
            <Wand2 className="h-4 w-4" /> Refine
          </Btn>
        </form>
      </div>
    </section>
  );
}
