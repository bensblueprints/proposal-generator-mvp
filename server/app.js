const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const { openDb, genToken, getSettings, setSettings } = require('./db');
const { TEMPLATES } = require('./templates');
const { sendNotification } = require('./email');

const SESSION_COOKIE = 'pk_session';

function createApp({ dbPath, adminPassword, autologinToken = null } = {}) {
  const db = openDb(dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));

  app.locals.db = db;

  const findById = db.prepare('SELECT * FROM proposals WHERE id = ?');
  const findByToken = db.prepare('SELECT * FROM proposals WHERE token = ?');

  function requireAuth(req, res, next) {
    const token = req.cookies[SESSION_COOKIE];
    if (token && db.prepare('SELECT id FROM sessions WHERE token = ?').get(token)) return next();
    res.status(401).json({ error: 'unauthorized' });
  }

  function createSession(res) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token, created_at) VALUES (?, ?)').run(token, Date.now());
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax' });
  }

  function blocksOf(id) {
    return db.prepare('SELECT * FROM blocks WHERE proposal_id = ? ORDER BY sort, id').all(id)
      .map((b) => ({ ...b, content: safeParse(b.content_json) }));
  }
  function itemsOf(id) {
    return db.prepare('SELECT * FROM line_items WHERE proposal_id = ? ORDER BY sort, id').all(id);
  }
  function safeParse(s) {
    try { return JSON.parse(s || '{}'); } catch { return {}; }
  }

  /** Base total = required items + default-selected optional items. */
  function computeTotal(items, selectedOptionalIds = null) {
    let total = 0;
    for (const it of items) {
      const line = Number(it.qty) * Number(it.price);
      if (!it.optional) total += line;
      else if (selectedOptionalIds ? selectedOptionalIds.includes(it.id) : it.selected_default) total += line;
    }
    return Math.round(total * 100) / 100;
  }

  function viewStats(id) {
    const row = db.prepare(
      'SELECT COUNT(*) AS view_count, MAX(viewed_at) AS last_viewed_at, COALESCE(SUM(duration_s),0) AS total_seconds FROM views WHERE proposal_id = ?'
    ).get(id);
    return row;
  }

  function serialize(p, { deep = false } = {}) {
    const items = itemsOf(p.id);
    const out = {
      ...p,
      total: computeTotal(items),
      ...viewStats(p.id),
      acceptance: db.prepare('SELECT * FROM acceptances WHERE proposal_id = ? ORDER BY signed_at DESC').get(p.id) || null,
      comment_count: db.prepare('SELECT COUNT(*) AS n FROM comments WHERE proposal_id = ?').get(p.id).n
    };
    if (deep) {
      out.blocks = blocksOf(p.id);
      out.items = items;
      out.comments = db.prepare('SELECT * FROM comments WHERE proposal_id = ? ORDER BY created_at').all(p.id);
      out.views = db.prepare('SELECT * FROM views WHERE proposal_id = ? ORDER BY viewed_at DESC LIMIT 50').all(p.id);
    }
    return out;
  }

  function notify(subject, text) {
    sendNotification(getSettings(db), subject, text).catch((e) => console.warn('[email]', e.message));
  }

  // ── auth ────────────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => res.json({ ok: true, app: 'pitchcraft' }));

  app.post('/api/login', (req, res) => {
    if ((req.body || {}).password !== adminPassword) return res.status(401).json({ error: 'wrong password' });
    createSession(res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  });

  // Desktop mode auto-login (Electron passes a one-shot token).
  app.get('/auth/auto', (req, res) => {
    if (autologinToken && req.query.token === autologinToken) createSession(res);
    res.redirect('/');
  });

  app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true }));

  // ── templates ───────────────────────────────────────────────────────────
  app.get('/api/templates', requireAuth, (req, res) => {
    res.json(TEMPLATES.map(({ id, name, description }) => ({ id, name, description })));
  });

  // ── proposals CRUD ──────────────────────────────────────────────────────
  app.get('/api/proposals', requireAuth, (req, res) => {
    const rows = db.prepare('SELECT * FROM proposals ORDER BY updated_at DESC').all();
    res.json(rows.map((p) => serialize(p)));
  });

  app.post('/api/proposals', requireAuth, (req, res) => {
    const body = req.body || {};
    const tpl = body.template_id ? TEMPLATES.find((t) => t.id === body.template_id) : null;
    if (body.template_id && !tpl) return res.status(400).json({ error: 'unknown template' });
    const title = String(body.title || (tpl ? tpl.title : '')).trim() || 'Untitled proposal';
    const now = Date.now();
    const info = db.prepare(
      'INSERT INTO proposals (title, client_name, client_email, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, String(body.client_name || ''), String(body.client_email || ''), genToken(), now, now);
    const id = info.lastInsertRowid;
    if (tpl) {
      const insBlock = db.prepare('INSERT INTO blocks (proposal_id, type, content_json, sort) VALUES (?, ?, ?, ?)');
      tpl.blocks.forEach((b, i) => insBlock.run(id, b.type, JSON.stringify(b.content), i));
      const insItem = db.prepare(
        'INSERT INTO line_items (proposal_id, name, description, qty, price, optional, selected_default, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      tpl.items.forEach((it, i) =>
        insItem.run(id, it.name, it.description || '', it.qty, it.price, it.optional ? 1 : 0,
          it.selected_default == null ? 1 : (it.selected_default ? 1 : 0), i));
    } else {
      db.prepare('INSERT INTO blocks (proposal_id, type, content_json, sort) VALUES (?, ?, ?, 0)')
        .run(id, 'cover', JSON.stringify({ heading: title, subheading: '' }));
    }
    res.status(201).json(serialize(findById.get(id), { deep: true }));
  });

  app.get('/api/proposals/:id', requireAuth, (req, res) => {
    const p = findById.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    res.json(serialize(p, { deep: true }));
  });

  app.put('/api/proposals/:id', requireAuth, (req, res) => {
    const p = findById.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    const b = req.body || {};
    db.prepare(
      'UPDATE proposals SET title = ?, client_name = ?, client_email = ?, currency = ?, valid_until = ?, updated_at = ? WHERE id = ?'
    ).run(
      String(b.title ?? p.title).trim() || p.title,
      String(b.client_name ?? p.client_name),
      String(b.client_email ?? p.client_email),
      String(b.currency ?? p.currency) || '$',
      String(b.valid_until ?? p.valid_until),
      Date.now(), p.id
    );
    res.json(serialize(findById.get(p.id), { deep: true }));
  });

  app.delete('/api/proposals/:id', requireAuth, (req, res) => {
    const p = findById.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    for (const t of ['blocks', 'line_items', 'views', 'acceptances', 'comments']) {
      db.prepare(`DELETE FROM ${t} WHERE proposal_id = ?`).run(p.id);
    }
    db.prepare('DELETE FROM proposals WHERE id = ?').run(p.id);
    res.json({ ok: true });
  });

  app.post('/api/proposals/:id/duplicate', requireAuth, (req, res) => {
    const p = findById.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    const now = Date.now();
    const info = db.prepare(
      'INSERT INTO proposals (title, client_name, client_email, currency, valid_until, token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(p.title + ' (copy)', p.client_name, p.client_email, p.currency, p.valid_until, genToken(), now, now);
    const id = info.lastInsertRowid;
    for (const b of blocksOf(p.id)) {
      db.prepare('INSERT INTO blocks (proposal_id, type, content_json, sort) VALUES (?, ?, ?, ?)')
        .run(id, b.type, b.content_json, b.sort);
    }
    for (const it of itemsOf(p.id)) {
      db.prepare('INSERT INTO line_items (proposal_id, name, description, qty, price, optional, selected_default, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, it.name, it.description, it.qty, it.price, it.optional, it.selected_default, it.sort);
    }
    res.status(201).json(serialize(findById.get(id), { deep: true }));
  });

  // Mark as sent — activates the public link.
  app.post('/api/proposals/:id/send', requireAuth, (req, res) => {
    const p = findById.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    db.prepare("UPDATE proposals SET status = 'sent', updated_at = ? WHERE id = ?").run(Date.now(), p.id);
    res.json(serialize(findById.get(p.id)));
  });

  app.post('/api/proposals/:id/revert-draft', requireAuth, (req, res) => {
    const p = findById.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    db.prepare("UPDATE proposals SET status = 'draft', updated_at = ? WHERE id = ?").run(Date.now(), p.id);
    res.json(serialize(findById.get(p.id)));
  });

  // ── blocks ──────────────────────────────────────────────────────────────
  const BLOCK_TYPES = ['cover', 'text', 'pricing', 'terms', 'testimonial', 'image'];

  app.post('/api/proposals/:id/blocks', requireAuth, (req, res) => {
    const p = findById.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    const { type, content } = req.body || {};
    if (!BLOCK_TYPES.includes(type)) return res.status(400).json({ error: 'invalid block type' });
    const max = db.prepare('SELECT COALESCE(MAX(sort), -1) AS m FROM blocks WHERE proposal_id = ?').get(p.id).m;
    const info = db.prepare('INSERT INTO blocks (proposal_id, type, content_json, sort) VALUES (?, ?, ?, ?)')
      .run(p.id, type, JSON.stringify(content || {}), max + 1);
    db.prepare('UPDATE proposals SET updated_at = ? WHERE id = ?').run(Date.now(), p.id);
    res.status(201).json({ id: info.lastInsertRowid, blocks: blocksOf(p.id) });
  });

  app.put('/api/proposals/:id/blocks/:blockId', requireAuth, (req, res) => {
    const b = db.prepare('SELECT * FROM blocks WHERE id = ? AND proposal_id = ?').get(req.params.blockId, req.params.id);
    if (!b) return res.status(404).json({ error: 'not found' });
    db.prepare('UPDATE blocks SET content_json = ? WHERE id = ?').run(JSON.stringify((req.body || {}).content || {}), b.id);
    db.prepare('UPDATE proposals SET updated_at = ? WHERE id = ?').run(Date.now(), b.proposal_id);
    res.json({ blocks: blocksOf(b.proposal_id) });
  });

  app.delete('/api/proposals/:id/blocks/:blockId', requireAuth, (req, res) => {
    const b = db.prepare('SELECT * FROM blocks WHERE id = ? AND proposal_id = ?').get(req.params.blockId, req.params.id);
    if (!b) return res.status(404).json({ error: 'not found' });
    db.prepare('DELETE FROM blocks WHERE id = ?').run(b.id);
    res.json({ blocks: blocksOf(b.proposal_id) });
  });

  // Reorder: body { order: [blockId, ...] }
  app.post('/api/proposals/:id/blocks/reorder', requireAuth, (req, res) => {
    const p = findById.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    const order = (req.body || {}).order;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of block ids' });
    const upd = db.prepare('UPDATE blocks SET sort = ? WHERE id = ? AND proposal_id = ?');
    const tx = db.transaction(() => order.forEach((bid, i) => upd.run(i, bid, p.id)));
    tx();
    res.json({ blocks: blocksOf(p.id) });
  });

  // ── line items ──────────────────────────────────────────────────────────
  app.post('/api/proposals/:id/items', requireAuth, (req, res) => {
    const p = findById.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    const qty = Number(b.qty);
    const price = Number(b.price);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'qty must be > 0' });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'price must be >= 0' });
    const max = db.prepare('SELECT COALESCE(MAX(sort), -1) AS m FROM line_items WHERE proposal_id = ?').get(p.id).m;
    db.prepare('INSERT INTO line_items (proposal_id, name, description, qty, price, optional, selected_default, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(p.id, name, String(b.description || ''), qty, price, b.optional ? 1 : 0,
        b.selected_default == null ? 1 : (b.selected_default ? 1 : 0), max + 1);
    res.status(201).json({ items: itemsOf(p.id), total: computeTotal(itemsOf(p.id)) });
  });

  app.put('/api/proposals/:id/items/:itemId', requireAuth, (req, res) => {
    const it = db.prepare('SELECT * FROM line_items WHERE id = ? AND proposal_id = ?').get(req.params.itemId, req.params.id);
    if (!it) return res.status(404).json({ error: 'not found' });
    const b = req.body || {};
    const qty = b.qty == null ? it.qty : Number(b.qty);
    const price = b.price == null ? it.price : Number(b.price);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'qty must be > 0' });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'price must be >= 0' });
    db.prepare('UPDATE line_items SET name = ?, description = ?, qty = ?, price = ?, optional = ?, selected_default = ? WHERE id = ?')
      .run(
        String(b.name ?? it.name).trim() || it.name,
        String(b.description ?? it.description),
        qty, price,
        b.optional == null ? it.optional : (b.optional ? 1 : 0),
        b.selected_default == null ? it.selected_default : (b.selected_default ? 1 : 0),
        it.id
      );
    res.json({ items: itemsOf(it.proposal_id), total: computeTotal(itemsOf(it.proposal_id)) });
  });

  app.delete('/api/proposals/:id/items/:itemId', requireAuth, (req, res) => {
    const it = db.prepare('SELECT * FROM line_items WHERE id = ? AND proposal_id = ?').get(req.params.itemId, req.params.id);
    if (!it) return res.status(404).json({ error: 'not found' });
    db.prepare('DELETE FROM line_items WHERE id = ?').run(it.id);
    res.json({ items: itemsOf(it.proposal_id), total: computeTotal(itemsOf(it.proposal_id)) });
  });

  // ── settings ────────────────────────────────────────────────────────────
  app.get('/api/settings', requireAuth, (req, res) => {
    const s = getSettings(db);
    res.json({ ...s, smtp_pass: s.smtp_pass ? '********' : '' });
  });

  app.put('/api/settings', requireAuth, (req, res) => {
    const body = { ...(req.body || {}) };
    if (body.smtp_pass === '********') delete body.smtp_pass;
    setSettings(db, body);
    const s = getSettings(db);
    res.json({ ...s, smtp_pass: s.smtp_pass ? '********' : '' });
  });

  // ── public (client-facing) endpoints — no auth by design ────────────────
  function publicProposal(req, res, cb) {
    const p = findByToken.get(req.params.token);
    if (!p || p.status === 'draft') return res.status(404).json({ error: 'not found' });
    cb(p);
  }

  app.get('/api/public/:token', (req, res) => {
    publicProposal(req, res, (p) => {
      const s = getSettings(db);
      const items = itemsOf(p.id);
      res.json({
        title: p.title,
        client_name: p.client_name,
        status: p.status,
        currency: p.currency,
        valid_until: p.valid_until,
        blocks: blocksOf(p.id).map(({ id, type, content }) => ({ id, type, content })),
        items: items.map(({ id, name, description, qty, price, optional, selected_default }) =>
          ({ id, name, description, qty, price, optional, selected_default })),
        total: computeTotal(items),
        branding: { company_name: s.company_name, logo_url: s.logo_url, accent_color: s.accent_color },
        acceptance: db.prepare('SELECT signer_name, signed_at FROM acceptances WHERE proposal_id = ? ORDER BY signed_at DESC').get(p.id) || null
      });
    });
  });

  // Register a view. Returns a view id; the client heartbeats duration to it.
  app.post('/api/public/:token/view', (req, res) => {
    publicProposal(req, res, (p) => {
      const now = Date.now();
      const ip = (req.ip || '').replace('::ffff:', '');
      const isFirst = db.prepare('SELECT COUNT(*) AS n FROM views WHERE proposal_id = ?').get(p.id).n === 0;
      const info = db.prepare('INSERT INTO views (proposal_id, viewed_at, ip, ua) VALUES (?, ?, ?, ?)')
        .run(p.id, now, ip, String(req.headers['user-agent'] || '').slice(0, 300));
      if (isFirst) {
        notify(`👀 Proposal opened: ${p.title}`,
          `"${p.title}"${p.client_name ? ` (${p.client_name})` : ''} was just opened for the first time.`);
      }
      res.status(201).json({ view_id: info.lastInsertRowid });
    });
  });

  // Heartbeat: body { view_id, duration_s }
  app.post('/api/public/:token/view/heartbeat', (req, res) => {
    publicProposal(req, res, (p) => {
      const { view_id, duration_s } = req.body || {};
      const d = Math.min(Math.max(Number(duration_s) || 0, 0), 6 * 3600);
      db.prepare('UPDATE views SET duration_s = ? WHERE id = ? AND proposal_id = ?').run(d, view_id, p.id);
      res.json({ ok: true });
    });
  });

  // Accept: body { signer_name, selected_optional_ids: [] }
  app.post('/api/public/:token/accept', (req, res) => {
    publicProposal(req, res, (p) => {
      if (p.status === 'accepted') return res.status(409).json({ error: 'already accepted' });
      const signer = String((req.body || {}).signer_name || '').trim();
      if (!signer) return res.status(400).json({ error: 'signer name is required' });
      const selected = Array.isArray((req.body || {}).selected_optional_ids)
        ? (req.body).selected_optional_ids.map(Number)
        : [];
      const items = itemsOf(p.id);
      const total = computeTotal(items, selected);
      const now = Date.now();
      const ip = (req.ip || '').replace('::ffff:', '');
      db.prepare('INSERT INTO acceptances (proposal_id, signer_name, signed_at, ip, selected_items_json, total) VALUES (?, ?, ?, ?, ?, ?)')
        .run(p.id, signer, now, ip, JSON.stringify(selected), total);
      db.prepare("UPDATE proposals SET status = 'accepted', updated_at = ? WHERE id = ?").run(now, p.id);
      notify(`✅ Proposal accepted: ${p.title}`,
        `${signer} accepted "${p.title}" for ${p.currency}${total.toFixed(2)}.`);
      res.status(201).json({ ok: true, signer_name: signer, signed_at: now, total });
    });
  });

  // Request changes: body { author, body }
  app.post('/api/public/:token/comment', (req, res) => {
    publicProposal(req, res, (p) => {
      const body = String((req.body || {}).body || '').trim();
      if (!body) return res.status(400).json({ error: 'comment body is required' });
      const now = Date.now();
      db.prepare('INSERT INTO comments (proposal_id, author, body, created_at) VALUES (?, ?, ?, ?)')
        .run(p.id, String((req.body || {}).author || '').slice(0, 120), body.slice(0, 5000), now);
      if (p.status !== 'accepted') {
        db.prepare("UPDATE proposals SET status = 'changes_requested', updated_at = ? WHERE id = ?").run(now, p.id);
      }
      notify(`💬 Changes requested: ${p.title}`, `Comment on "${p.title}":\n\n${body.slice(0, 1000)}`);
      res.status(201).json({ ok: true });
    });
  });

  // ── static frontend ───────────────────────────────────────────────────────
  const dist = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  return app;
}

module.exports = { createApp };
