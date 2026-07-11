import React, { useEffect, useState, useCallback } from 'react';
import { ScrollText, Settings as SettingsIcon, LogOut, Plus } from 'lucide-react';
import { api } from './api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import Editor from './components/Editor.jsx';
import Settings from './components/Settings.jsx';
import NewProposalModal from './components/NewProposalModal.jsx';
import PublicProposal from './components/PublicProposal.jsx';

export default function App() {
  // Public client-facing route: /p/<token> — no auth, separate experience.
  const publicMatch = window.location.pathname.match(/^\/p\/([A-Za-z0-9]+)/);
  if (publicMatch) return <PublicProposal token={publicMatch[1]} />;
  return <AdminApp />;
}

function AdminApp() {
  const [authed, setAuthed] = useState(null); // null = checking
  const [view, setView] = useState({ name: 'dashboard' });
  const [proposals, setProposals] = useState([]);
  const [showNew, setShowNew] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setProposals(await api.proposals());
    } catch (e) {
      if (e.status === 401) setAuthed(false);
    }
  }, []);

  useEffect(() => {
    api.me().then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (!authed) return;
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [authed, refresh]);

  if (authed === null) {
    return <div className="min-h-screen grid place-items-center text-zinc-500">Loading…</div>;
  }
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => setView({ name: 'dashboard' })}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <ScrollText className="w-5 h-5 text-emerald-400" />
            Pitchcraft
          </button>
          <span className="text-xs text-zinc-500 hidden sm:block">
            proposals that close — no monthly ransom
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New proposal
          </button>
          <button
            onClick={() => setView({ name: 'settings' })}
            className={`p-2 rounded-lg hover:bg-zinc-800 transition-colors ${view.name === 'settings' ? 'text-emerald-400' : 'text-zinc-400'}`}
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={async () => { await api.logout(); setAuthed(false); }}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {view.name === 'dashboard' && (
          <Dashboard
            proposals={proposals}
            onOpen={(id) => setView({ name: 'editor', id })}
            onNew={() => setShowNew(true)}
            onChanged={refresh}
          />
        )}
        {view.name === 'editor' && (
          <Editor id={view.id} onBack={() => { setView({ name: 'dashboard' }); refresh(); }} />
        )}
        {view.name === 'settings' && <Settings />}
      </main>

      {showNew && (
        <NewProposalModal
          onClose={() => setShowNew(false)}
          onCreated={(p) => { setShowNew(false); refresh(); setView({ name: 'editor', id: p.id }); }}
        />
      )}
    </div>
  );
}
