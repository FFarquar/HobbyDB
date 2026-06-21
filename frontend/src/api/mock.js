import mockData from '../mockdata/seed.json';

// In-memory store, seeded from JSON. Resets on page refresh (intentional for dev).
let store = structuredClone(mockData);

function delay(ms = 120) {
  return new Promise(r => setTimeout(r, ms));
}

function notFound(msg = 'Not found') {
  const err = new Error(msg);
  err.status = 404;
  throw err;
}

export async function mockRequest(method, path, body) {
  await delay();

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  if (path === '/login' && method === 'POST') {
    const user = store.users.find(u => u.loginID === body.loginID && u.password === body.password);
    if (!user || !user.active) throw Object.assign(new Error('Invalid credentials'), { status: 401 });
    const token = btoa(JSON.stringify({ loginID: user.loginID, role: user.role, exp: Date.now() + 3600000 }));
    return { accessToken: token, token, tokenType: 'Bearer', expiresIn: 3600, role: user.role };
  }

  // ─── COLLECTIONS ──────────────────────────────────────────────────────────
  if (path === '/collections') {
    if (method === 'GET') return store.collections;
    if (method === 'POST') {
      const item = { ...body, id: crypto.randomUUID(), ownerId: 'GLOBAL', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      store.collections.push(item);
      return item;
    }
  }
  const collMatch = path.match(/^\/collections\/([^/]+)$/);
  if (collMatch) {
    const id = collMatch[1];
    const idx = store.collections.findIndex(c => c.id === id);
    if (method === 'PUT') {
      if (idx === -1) notFound();
      store.collections[idx] = { ...store.collections[idx], ...body, updatedAt: new Date().toISOString() };
      return store.collections[idx];
    }
    if (method === 'DELETE') { if (idx === -1) notFound(); store.collections.splice(idx, 1); return null; }
  }

  // ─── GROUPS ───────────────────────────────────────────────────────────────
  const groupsMatch = path.match(/^\/collections\/([^/]+)\/groups$/);
  if (groupsMatch) {
    const collectionId = groupsMatch[1];
    if (method === 'GET') return store.groups.filter(g => g.collectionId === collectionId);
    if (method === 'POST') {
      const item = { ...body, id: crypto.randomUUID(), collectionId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      store.groups.push(item);
      return item;
    }
  }
  const groupMatch = path.match(/^\/collections\/([^/]+)\/groups\/([^/]+)$/);
  if (groupMatch) {
    const [, collectionId, id] = groupMatch;
    const idx = store.groups.findIndex(g => g.id === id);
    if (method === 'PUT') {
      if (idx === -1) notFound();
      store.groups[idx] = { ...store.groups[idx], ...body, updatedAt: new Date().toISOString() };
      return store.groups[idx];
    }
    if (method === 'DELETE') { if (idx === -1) notFound(); store.groups.splice(idx, 1); return null; }
  }

  // ─── ITEMS ────────────────────────────────────────────────────────────────
  const itemsMatch = path.match(/^\/groups\/([^/]+)\/items$/);
  if (itemsMatch) {
    const groupId = itemsMatch[1];
    if (method === 'GET') return store.items.filter(i => i.groupId === groupId);
    if (method === 'POST') {
      const item = { ...body, id: crypto.randomUUID(), groupId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      store.items.push(item);
      return item;
    }
  }
  const itemMatch = path.match(/^\/groups\/([^/]+)\/items\/([^/]+)$/);
  if (itemMatch) {
    const [, groupId, id] = itemMatch;
    const idx = store.items.findIndex(i => i.id === id);
    if (method === 'PUT') {
      if (idx === -1) notFound();
      store.items[idx] = { ...store.items[idx], ...body, updatedAt: new Date().toISOString() };
      return store.items[idx];
    }
    if (method === 'DELETE') { if (idx === -1) notFound(); store.items.splice(idx, 1); return null; }
  }

  // ─── LOOKUPS ──────────────────────────────────────────────────────────────
  const lookupsMatch = path.match(/^\/lookups\/([^/]+)$/);
  if (lookupsMatch) {
    const type = lookupsMatch[1].toUpperCase();
    if (method === 'GET') return (store.lookups[type] || []).filter(l => l.active !== false);
    if (method === 'POST') {
      const item = { ...body, id: crypto.randomUUID(), type, active: true };
      store.lookups[type] = store.lookups[type] || [];
      store.lookups[type].push(item);
      return item;
    }
  }
  const lookupMatch = path.match(/^\/lookups\/([^/]+)\/([^/]+)$/);
  if (lookupMatch) {
    const type = lookupMatch[1].toUpperCase(), id = lookupMatch[2];
    const arr = store.lookups[type] || [];
    const idx = arr.findIndex(l => l.id === id);
    if (method === 'PUT') { if (idx === -1) notFound(); arr[idx] = { ...arr[idx], ...body }; return arr[idx]; }
    if (method === 'DELETE') { if (idx === -1) notFound(); arr.splice(idx, 1); return null; }
  }

  // ─── COSTS ────────────────────────────────────────────────────────────────
  if (path === '/costs/paint') {
    if (method === 'GET') return store.paintCosts;
    if (method === 'PUT') {
      const idx = store.paintCosts.findIndex(c => c.scaleId === body.scaleId && c.figureTypeId === body.figureTypeId && c.qualityId === body.qualityId);
      if (idx === -1) store.paintCosts.push(body); else store.paintCosts[idx] = body;
      return body;
    }
  }
  if (path === '/costs/basing') {
    if (method === 'GET') return store.basingCosts;
    if (method === 'PUT') {
      const idx = store.basingCosts.findIndex(c => c.materialId === body.materialId && c.sizeId === body.sizeId);
      if (idx === -1) store.basingCosts.push(body); else store.basingCosts[idx] = body;
      return body;
    }
  }
  if (path === '/costs/exchange') {
    if (method === 'GET') return store.exchangeRates;
    if (method === 'PUT') {
      const code = (body.currencyCode || '').toUpperCase();
      const idx = store.exchangeRates.findIndex(r => r.currencyCode === code);
      const item = { ...body, currencyCode: code, updatedAt: new Date().toISOString() };
      if (idx === -1) store.exchangeRates.push(item); else store.exchangeRates[idx] = item;
      return item;
    }
  }
  const exchangeDeleteMatch = path.match(/^\/costs\/exchange\/([^/]+)$/);
  if (exchangeDeleteMatch && method === 'DELETE') {
    const code = decodeURIComponent(exchangeDeleteMatch[1]).toUpperCase();
    const idx = store.exchangeRates.findIndex(r => r.currencyCode === code);
    if (idx === -1) notFound();
    store.exchangeRates.splice(idx, 1);
    return null;
  }
  if (path === '/costs/figure') {
    if (method === 'GET') return store.figureCosts || [];
    if (method === 'PUT') {
      if (!store.figureCosts) store.figureCosts = [];
      const idx = store.figureCosts.findIndex(c =>
        c.manufacturerId === body.manufacturerId && c.scaleId === body.scaleId && c.figureTypeId === body.figureTypeId
      );
      const item = { ...body, currency: (body.currency || '').toUpperCase(), updatedAt: new Date().toISOString() };
      if (idx === -1) store.figureCosts.push(item); else store.figureCosts[idx] = item;
      return item;
    }
  }
  if (path === '/costs/mfrnotes') {
    if (method === 'GET') return store.manufacturerNotes || [];
    if (method === 'PUT') {
      if (!store.manufacturerNotes) store.manufacturerNotes = [];
      const idx = store.manufacturerNotes.findIndex(n => n.manufacturerId === body.manufacturerId);
      const item = { ...body, updatedAt: new Date().toISOString() };
      if (idx === -1) store.manufacturerNotes.push(item); else store.manufacturerNotes[idx] = item;
      return item;
    }
  }
  if (path.startsWith('/costs/figure') && method === 'DELETE') {
    if (!store.figureCosts) store.figureCosts = [];
    const params = new URLSearchParams(path.split('?')[1] || '');
    const manufacturerId = params.get('manufacturerId');
    const scaleId = params.get('scaleId');
    const figureTypeId = params.get('figureTypeId');
    const idx = store.figureCosts.findIndex(c =>
      c.manufacturerId === manufacturerId && c.scaleId === scaleId && c.figureTypeId === figureTypeId
    );
    if (idx === -1) notFound();
    store.figureCosts.splice(idx, 1);
    return null;
  }

  // ─── IMAGES ───────────────────────────────────────────────────────────────
  if (path.startsWith('/images')) {
    const qs = new URLSearchParams(path.split('?')[1] || '');
    if (!store.images) store.images = {};

    if (method === 'GET') {
      const entityId = qs.get('entityId');
      return (store.images[entityId] || []);
    }
    if (method === 'POST' && path.includes('/register')) {
      const { entityId, key, filename, contentType, url } = body;
      if (!store.images[entityId]) store.images[entityId] = [];
      const item = { key, filename, contentType, url, uploadedAt: new Date().toISOString() };
      store.images[entityId].push(item);
      return item;
    }
    if (method === 'DELETE') {
      const key      = qs.get('key');
      const entityId = qs.get('entityId');
      if (entityId && store.images[entityId]) {
        store.images[entityId] = store.images[entityId].filter(i => i.key !== key);
      }
      return null;
    }
  }

  // ─── REPORTS ──────────────────────────────────────────────────────────────
  const reportMatch = path.match(/^\/reports\/(.+)$/);
  if (reportMatch) {
    return { reportType: reportMatch[1], note: 'Mock report — seed more data to see results', rows: [] };
  }

  // ─── USERS ────────────────────────────────────────────────────────────────
  if (path === '/users') {
    if (method === 'GET') return store.users.map(u => ({ ...u, password: undefined }));
    if (method === 'POST') {
      const item = { ...body, id: crypto.randomUUID(), active: true };
      store.users.push(item);
      return { ...item, password: undefined };
    }
  }

  throw Object.assign(new Error(`Mock: no handler for ${method} ${path}`), { status: 404 });
}
