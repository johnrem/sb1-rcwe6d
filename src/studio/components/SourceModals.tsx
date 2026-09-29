import { useState } from 'react';
import { ExternalLink, Loader2, Trash2, Youtube } from 'lucide-react';
import { Btn, Modal, inputCls, labelCls } from './ui';
import { useObjectUrl } from '../util';
import { uid } from '../db';
import type { Source } from '../types';
import { cleanTranscript, fetchYouTubeMeta, parseYouTubeId } from '../youtube';

export function YouTubeModal({ onClose, onAdd }: { onClose: () => void; onAdd: (s: Source[]) => void }) {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ids = [...new Set(url.split(/[\s,]+/).map(parseYouTubeId).filter((x): x is string => !!x))];
  const videoId = ids.length === 1 ? ids[0] : null;

  const submit = async () => {
    if (!ids.length) return setError('That does not look like a YouTube link.');
    setBusy(true);
    const now = Date.now();
    const added = await Promise.all(
      ids.map(async (id): Promise<Source> => {
        const meta = await fetchYouTubeMeta(id);
        return {
          id: uid(),
          kind: 'youtube',
          origin: 'youtube',
          title: meta.title,
          url: `https://www.youtube.com/watch?v=${id}`,
          youtube: { videoId: id, author: meta.author, thumbnail: meta.thumbnail },
          text: ids.length === 1 && transcript.trim() ? cleanTranscript(transcript) : '',
          tags: ['youtube'],
          createdAt: now,
          updatedAt: now,
        };
      }),
    );
    onAdd(added);
    onClose();
  };

  return (
    <Modal title="Add YouTube videos" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Video links (one or many)</label>
          <textarea
            autoFocus
            className={`${inputCls} h-20 font-mono text-xs`}
            placeholder={'https://www.youtube.com/watch?v=…\nhttps://youtu.be/…\nhttps://www.youtube.com/shorts/…'}
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
          />
          {ids.length > 1 && <p className="mt-1 text-xs text-slate-500">{ids.length} videos found. Add transcripts afterwards by clicking each video in Sources.</p>}
        </div>
        {videoId && (
          <div className="aspect-video overflow-hidden rounded-xl bg-slate-900">
            <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${videoId}`} title="Preview" allowFullScreen />
          </div>
        )}
        {ids.length <= 1 && <div>
          <label className={labelCls}>Transcript (recommended)</label>
          <textarea className={`${inputCls} h-32 font-mono text-xs`} placeholder="Paste the transcript here…" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            On YouTube, open the video's description, click <b>Show transcript</b>, select all the text and paste it here. Timestamps are cleaned out automatically.
            You can also drop a <code>.srt</code>/<code>.vtt</code> caption file into the Sources panel. Without a transcript, Claude only sees the title and channel.
          </p>
        </div>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={!url || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />} {ids.length > 1 ? `Add ${ids.length} videos` : 'Add video'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export function NoteModal({ onClose, onAdd }: { onClose: () => void; onAdd: (s: Source) => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  return (
    <Modal title="Paste text or notes" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Title</label>
          <input autoFocus className={inputCls} placeholder="e.g. Product fact sheet, customer reviews, competitor ad" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Link (optional)</label>
          <input className={inputCls} placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Content</label>
          <textarea className={`${inputCls} h-48`} placeholder="Paste anything: page copy, notes, reviews, a previous chat's output…" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            disabled={!text.trim()}
            onClick={() => {
              const now = Date.now();
              onAdd({ id: uid(), kind: 'note', origin: 'note', title: title.trim() || text.trim().slice(0, 40), url: url.trim() || undefined, text, tags: [], createdAt: now, updatedAt: now });
              onClose();
            }}
          >
            Add source
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export function SourcePreviewModal({ source, onClose, onSave, onDelete }: { source: Source; onClose: () => void; onSave: (s: Source) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(source.title);
  const [text, setText] = useState(source.text ?? '');
  const [tags, setTags] = useState(source.tags.join(', '));
  const url = useObjectUrl(source.blob);
  const editableText = source.kind === 'note' || source.kind === 'youtube' || (source.kind === 'text' && source.origin !== 'folder');
  const dirty = title !== source.title || text !== (source.text ?? '') || tags !== source.tags.join(', ');

  return (
    <Modal title={source.origin === 'folder' ? source.path ?? source.title : 'Source'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tags (comma separated)</label>
            <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="brand, pricing, testimonial" />
          </div>
        </div>
        {source.missing && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This file is no longer in its folder. It won't be sent to Claude.</p>}
        {source.youtube && (
          <div className="aspect-video overflow-hidden rounded-xl bg-slate-900">
            <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${source.youtube.videoId}`} title={source.title} allowFullScreen />
          </div>
        )}
        {source.kind === 'image' && url && <img src={url} alt={source.title} className="max-h-[50vh] w-full rounded-xl bg-slate-50 object-contain" />}
        {source.kind === 'pdf' && url && <iframe src={url} title={source.title} className="h-[55vh] w-full rounded-xl border border-slate-200" />}
        {source.kind === 'unsupported' && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            This file type can't be read in the browser. Save it as PDF, text, or an image to use it.
          </p>
        )}
        {(source.kind === 'text' || source.kind === 'note' || source.kind === 'youtube') && (
          <div>
            <label className={labelCls}>{source.kind === 'youtube' ? 'Transcript' : 'Content'}</label>
            <textarea
              className={`${inputCls} h-64 font-mono text-xs`}
              value={text}
              readOnly={!editableText}
              onChange={(e) => setText(e.target.value)}
              placeholder={source.kind === 'youtube' ? 'Paste the transcript here…' : ''}
            />
            {!editableText && <p className="mt-1 text-xs text-slate-500">Synced from your folder. Edit the file itself and it will re-sync.</p>}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Btn variant="danger" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Remove
            </Btn>
            {source.url && (
              <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                <ExternalLink className="h-4 w-4" /> Open
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <Btn onClick={onClose}>Close</Btn>
            <Btn
              variant="primary"
              disabled={!dirty}
              onClick={() => {
                onSave({
                  ...source,
                  title: title.trim() || source.title,
                  text: source.kind === 'youtube' && text !== source.text ? cleanTranscript(text) : text,
                  tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                });
                onClose();
              }}
            >
              Save
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
