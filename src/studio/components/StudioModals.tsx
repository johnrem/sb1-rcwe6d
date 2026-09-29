import { useState } from 'react';
import { KeyRound, ShieldAlert } from 'lucide-react';
import type { Project, Settings } from '../types';
import { MODELS } from '../claude';
import { Btn, Modal, inputCls, labelCls } from './ui';

export function SettingsModal({ settings, onSave, onClose }: { settings: Settings; onSave: (s: Settings) => void; onClose: () => void }) {
  const [s, setS] = useState(settings);
  const isHaiku = s.model.startsWith('claude-haiku');
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Anthropic API key (optional)</label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input type="password" autoComplete="off" className={`${inputCls} pl-9 font-mono`} value={s.apiKey} onChange={(e) => setS({ ...s, apiKey: e.target.value.trim() })} placeholder="sk-ant-…" />
          </div>
          <p className="mt-1.5 flex gap-1.5 text-[11px] leading-relaxed text-slate-500">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-500" />
            Optional. Without a key, Generate and Refine use copy & paste with your Claude.ai account. With a key, drafts stream straight into the editor. The key is stored only in this browser and sent only to api.anthropic.com, so don't use it on a shared computer or deploy it publicly. Get one at console.anthropic.com.
          </p>
        </div>
        <div>
          <label className={labelCls}>Model</label>
          <select className={inputCls} value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Effort</label>
          <div className="grid grid-cols-5 gap-1">
            {(['low', 'medium', 'high', 'xhigh', 'max'] as const).map((e) => (
              <button
                key={e}
                disabled={isHaiku}
                onClick={() => setS({ ...s, effort: e })}
                className={`rounded-lg py-1.5 text-xs font-medium capitalize transition disabled:opacity-40 ${s.effort === e ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
              >
                {e}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Higher effort thinks harder: better strategy and fewer misses, but slower and costlier. “High” suits most ad work.</p>
        </div>
        <div>
          <label className={labelCls}>Folder auto-sync interval (seconds)</label>
          <input type="number" min={5} className={inputCls} value={s.syncIntervalSec} onChange={(e) => setS({ ...s, syncIntervalSec: Math.max(5, Number(e.target.value) || 30) })} />
        </div>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              onSave(s);
              onClose();
            }}
          >
            Save settings
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export function GuidelinesModal({ project, onSave, onClose }: { project: Project; onSave: (p: Partial<Project>) => void; onClose: () => void }) {
  const [name, setName] = useState(project.name);
  const [guidelines, setGuidelines] = useState(project.guidelines);
  return (
    <Modal title="Project settings & guidelines" onClose={onClose} wide>
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Project name</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Guidelines sent with every generation in this project</label>
          <textarea
            className={`${inputCls} h-72 font-mono text-xs leading-relaxed`}
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            placeholder={`Brand voice: bold, playful, never mean-spirited.\nAlways say "BattleBots", never "Battle Bots".\nKey facts: …\nNever mention: …\nCTA style: …`}
          />
          <p className="mt-1 text-[11px] text-slate-500">This is where the rules you'd otherwise repeat in every chat go: voice, banned words, product facts, legal lines.</p>
        </div>
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              onSave({ name: name.trim() || project.name, guidelines });
              onClose();
            }}
          >
            Save
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
