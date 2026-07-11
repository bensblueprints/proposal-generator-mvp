import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Reorder } from 'framer-motion';
import {
  ArrowLeft, GripVertical, Trash2, Plus, Send, Link2, Eye, Clock,
  CheckCircle2, MessageSquare, Undo2, Copy as CopyIcon
} from 'lucide-react';
import { api, money, timeAgo } from '../api.js';

const BLOCK_TYPES = [
  { type: 'cover', label: 'Cover' },
  { type: 'text', label: 'Text' },
  { type: 'pricing', label: 'Pricing table' },
  { type: 'terms', label: 'Terms' },
  { type: 'testimonial', label: 'Testimonial' },
  { type: 'image', label: 'Image' }
];

export default function Editor({ id, onBack }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const saveTimers = useRef({});

  const load = useCallback(async () => {
    try {
      setP(await api.proposal(id));
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <div className="text-red-400">{error}</div>;
  if (!p) return <div className="text-zinc-500">Loading…</div>;

  const shareUrl = `${window.location.origin}/p/${p.token}`;

  const patchMeta = (patch) => {
    const next = { ...p, ...patch };
    setP(next);
    clearTimeout(saveTimers.current.meta);
    saveTimers.current.meta = setTimeout(() => {
      api.updateProposal(p.id, {
        title: next.title, client_name: next.client_name, client_email: next.client_email,
        currency: next.currency, valid_until: next.valid_until
      }).catch(() => {});
    }, 500);
  };

  const patchBlock = (blockId, content) => {
    setP((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => (b.id === blockId ? { ...b, content } : b))
    }));
    clearTimeout(saveTimers.current['b' + blockId]);
    saveTimers.current['b' + blockId] = setTimeout(() => {
      api.updateBlock(p.id, blockId, content).catch(() => {});
    }, 500);
  };

  const addBlock = async (type) => {
    const defaults = {
      cover: { heading: 'New section', subheading: '' },
      text: { heading: 'Heading', body: '' },
      pricing: { heading: 'Pricing' },
      terms: { heading: 'Terms', body: '' },
      testimonial: { quote: '', attribution: '' },
      image: { url: '', caption: '' }
    };
    const r = await api.addBlock(p.id, type, defaults[type]);
    setP((prev) => ({ ...prev, blocks: r.blocks }));
  };

  const removeBlock = async (blockId) => {
    const r = await api.deleteBlock(p.id, blockId);
    setP((prev) => ({ ...prev, blocks: r.blocks }));
  };

  const onReorder = (newBlocks) => {
    setP((prev) => ({ ...prev, blocks: newBlocks }));
    clearTimeout(saveTimers.current.reorder);
    saveTimers.current.reorder = setTimeout(() => {
      api.reorderBlocks(p.id, newBlocks.map((b) => b.id)).catch(() => {});
    }, 400);
  };

  // line items
  const addItem = async () => {
    const r = await api.addItem(p.id, { name: 'New line item', qty: 1, price: 0 });
    setP((prev) => ({ ...prev, items: r.items, total: r.total }));
  };
  const pRef = useRef(p);
  pRef.current = p;
  const patchItem = (itemId, patch) => {
    setP((prev) => {
      const items = prev.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it));
      return { ...prev, items };
    });
    clearTimeout(saveTimers.current['i' + itemId]);
    saveTimers.current['i' + itemId] = setTimeout(async () => {
      const local = pRef.current.items.find((x) => x.id === itemId);
      if (!local) return;
      const r = await api.updateItem(p.id, itemId, local).catch(() => null);
      if (r) setP((prev) => ({ ...prev, total: r.total }));
    }, 600);
  };
  const removeItem = async (itemId) => {
    const r = await api.deleteItem(p.id, itemId);
    setP((prev) => ({ ...prev, items: r.items, total: r.total }));
  };

  const send = async () => {
    await api.sendProposal(p.id);
    load();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><ArrowLeft className="w-4 h-4" /></button>
        <input
          value={p.title}
          onChange={(e) => patchMeta({ title: e.target.value })}
          className="bg-transparent text-lg font-semibold focus:outline-none focus:border-b focus:border-emerald-500 flex-1 min-w-48"
        />
        <div className="flex items-center gap-2">
          {p.status === 'draft' ? (
            <button onClick={send}
              className="flex items-center gap-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-3 py-1.5 rounded-lg transition-colors">
              <Send className="w-4 h-4" /> Activate share link
            </button>
          ) : (
            <>
              <button onClick={copyLink}
                className="flex items-center gap-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy client link'}
              </button>
              {p.status !== 'accepted' && (
                <button onClick={async () => { await api.revertDraft(p.id); load(); }}
                  title="Deactivate link"
                  className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><Undo2 className="w-4 h-4" /></button>
              )}
            </>
          )}
        </div>
      </div>

      {/* status strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric icon={Eye} label="Views" value={p.view_count} sub={p.last_viewed_at ? `last ${timeAgo(p.last_viewed_at)}` : 'not opened yet'} />
        <Metric icon={Clock} label="Time reading" value={`${Math.round((p.total_seconds || 0) / 60)}m`} />
        <Metric icon={MessageSquare} label="Comments" value={p.comment_count} />
        <Metric icon={CheckCircle2} label="Status" value={p.status === 'accepted' && p.acceptance ? p.acceptance.signer_name : p.status.replace('_', ' ')}
          accent={p.status === 'accepted'} />
      </div>

      {p.comments?.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
          <div className="text-sm font-medium text-amber-400">Client comments</div>
          {p.comments.map((c) => (
            <div key={c.id} className="text-sm text-zinc-300">
              <span className="text-zinc-500 text-xs mr-2">{c.author || 'Client'} · {timeAgo(c.created_at)}</span>
              {c.body}
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        {/* blocks column */}
        <div className="lg:col-span-2 space-y-3">
          <Reorder.Group axis="y" values={p.blocks} onReorder={onReorder} className="space-y-3">
            {p.blocks.map((b) => (
              <Reorder.Item key={b.id} value={b}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <GripVertical className="w-4 h-4 text-zinc-600 cursor-grab active:cursor-grabbing" />
                  <span className="text-xs uppercase tracking-wide text-zinc-500">{b.type}</span>
                  <div className="flex-1" />
                  <button onClick={() => removeBlock(b.id)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <BlockEditor block={b} onChange={(content) => patchBlock(b.id, content)}
                  items={p.items} currency={p.currency} total={p.total}
                  onAddItem={addItem} onPatchItem={patchItem} onRemoveItem={removeItem} />
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <div className="flex flex-wrap gap-2">
            {BLOCK_TYPES.map((bt) => (
              <button key={bt.type} onClick={() => addBlock(bt.type)}
                className="flex items-center gap-1 text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-600 px-2.5 py-1.5 rounded-lg text-zinc-400 transition-colors">
                <Plus className="w-3 h-3" /> {bt.label}
              </button>
            ))}
          </div>
        </div>

        {/* meta column */}
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium">Client</h3>
            <Field label="Client name" value={p.client_name} onChange={(v) => patchMeta({ client_name: v })} />
            <Field label="Client email" value={p.client_email} onChange={(v) => patchMeta({ client_email: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Currency" value={p.currency} onChange={(v) => patchMeta({ currency: v })} />
              <Field label="Valid until" value={p.valid_until} onChange={(v) => patchMeta({ valid_until: v })} placeholder="2026-08-01" />
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-medium mb-1">Proposal total</h3>
            <div className="text-2xl font-semibold tabular-nums">{money(p.currency, p.total)}</div>
            <p className="text-xs text-zinc-500 mt-1">
              Required items + optional add-ons the client leaves toggled on.
            </p>
          </div>
          {p.status !== 'draft' && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-emerald-400" /> Client link</h3>
              <code className="block text-xs text-emerald-400/90 break-all bg-zinc-950 border border-zinc-800 rounded-lg p-2">{shareUrl}</code>
              <button onClick={copyLink} className="w-full flex items-center justify-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 px-2.5 py-2 rounded-lg transition-colors">
                <CopyIcon className="w-3 h-3" /> Copy link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3">
      <div className="text-xs text-zinc-500 flex items-center gap-1.5"><Icon className="w-3 h-3" /> {label}</div>
      <div className={`text-lg font-semibold capitalize ${accent ? 'text-emerald-400' : ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-600">{sub}</div>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
    </label>
  );
}

function BlockEditor({ block, onChange, items, currency, total, onAddItem, onPatchItem, onRemoveItem }) {
  const c = block.content || {};
  const set = (patch) => onChange({ ...c, ...patch });

  switch (block.type) {
    case 'cover':
      return (
        <div className="space-y-2">
          <input value={c.heading || ''} onChange={(e) => set({ heading: e.target.value })} placeholder="Big heading"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-base font-semibold focus:outline-none focus:border-emerald-500" />
          <input value={c.subheading || ''} onChange={(e) => set({ subheading: e.target.value })} placeholder="Subheading"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
        </div>
      );
    case 'text':
    case 'terms':
      return (
        <div className="space-y-2">
          <input value={c.heading || ''} onChange={(e) => set({ heading: e.target.value })} placeholder="Heading"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-emerald-500" />
          <textarea value={c.body || ''} onChange={(e) => set({ body: e.target.value })} rows={5} placeholder="Body text — line breaks are kept"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-y" />
        </div>
      );
    case 'testimonial':
      return (
        <div className="space-y-2">
          <textarea value={c.quote || ''} onChange={(e) => set({ quote: e.target.value })} rows={2} placeholder="“What the happy client said”"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm italic focus:outline-none focus:border-emerald-500 resize-y" />
          <input value={c.attribution || ''} onChange={(e) => set({ attribution: e.target.value })} placeholder="— Name, Company"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
        </div>
      );
    case 'image':
      return (
        <div className="space-y-2">
          <input value={c.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="Image URL (https://…)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
          <input value={c.caption || ''} onChange={(e) => set({ caption: e.target.value })} placeholder="Caption (optional)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
          {c.url && <img src={c.url} alt="" className="rounded-lg max-h-48 object-cover" />}
        </div>
      );
    case 'pricing':
      return (
        <div className="space-y-2">
          <input value={c.heading || ''} onChange={(e) => set({ heading: e.target.value })} placeholder="Pricing heading"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:border-emerald-500" />
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 bg-zinc-950">
                  <th className="text-left font-medium px-3 py-2">Item</th>
                  <th className="text-right font-medium px-2 py-2 w-16">Qty</th>
                  <th className="text-right font-medium px-2 py-2 w-24">Price</th>
                  <th className="text-center font-medium px-2 py-2 w-20">Optional</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-zinc-800/60">
                    <td className="px-3 py-1.5">
                      <input value={it.name} onChange={(e) => onPatchItem(it.id, { name: e.target.value })}
                        className="w-full bg-transparent focus:outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0.1" step="any" value={it.qty}
                        onChange={(e) => onPatchItem(it.id, { qty: Number(e.target.value) })}
                        className="w-full bg-transparent text-right focus:outline-none tabular-nums" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="any" value={it.price}
                        onChange={(e) => onPatchItem(it.id, { price: Number(e.target.value) })}
                        className="w-full bg-transparent text-right focus:outline-none tabular-nums" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={!!it.optional}
                        onChange={(e) => onPatchItem(it.id, { optional: e.target.checked ? 1 : 0 })}
                        className="accent-emerald-500" />
                    </td>
                    <td className="px-1 py-1.5">
                      <button onClick={() => onRemoveItem(it.id)} className="p-1 text-zinc-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-800 bg-zinc-950">
                  <td colSpan={2} className="px-3 py-2">
                    <button onClick={onAddItem} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                      <Plus className="w-3 h-3" /> Add line item
                    </button>
                  </td>
                  <td colSpan={3} className="px-3 py-2 text-right font-semibold tabular-nums">{money(currency, total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-zinc-600">Optional items become client-side toggles that change the live total on the shared page.</p>
        </div>
      );
    default:
      return null;
  }
}
