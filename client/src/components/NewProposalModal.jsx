import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, LayoutTemplate } from 'lucide-react';
import { api } from '../api.js';

export default function NewProposalModal({ onClose, onCreated }) {
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('blank');
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.templates().then(setTemplates).catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const p = await api.createProposal({ template_id: templateId, title: title.trim() || undefined, client_name: clientName });
      onCreated(p);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6" onClick={onClose}>
      <motion.form
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={create}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><LayoutTemplate className="w-4 h-4 text-emerald-400" /> New proposal</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`text-left rounded-xl border px-3.5 py-3 transition-colors ${templateId === t.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/50'}`}
            >
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{t.description}</div>
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Title (optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="Template default" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Client name</span>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="Acme Inc." />
          </label>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-medium rounded-lg py-2 text-sm transition-colors">
          {busy ? 'Creating…' : 'Create proposal'}
        </button>
      </motion.form>
    </div>
  );
}
