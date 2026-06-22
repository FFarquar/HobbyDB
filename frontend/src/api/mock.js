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
  if (path === '/costs/scalefiguretype') {
    if (!store.scaleFigureTypes) store.scaleFigureTypes = [];
    if (method === 'GET') return store.scaleFigureTypes;
    if (method === 'PUT') {
      const exists = store.scaleFigureTypes.some(l => l.scaleId === body.scaleId && l.figureTypeId === body.figureTypeId);
      if (!exists) store.scaleFigureTypes.push({ ...body, createdAt: new Date().toISOString() });
      return { ...body, createdAt: new Date().toISOString() };
    }
  }
  if (path.startsWith('/costs/scalefiguretype') && method === 'DELETE') {
    if (!store.scaleFigureTypes) store.scaleFigureTypes = [];
    const params = new URLSearchParams(path.split('?')[1] || '');
    const scaleId = params.get('scaleId');
    const figureTypeId = params.get('figureTypeId');
    const idx = store.scaleFigureTypes.findIndex(l => l.scaleId === scaleId && l.figureTypeId === figureTypeId);
    if (idx !== -1) store.scaleFigureTypes.splice(idx, 1);
    return null;
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
    const reportType = reportMatch[1];

    if (reportType === 'figures-by-scale' || reportType === 'figures-by-period') {
      const miniatures = store.items.filter(i => i.category === 'MINIATURE');
      const groupKey = reportType === 'figures-by-scale' ? 'scaleName' : 'periodName';
      const rowKey = reportType === 'figures-by-scale' ? 'scale' : 'period';
      const grouped = {};
      for (const item of miniatures) {
        const key = item[groupKey] || item[groupKey.replace('Name', 'Id')] || 'Unknown';
        const totalFigs = (item.numberBases || 0) * (item.quantity || 1);
        grouped[key] = (grouped[key] || 0) + totalFigs;
      }
      const rows = Object.entries(grouped)
        .map(([k, count]) => ({ [rowKey]: k, count }))
        .sort((a, b) => b.count - a.count);
      const totalFigures = miniatures.reduce((s, i) => s + (i.numberBases || 0) * (i.quantity || 1), 0);
      return { reportType, rows, totalFigures };
    }

    if (reportType === 'inventory-summary') {
      const summary = {};
      let totalItems = 0, totalQuantity = 0;
      for (const item of store.items) {
        const cat = item.category || 'OTHER';
        if (!summary[cat]) summary[cat] = { category: cat, itemCount: 0, totalQuantity: 0 };
        summary[cat].itemCount++;
        const qty = cat === 'MINIATURE'
          ? (item.numberBases || 0) * (item.quantity || 1)
          : (item.quantity || 1);
        summary[cat].totalQuantity += qty;
        totalItems++;
        totalQuantity += qty;
      }
      return { reportType, categories: Object.values(summary), totalItems, totalQuantity };
    }

    if (reportType === 'value-by-army') {
      const rateMap = { AUD: 1.0 };
      for (const er of (store.exchangeRates || [])) rateMap[er.currencyCode] = er.rateToAUD;
      const figureMap = {};
      for (const fc of (store.figureCosts || [])) {
        figureMap[`${fc.manufacturerId}|${fc.scaleId}|${fc.figureTypeId}`] = fc;
      }
      const paintMap = {};
      for (const pc of (store.paintCosts || [])) {
        paintMap[`${pc.scaleId}|${pc.figureTypeId}|${pc.qualityId}`] = pc;
      }
      const basingMap = {};
      for (const bc of (store.basingCosts || [])) {
        basingMap[`${bc.materialId}|${bc.sizeId}`] = bc.costAUD;
      }
      const collectionMap = {};
      for (const c of (store.collections || [])) collectionMap[c.id] = c;

      const armies = [];
      for (const group of (store.groups || [])) {
        const collection = collectionMap[group.collectionId];
        if (!collection || collection.category !== 'MINIATURE') continue;
        const miniatures = store.items.filter(i => i.groupId === group.id && i.category === 'MINIATURE');
        let totalFigureCostAUD = 0, totalPaintCostAUD = 0, totalBasingCostAUD = 0;
        const items = miniatures.map(item => {
          const qty = item.quantity || 1;
          const nb = item.numberBases || 0;
          const totalFigs = qty * nb;
          const fc = figureMap[`${item.manufacturerId}|${item.scaleId}|${item.figureTypeId}`];
          const figureCostAUD = fc ? fc.cost * (rateMap[fc.currency] || 1) * totalFigs : 0;
          const pc = paintMap[`${item.scaleId}|${item.figureTypeId}|${item.paintQualityId}`];
          const paintCostAUD = pc ? pc.costUSD * (rateMap['USD'] || 1) * totalFigs : 0;
          const basingCostAUD = (item.baseMaterialId && item.baseSizeId)
            ? (basingMap[`${item.baseMaterialId}|${item.baseSizeId}`] || 0) * nb : 0;
          totalFigureCostAUD += figureCostAUD;
          totalPaintCostAUD += paintCostAUD;
          totalBasingCostAUD += basingCostAUD;
          return {
            name: item.name, quantity: qty, numberBases: nb,
            scaleName: item.scaleName || '', figureTypeName: item.figureTypeName || '',
            manufacturerName: item.manufacturerName || '',
            figureCostAUD, paintCostAUD, basingCostAUD,
            totalAUD: figureCostAUD + paintCostAUD + basingCostAUD,
          };
        });
        armies.push({
          groupId: group.id, groupName: group.name, collectionName: collection.name,
          totalFigureCostAUD, totalPaintCostAUD, totalBasingCostAUD,
          totalAUD: totalFigureCostAUD + totalPaintCostAUD + totalBasingCostAUD,
          items,
        });
      }
      armies.sort((a, b) => b.totalAUD - a.totalAUD);
      return { reportType, armies };
    }

    if (reportType === 'collection-value') {
      const rateMap = { AUD: 1.0 };
      for (const er of (store.exchangeRates || [])) rateMap[er.currencyCode] = er.rateToAUD;
      const figureMap = {};
      for (const fc of (store.figureCosts || [])) {
        figureMap[`${fc.manufacturerId}|${fc.scaleId}|${fc.figureTypeId}`] = fc;
      }
      const paintMap = {};
      for (const pc of (store.paintCosts || [])) {
        paintMap[`${pc.scaleId}|${pc.figureTypeId}|${pc.qualityId}`] = pc;
      }
      const basingMap = {};
      for (const bc of (store.basingCosts || [])) {
        basingMap[`${bc.materialId}|${bc.sizeId}`] = bc.costAUD;
      }
      const collections = {};
      for (const item of store.items) {
        const colId = item.collectionId || 'unknown';
        if (!collections[colId]) collections[colId] = { collectionId: colId, items: 0, totalValueAUD: 0 };
        collections[colId].items++;
        if (item.category === 'MINIATURE') {
          const qty = item.quantity || 1;
          const nb = item.numberBases || 0;
          const totalFigs = qty * nb;
          const fc = figureMap[`${item.manufacturerId}|${item.scaleId}|${item.figureTypeId}`];
          if (fc) collections[colId].totalValueAUD += fc.cost * (rateMap[fc.currency] || 1) * totalFigs;
          const pc = paintMap[`${item.scaleId}|${item.figureTypeId}|${item.paintQualityId}`];
          if (pc) collections[colId].totalValueAUD += pc.costUSD * (rateMap['USD'] || 1) * totalFigs;
          if (item.baseMaterialId && item.baseSizeId) {
            const basingRate = basingMap[`${item.baseMaterialId}|${item.baseSizeId}`] || 0;
            collections[colId].totalValueAUD += basingRate * nb;
          }
        }
      }
      return { reportType, collections: Object.values(collections) };
    }

    return { reportType, rows: [], totalFigures: 0 };
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
