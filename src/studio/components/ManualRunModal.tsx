import { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCopy, Download, ExternalLink, FileType2, Image as ImageIcon } from 'lucide-react';
import type { Source } from '../types';
import { Btn, Modal, inputCls, labelCls } from './ui';

function downloadBlob(src: Source) {
  const url = URL.createObjectURL(src.blob!);
  const a = document.createElement('a');
  a.href = url;
  a.download = src.title;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * No-API-key workflow: copy the assembled prompt into Claude.ai, then paste the reply back.
 * The reply is saved as a version exactly like an in-app generation.
 */
export function ManualRunModal({
  prompt,
  attachments,
  title,
  onClose,
  onAccept,
  hint = 'It replaces the draft and is saved to version history. Your current draft is saved as a version first.',
  error,
}: {
  prompt: string;
  attachments: Source[];
  title: string;
  onClose: () => void;
  onAccept: (reply: string) => void;
  hint?: string;
  error?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState('');
  const words = useMemo(() => prompt.split(/\s+/).length, [prompt]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => {
    copy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const step = 'flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white';

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="flex gap-3">
          <span className={step}>1</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">
                {copied ? 'Prompt copied to your clipboard.' : 'Copy the prompt.'} <span className="font-normal text-slate-500">({words.toLocaleString()} words, includes your brief, guidelines and sources)</span>
              </p>
              <Btn size="sm" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy prompt'}
              </Btn>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">Show prompt</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-600 ring-1 ring-slate-200">{prompt}</pre>
            </details>
          </div>
        </div>

        <div className="flex gap-3">
          <span className={step}>2</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">Paste it into a new Claude.ai chat{attachments.length > 0 && ' and attach these files'}.</p>
            <a
              href="https://claude.ai/new"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              Open Claude.ai <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {attachments.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {attachments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200">
                    {a.kind === 'pdf' ? <FileType2 className="h-4 w-4 text-rose-500" /> : <ImageIcon className="h-4 w-4 text-slate-500" />}
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{a.path || a.title}</span>
                    <button onClick={() => downloadBlob(a)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-200 hover:text-slate-800">
                      <Download className="h-3 w-3" /> Save copy
                    </button>
                  </div>
                ))}
                <p className="text-[11px] text-slate-500">Drag these into the chat (from your folder, or save a copy here first).</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <span className={step}>3</span>
          <div className="min-w-0 flex-1">
            <label className={labelCls}>Paste Claude's reply here</label>
            <textarea
              className={`${inputCls} h-48 font-mono text-xs leading-relaxed`}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Copy Claude's answer (the copy button under its reply works best) and paste it here…"
            />
            <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
            {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!reply.trim()} onClick={() => onAccept(reply.trim())}>
            <Check className="h-4 w-4" /> Use this reply
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
