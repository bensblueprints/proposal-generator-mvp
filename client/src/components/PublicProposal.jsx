import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, MessageSquare, X, PenLine } from 'lucide-react';
import { api, money } from '../api.js';

export default function PublicProposal({ token }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]); // optional item ids toggled on
  const [modal, setModal] = useState(null); // 'accept' | 'comment' | null
  const viewIdRef = useRef(null);
  const startRef = useRef(Date.now());

  useEffect(() => {
    api.publicProposal(token)
      .then((data) => {
        setP(data);
        setSelected(data.items.filter((it) => it.optional && it.selected_default).map((it) => it.id));
        document.title = `${data.title} — ${data.branding.company_name}`;
        // view tracking: register open, then heartbeat duration every 10s
        api.publicView(token).then((r) => { viewIdRef.current = r.view_id; }).catch(() => {});
      })
      .catch((e) => setError(e.status === 404 ? 'This proposal link is not available.' : e.message));
  }, [token]);

  useEffect(() => {
    const beat = () => {
      if (!viewIdRef.current) return;
      const duration = Math.round((Date.now() - startRef.current) / 1000);
      api.publicHeartbeat(token, viewIdRef.current, duration).catch(() => {});
    };
    const t = setInterval(beat, 10000);
    window.addEventListener('beforeunload', beat);
    return () => { clearInterval(t); window.removeEventListener('beforeunload', beat); };
  }, [token]);

  const total = useMemo(() => {
    if (!p) return 0;
    return p.items.reduce((sum, it) => {
      const line = it.qty * it.price;
      if (!it.optional) return sum + line;
      return selected.includes(it.id) ? sum + line : sum;
    }, 0);
  }, [p, selected]);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center text-zinc-400 px-6 text-center">{error}</div>
    );
  }
  if (!p) return <div className="min-h-screen grid place-items-center text-zinc-500">Loading…</div>;

  const accent = p.branding.accent_color || '#10b981';
  const accepted = p.status === 'accepted' && p.acceptance;

  return (
    <div className="min-h-screen pb-32">
      {/* top bar */}
      <div className="border-b border-zinc-800/70 bg-zinc-950/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-3">
          {p.branding.logo_url
            ? <img src={p.branding.logo_url} alt="" className="h-7 rounded" />
            : <span className="font-semibold" style={{ color: accent }}>{p.branding.company_name}</span>}
          <div className="flex-1" />
          {accepted ? (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: accent }}>
              <CheckCircle2 className="w-4 h-4" /> Accepted by {p.acceptance.signer_name}
            </span>
          ) : (
            <span className="text-xs text-zinc-500">
              Prepared for {p.client_name || 'you'}{p.valid_until ? ` · valid until ${p.valid_until}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {p.blocks.map((b) => (
          <Block key={b.id} block={b} accent={accent}
            items={p.items} currency={p.currency} selected={selected} setSelected={setSelected}
            total={total} locked={!!accepted} />
        ))}
      </div>

      {/* action bar */}
      {!accepted && (
        <div className="fixed bottom-0 inset-x-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur z-30">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3 flex-wrap">
            <div>
              <div className="text-xs text-zinc-500">Total</div>
              <div className="text-xl font-semibold tabular-nums">{money(p.currency, total)}</div>
            </div>
            <div className="flex-1" />
            <button onClick={() => setModal('comment')}
              className="flex items-center gap-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 rounded-xl transition-colors">
              <MessageSquare className="w-4 h-4" /> Request changes
            </button>
            <button onClick={() => setModal('accept')}
              className="flex items-center gap-1.5 text-sm text-zinc-950 font-semibold px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
              style={{ background: accent }}>
              <PenLine className="w-4 h-4" /> Accept proposal
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal === 'accept' && (
          <AcceptModal token={token} currency={p.currency} total={total} selected={selected} accent={accent}
            onClose={() => setModal(null)}
            onAccepted={(acc) => { setModal(null); setP((prev) => ({ ...prev, status: 'accepted', acceptance: acc })); }} />
        )}
        {modal === 'comment' && (
          <CommentModal token={token} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Block({ block, accent, items, currency, selected, setSelected, total, locked }) {
  const c = block.content || {};
  switch (block.type) {
    case 'cover':
      return (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="py-8">
          <h1 className="text-4xl font-bold tracking-tight">{c.heading}</h1>
          {c.subheading && <p className="text-lg text-zinc-400 mt-3">{c.subheading}</p>}
          <div className="h-1 w-16 rounded-full mt-6" style={{ background: accent }} />
        </motion.div>
      );
    case 'text':
    case 'terms':
      return (
        <section>
          {c.heading && <h2 className="text-xl font-semibold mb-3">{c.heading}</h2>}
          <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{c.body}</p>
        </section>
      );
    case 'testimonial':
      return (
        <blockquote className="border-l-2 pl-5 py-1" style={{ borderColor: accent }}>
          <p className="text-lg italic text-zinc-200">“{c.quote}”</p>
          {c.attribution && <footer className="text-sm text-zinc-500 mt-2">— {c.attribution}</footer>}
        </blockquote>
      );
    case 'image':
      return c.url ? (
        <figure>
          <img src={c.url} alt={c.caption || ''} className="rounded-xl w-full" />
          {c.caption && <figcaption className="text-xs text-zinc-500 mt-2 text-center">{c.caption}</figcaption>}
        </figure>
      ) : null;
    case 'pricing':
      return (
        <section>
          {c.heading && <h2 className="text-xl font-semibold mb-3">{c.heading}</h2>}
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {items.map((it) => {
                  const on = !it.optional || selected.includes(it.id);
                  return (
                    <tr key={it.id} className={`border-b border-zinc-800/60 last:border-0 ${on ? '' : 'opacity-45'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {it.optional && !locked && (
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(e) =>
                                setSelected((prev) => e.target.checked ? [...prev, it.id] : prev.filter((x) => x !== it.id))}
                              className="w-4 h-4"
                              style={{ accentColor: accent }}
                            />
                          )}
                          <div>
                            <div className="font-medium">{it.name}
                              {it.optional && <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-500 border border-zinc-700 rounded px-1 py-0.5">optional</span>}
                            </div>
                            {it.description && <div className="text-xs text-zinc-500">{it.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-zinc-400 tabular-nums whitespace-nowrap">{it.qty} × {money(currency, it.price)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">{money(currency, it.qty * it.price)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-zinc-900/70">
                  <td className="px-4 py-3 font-semibold">Total</td>
                  <td />
                  <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: accent }}>{money(currency, total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      );
    default:
      return null;
  }
}

function AcceptModal({ token, currency, total, selected, accent, onClose, onAccepted }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Please type your full name to sign.');
    setBusy(true);
    setError('');
    try {
      const r = await api.publicAccept(token, name.trim(), selected);
      onAccepted({ signer_name: r.signer_name, signed_at: r.signed_at });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <h2 className="font-semibold text-lg">Accept this proposal</h2>
        <p className="text-sm text-zinc-400">
          You're accepting for <span className="font-semibold text-zinc-100">{money(currency, total)}</span>.
          Typing your name below acts as your electronic signature.
        </p>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Full legal name"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500" />
        {name.trim() && (
          <div className="border border-dashed border-zinc-700 rounded-lg px-4 py-3 text-2xl" style={{ fontFamily: 'cursive', color: accent }}>
            {name.trim()}
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy}
          className="w-full text-zinc-950 font-semibold rounded-lg py-2.5 text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: accent }}>
          {busy ? 'Signing…' : `Sign & accept — ${money(currency, total)}`}
        </button>
      </form>
    </Overlay>
  );
}

function CommentModal({ token, onClose }) {
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return setError('Please write what you would like changed.');
    setBusy(true);
    setError('');
    try {
      await api.publicComment(token, author, body.trim());
      setDone(true);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      {done ? (
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-9 h-9 text-emerald-400 mx-auto" />
          <p className="text-sm text-zinc-300">Sent — they'll get back to you with an updated proposal.</p>
          <button onClick={onClose} className="text-sm bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg">Close</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="font-semibold text-lg">Request changes</h2>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name (optional)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} autoFocus
            placeholder="What would you like adjusted?"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500 resize-y" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={busy}
            className="w-full bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50">
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </form>
      )}
    </Overlay>
  );
}

function Overlay({ children, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500">
          <X className="w-4 h-4" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
