import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Eye, Clock, Copy, Trash2, CheckCircle2, MessageSquare } from 'lucide-react';
import { api, timeAgo, money } from '../api.js';

const STATUS_STYLES = {
  draft: 'bg-zinc-800 text-zinc-400',
  sent: 'bg-sky-500/15 text-sky-400',
  accepted: 'bg-emerald-500/15 text-emerald-400',
  changes_requested: 'bg-amber-500/15 text-amber-400'
};
const STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  changes_requested: 'Changes requested'
};

export default function Dashboard({ proposals, onOpen, onNew, onChanged }) {
  if (!proposals.length) {
    return (
      <div className="text-center py-24 space-y-4">
        <FileText className="w-10 h-10 text-zinc-700 mx-auto" />
        <p className="text-zinc-400">No proposals yet.</p>
        <button
          onClick={onNew}
          className="text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Create your first proposal
        </button>
      </div>
    );
  }

  const accepted = proposals.filter((p) => p.status === 'accepted');
  const pipeline = proposals.filter((p) => p.status === 'sent');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Proposals" value={proposals.length} />
        <Stat label="In pipeline" value={money('$', pipeline.reduce((s, p) => s + p.total, 0))} />
        <Stat label="Accepted" value={accepted.length} />
        <Stat label="Won value" value={money('$', accepted.reduce((s, p) => s + (p.acceptance ? p.acceptance.total : p.total), 0))} />
      </div>

      <div className="space-y-2">
        {proposals.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="group bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors"
            onClick={() => onOpen(p.id)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="font-medium truncate">{p.title}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-1 flex items-center gap-3 flex-wrap">
                {p.client_name && <span>{p.client_name}</span>}
                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {p.view_count} views</span>
                {p.total_seconds > 0 && (
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.round(p.total_seconds / 60)}m read</span>
                )}
                {p.comment_count > 0 && (
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {p.comment_count}</span>
                )}
                <span>updated {timeAgo(p.updated_at)}</span>
              </div>
            </div>
            {p.status === 'accepted' && p.acceptance && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> {p.acceptance.signer_name}
              </span>
            )}
            <span className="font-semibold text-sm tabular-nums">{money(p.currency, p.total)}</span>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                title="Duplicate"
                onClick={async () => { await api.duplicateProposal(p.id); onChanged(); }}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                title="Delete"
                onClick={async () => { if (confirm(`Delete "${p.title}"?`)) { await api.deleteProposal(p.id); onChanged(); } }}
                className="p-2 rounded-lg hover:bg-zinc-800 text-red-400/80"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
