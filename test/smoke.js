// Pitchcraft smoke test — boots the real server, exercises the full
// template → edit → send → public view → optional add-on → accept pipeline
// over real HTTP against a temp DB, and asserts rows land in SQLite.
// Kills ONLY the spawned server child (never broad-kills node processes).
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '..');
const TEST_PORT = 5391;
const ADMIN_PASSWORD = 'smoke-test-password';
const DB_PATH = path.join(__dirname, 'smoke.db');
const BASE = `http://127.0.0.1:${TEST_PORT}`;

for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

let serverProc = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, label, tries = 40, delay = 250) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* retry */ }
    await sleep(delay);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

let cookie = '';
async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// public calls must NOT carry the admin session cookie
async function pub(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('1. Booting Pitchcraft on port', TEST_PORT, 'with temp DB');
  serverProc = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(TEST_PORT), ADMIN_PASSWORD, DB_PATH },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProc.stdout.on('data', (d) => process.stdout.write(`   [server] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`   [server] ${d}`));

  await waitFor(async () => (await api('/api/health')).data.ok, 'server health');

  console.log('   Auth: wrong password → 401, unauthenticated list → 401, login → 200');
  const bad = await api('/api/login', { method: 'POST', body: { password: 'wrong' } });
  assert.strictEqual(bad.status, 401, 'wrong password must 401');
  cookie = '';
  const unauth = await api('/api/proposals');
  assert.strictEqual(unauth.status, 401, 'admin API must require auth');
  const good = await api('/api/login', { method: 'POST', body: { password: ADMIN_PASSWORD } });
  assert.strictEqual(good.status, 200, 'login must succeed');

  console.log('2. Templates list + create-from-template');
  const tpls = await api('/api/templates');
  assert.ok(Array.isArray(tpls.data) && tpls.data.length >= 5, `>=5 templates (got ${tpls.data.length})`);
  const created = await api('/api/proposals', {
    method: 'POST',
    body: { template_id: 'web-design', client_name: 'Smoke Client LLC' }
  });
  assert.strictEqual(created.status, 201, 'proposal create must 201');
  const p = created.data;
  assert.ok(p.token && p.token.length >= 20, 'proposal has a share token');
  assert.ok(p.blocks.length >= 5, `template seeded blocks (got ${p.blocks.length})`);
  assert.ok(p.items.length === 3, `template seeded 3 line items (got ${p.items.length})`);
  assert.strictEqual(p.status, 'draft', 'new proposal starts as draft');
  // web-design: required 4800 + default-on optional copywriting 5*180=900 = 5700
  assert.strictEqual(p.total, 5700, `template total = 5700 (got ${p.total})`);

  console.log('3. Block editing: add, update, reorder');
  const addB = await api(`/api/proposals/${p.id}/blocks`, {
    method: 'POST', body: { type: 'text', content: { heading: 'Smoke heading', body: 'Smoke body' } }
  });
  assert.strictEqual(addB.status, 201, 'block add must 201');
  const newBlockId = addB.data.id;
  const upd = await api(`/api/proposals/${p.id}/blocks/${newBlockId}`, {
    method: 'PUT', body: { content: { heading: 'Updated heading', body: 'Updated body' } }
  });
  assert.strictEqual(upd.status, 200, 'block update must 200');
  const order = upd.data.blocks.map((b) => b.id).reverse();
  const reordered = await api(`/api/proposals/${p.id}/blocks/reorder`, { method: 'POST', body: { order } });
  assert.deepStrictEqual(reordered.data.blocks.map((b) => b.id), order, 'reorder persists new block order');
  const badBlock = await api(`/api/proposals/${p.id}/blocks`, { method: 'POST', body: { type: 'nonsense' } });
  assert.strictEqual(badBlock.status, 400, 'invalid block type must 400');

  console.log('4. Line items: add optional add-on, totals recompute');
  const addI = await api(`/api/proposals/${p.id}/items`, {
    method: 'POST',
    body: { name: 'Rush delivery', qty: 1, price: 750, optional: true, selected_default: false }
  });
  assert.strictEqual(addI.status, 201, 'item add must 201');
  assert.strictEqual(addI.data.total, 5700, 'off-by-default optional does not change base total');
  const rushItem = addI.data.items.find((i) => i.name === 'Rush delivery');
  const badItem = await api(`/api/proposals/${p.id}/items`, { method: 'POST', body: { name: 'x', qty: -1, price: 5 } });
  assert.strictEqual(badItem.status, 400, 'negative qty must 400');

  console.log('5. Draft is NOT publicly reachable; send activates the link');
  const draftPub = await pub(`/api/public/${p.token}`);
  assert.strictEqual(draftPub.status, 404, 'draft proposal public link must 404');
  const sent = await api(`/api/proposals/${p.id}/send`, { method: 'POST' });
  assert.strictEqual(sent.data.status, 'sent', 'send flips status to sent');
  const pubGet = await pub(`/api/public/${p.token}`);
  assert.strictEqual(pubGet.status, 200, 'public link must 200 after send');
  assert.strictEqual(pubGet.data.title, p.title, 'public payload has title');
  assert.ok(pubGet.data.blocks.length === p.blocks.length + 1, 'public payload has all blocks');
  assert.ok(!JSON.stringify(pubGet.data).includes('"token"'), 'public payload must not leak the token field');

  console.log('6. View tracking: open + duration heartbeat land in SQLite');
  const view = await pub(`/api/public/${p.token}/view`, { method: 'POST' });
  assert.strictEqual(view.status, 201, 'view register must 201');
  const hb = await pub(`/api/public/${p.token}/view/heartbeat`, {
    method: 'POST', body: { view_id: view.data.view_id, duration_s: 42 }
  });
  assert.strictEqual(hb.status, 200, 'heartbeat must 200');

  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH, { readonly: true });
  const viewRow = db.prepare('SELECT * FROM views WHERE proposal_id = ?').get(p.id);
  assert.ok(viewRow, 'view row exists in SQLite');
  assert.strictEqual(viewRow.duration_s, 42, 'heartbeat duration persisted (42s)');

  const detail = await api(`/api/proposals/${p.id}`);
  assert.strictEqual(detail.data.view_count, 1, 'admin sees view_count = 1');
  assert.strictEqual(detail.data.total_seconds, 42, 'admin sees total read seconds');

  console.log('7. Client toggles the optional add-on ON and accepts → signed total includes it');
  // selected: default-on copywriting + rush delivery; total = 4800 + 900 + 750 = 6450
  const defaultOnIds = pubGet.data.items.filter((i) => i.optional && i.selected_default).map((i) => i.id);
  const accept = await pub(`/api/public/${p.token}/accept`, {
    method: 'POST',
    body: { signer_name: 'Casey Signer', selected_optional_ids: [...defaultOnIds, rushItem.id] }
  });
  assert.strictEqual(accept.status, 201, 'accept must 201');
  assert.strictEqual(accept.data.total, 6450, `signed total includes toggled add-on (got ${accept.data.total})`);
  const accRow = db.prepare('SELECT * FROM acceptances WHERE proposal_id = ?').get(p.id);
  assert.ok(accRow, 'acceptance row exists in SQLite');
  assert.strictEqual(accRow.signer_name, 'Casey Signer', 'acceptance records signer name');
  assert.strictEqual(accRow.total, 6450, 'acceptance row stores computed total');
  assert.ok(JSON.parse(accRow.selected_items_json).includes(rushItem.id), 'acceptance stores selected optional ids');
  const afterAccept = db.prepare('SELECT status FROM proposals WHERE id = ?').get(p.id);
  assert.strictEqual(afterAccept.status, 'accepted', 'proposal status becomes accepted');
  const doubleAccept = await pub(`/api/public/${p.token}/accept`, {
    method: 'POST', body: { signer_name: 'Second Signer' }
  });
  assert.strictEqual(doubleAccept.status, 409, 'second accept must 409');

  console.log('8. Request-changes comment flow on a second proposal');
  const p2res = await api('/api/proposals', { method: 'POST', body: { template_id: 'consulting' } });
  const p2 = p2res.data;
  await api(`/api/proposals/${p2.id}/send`, { method: 'POST' });
  const comment = await pub(`/api/public/${p2.token}/comment`, {
    method: 'POST', body: { author: 'Client CFO', body: 'Can we drop Phase 3 and revisit in Q4?' }
  });
  assert.strictEqual(comment.status, 201, 'comment must 201');
  const commentRow = db.prepare('SELECT * FROM comments WHERE proposal_id = ?').get(p2.id);
  assert.ok(commentRow && commentRow.body.includes('Phase 3'), 'comment row exists in SQLite');
  assert.strictEqual(
    db.prepare('SELECT status FROM proposals WHERE id = ?').get(p2.id).status,
    'changes_requested', 'comment flips status to changes_requested'
  );

  console.log('9. Duplicate carries blocks + items; delete cleans up');
  const dup = await api(`/api/proposals/${p2.id}/duplicate`, { method: 'POST' });
  assert.strictEqual(dup.status, 201, 'duplicate must 201');
  assert.ok(dup.data.title.includes('(copy)'), 'duplicate is titled (copy)');
  assert.strictEqual(dup.data.blocks.length, 4, 'duplicate carries blocks');
  assert.strictEqual(dup.data.items.length, 3, 'duplicate carries items');
  assert.notStrictEqual(dup.data.token, p2.token, 'duplicate gets a fresh token');
  await api(`/api/proposals/${dup.data.id}`, { method: 'DELETE' });
  assert.strictEqual(
    db.prepare('SELECT COUNT(*) AS n FROM blocks WHERE proposal_id = ?').get(dup.data.id).n,
    0, 'delete removes child blocks'
  );

  console.log('10. Unknown public token → 404');
  const badTok = await pub('/api/public/definitely-not-a-token');
  assert.strictEqual(badTok.status, 404, 'unknown token must 404');

  db.close();
  console.log('\n✅ All smoke tests passed');
}

async function cleanup(code) {
  // kill ONLY the child we spawned — never broad-kill node/electron
  if (serverProc && !serverProc.killed) serverProc.kill();
  await sleep(300); // let the child release the DB file handles
  for (const f of [DB_PATH, DB_PATH + '-wal', DB_PATH + '-shm']) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* windows file lock — harmless */ }
  }
  process.exit(code);
}

main()
  .then(() => cleanup(0))
  .catch(async (err) => {
    console.error('\n❌ Smoke test failed:', err.message);
    await cleanup(1);
  });
