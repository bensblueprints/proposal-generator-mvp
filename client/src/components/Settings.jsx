import React, { useEffect, useState } from 'react';
import { Save, Palette, Mail } from 'lucide-react';
import { api } from '../api.js';

export default function Settings() {
  const [s, setS] = useState(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.settings().then(setS).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="text-red-400">{error}</div>;
  if (!s) return <div className="text-zinc-500">Loading…</div>;

  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    await api.saveSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="font-medium flex items-center gap-2"><Palette className="w-4 h-4 text-emerald-400" /> Branding</h2>
        <p className="text-xs text-zinc-500">Shown on every client-facing proposal page.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Company name" value={s.company_name} onChange={set('company_name')} />
          <Field label="Logo URL" value={s.logo_url} onChange={set('logo_url')} placeholder="https://…/logo.png" />
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Accent color</span>
            <div className="flex gap-2 items-center">
              <input type="color" value={s.accent_color || '#10b981'} onChange={set('accent_color')}
                className="h-9 w-12 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer" />
              <input value={s.accent_color} onChange={set('accent_color')}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
            </div>
          </label>
          <Field label="Public base URL" value={s.base_url} onChange={set('base_url')} placeholder="https://proposals.yourdomain.com" />
        </div>
      </section>

      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="font-medium flex items-center gap-2"><Mail className="w-4 h-4 text-emerald-400" /> Email notifications (optional)</h2>
        <p className="text-xs text-zinc-500">Get an email when a proposal is first opened, accepted, or commented on. Leave blank to skip.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Notify email (you)" value={s.notify_email} onChange={set('notify_email')} placeholder="you@yourdomain.com" />
          <Field label="SMTP host" value={s.smtp_host} onChange={set('smtp_host')} placeholder="smtp.fastmail.com" />
          <Field label="SMTP port" value={s.smtp_port} onChange={set('smtp_port')} />
          <Field label="SMTP user" value={s.smtp_user} onChange={set('smtp_user')} />
          <Field label="SMTP password" value={s.smtp_pass} onChange={set('smtp_pass')} type="password" />
          <Field label="From address" value={s.smtp_from} onChange={set('smtp_from')} />
        </div>
      </section>

      <button className="flex items-center gap-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-medium px-4 py-2 rounded-lg transition-colors">
        <Save className="w-4 h-4" /> {saved ? 'Saved!' : 'Save settings'}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder}
        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
    </label>
  );
}
