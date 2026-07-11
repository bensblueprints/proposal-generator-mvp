async function req(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body != null ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => req('/api/me'),
  login: (password) => req('/api/login', { method: 'POST', body: { password } }),
  logout: () => req('/api/logout', { method: 'POST' }),

  templates: () => req('/api/templates'),
  proposals: () => req('/api/proposals'),
  proposal: (id) => req(`/api/proposals/${id}`),
  createProposal: (body) => req('/api/proposals', { method: 'POST', body }),
  updateProposal: (id, body) => req(`/api/proposals/${id}`, { method: 'PUT', body }),
  deleteProposal: (id) => req(`/api/proposals/${id}`, { method: 'DELETE' }),
  duplicateProposal: (id) => req(`/api/proposals/${id}/duplicate`, { method: 'POST' }),
  sendProposal: (id) => req(`/api/proposals/${id}/send`, { method: 'POST' }),
  revertDraft: (id) => req(`/api/proposals/${id}/revert-draft`, { method: 'POST' }),

  addBlock: (id, type, content) => req(`/api/proposals/${id}/blocks`, { method: 'POST', body: { type, content } }),
  updateBlock: (id, blockId, content) => req(`/api/proposals/${id}/blocks/${blockId}`, { method: 'PUT', body: { content } }),
  deleteBlock: (id, blockId) => req(`/api/proposals/${id}/blocks/${blockId}`, { method: 'DELETE' }),
  reorderBlocks: (id, order) => req(`/api/proposals/${id}/blocks/reorder`, { method: 'POST', body: { order } }),

  addItem: (id, body) => req(`/api/proposals/${id}/items`, { method: 'POST', body }),
  updateItem: (id, itemId, body) => req(`/api/proposals/${id}/items/${itemId}`, { method: 'PUT', body }),
  deleteItem: (id, itemId) => req(`/api/proposals/${id}/items/${itemId}`, { method: 'DELETE' }),

  settings: () => req('/api/settings'),
  saveSettings: (body) => req('/api/settings', { method: 'PUT', body }),

  // public
  publicProposal: (token) => req(`/api/public/${token}`),
  publicView: (token) => req(`/api/public/${token}/view`, { method: 'POST' }),
  publicHeartbeat: (token, view_id, duration_s) =>
    req(`/api/public/${token}/view/heartbeat`, { method: 'POST', body: { view_id, duration_s } }),
  publicAccept: (token, signer_name, selected_optional_ids) =>
    req(`/api/public/${token}/accept`, { method: 'POST', body: { signer_name, selected_optional_ids } }),
  publicComment: (token, author, body) =>
    req(`/api/public/${token}/comment`, { method: 'POST', body: { author, body } })
};

export function timeAgo(ms) {
  if (!ms) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function money(currency, n) {
  return `${currency}${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
