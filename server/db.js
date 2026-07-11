const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function nativeBindingPath() {
  // Under Electron the Node-ABI binding won't load; use the vendored Electron prebuild.
  if (!process.versions.electron) return null;
  const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node');
  return fs.existsSync(p) ? p : null;
}

// 22-char URL-safe base62 token (crypto-strong, no ESM dep).
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function genToken(len = 22) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function openDb(dbPath) {
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const nativeBinding = nativeBindingPath();
  const db = new Database(dbPath, nativeBinding ? { nativeBinding } : {});
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      client_name TEXT DEFAULT '',
      client_email TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',   -- draft|sent|accepted|changes_requested
      token TEXT NOT NULL UNIQUE,
      currency TEXT NOT NULL DEFAULT '$',
      valid_until TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      type TEXT NOT NULL,                      -- cover|text|pricing|terms|testimonial|image
      content_json TEXT NOT NULL DEFAULT '{}',
      sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS line_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      qty REAL NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      optional INTEGER NOT NULL DEFAULT 0,
      selected_default INTEGER NOT NULL DEFAULT 1,
      sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      viewed_at INTEGER NOT NULL,
      duration_s INTEGER NOT NULL DEFAULT 0,
      ip TEXT DEFAULT '',
      ua TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS acceptances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      signer_name TEXT NOT NULL,
      signed_at INTEGER NOT NULL,
      ip TEXT DEFAULT '',
      selected_items_json TEXT NOT NULL DEFAULT '[]',
      total REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER NOT NULL,
      author TEXT DEFAULT '',
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_blocks_proposal ON blocks(proposal_id, sort);
    CREATE INDEX IF NOT EXISTS idx_items_proposal ON line_items(proposal_id, sort);
    CREATE INDEX IF NOT EXISTS idx_views_proposal ON views(proposal_id, viewed_at);
  `);

  return db;
}

const DEFAULT_SETTINGS = {
  company_name: 'Your Company',
  logo_url: '',
  accent_color: '#10b981',
  base_url: '',
  notify_email: '',
  smtp_host: '',
  smtp_port: '587',
  smtp_user: '',
  smtp_pass: '',
  smtp_from: ''
};

function getSettings(db) {
  const out = { ...DEFAULT_SETTINGS };
  if (process.env.SMTP_HOST) out.smtp_host = process.env.SMTP_HOST;
  if (process.env.SMTP_PORT) out.smtp_port = process.env.SMTP_PORT;
  if (process.env.SMTP_USER) out.smtp_user = process.env.SMTP_USER;
  if (process.env.SMTP_PASS) out.smtp_pass = process.env.SMTP_PASS;
  if (process.env.SMTP_FROM) out.smtp_from = process.env.SMTP_FROM;
  if (process.env.BASE_URL) out.base_url = process.env.BASE_URL;
  if (process.env.NOTIFY_EMAIL) out.notify_email = process.env.NOTIFY_EMAIL;
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    if (r.value !== '' && r.value != null) out[r.key] = r.value;
  }
  return out;
}

function setSettings(db, obj) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      if (k in DEFAULT_SETTINGS) stmt.run(k, String(v ?? ''));
    }
  });
  tx(Object.entries(obj));
}

module.exports = { openDb, genToken, getSettings, setSettings, DEFAULT_SETTINGS };
