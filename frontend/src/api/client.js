import { API_BASE_URL, USE_MOCK, ENVIRONMENT } from '../config.js';

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

// Must match the namespaced key in App.jsx.
function getToken() {
  return localStorage.getItem(`authToken:${ENVIRONMENT}`) || '';
}

async function request(method, path, body, attempt = 0) {
  if (USE_MOCK) {
    const { mockRequest } = await import('./mock.js');
    return mockRequest(method, path, body);
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 503 && attempt < 3) {
    await new Promise(r => setTimeout(r, 300 * 2 ** attempt));
    return request(method, path, body, attempt + 1);
  }

  if (res.status === 204) return null;
  if (res.status === 401 || res.status === 403) {
    onUnauthorized?.();
    throw Object.assign(new Error('Session expired. Please log in again.'), { status: res.status });
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(err.message || 'Request failed'), { status: res.status });
  }

  return res.json();
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};

// Auth
export const login = (loginID, password) => api.post('/login', { loginID, password });

// Collections
export const getCollections = () => api.get('/collections');
export const createCollection = (data) => api.post('/collections', data);
export const updateCollection = (id, data) => api.put(`/collections/${id}`, data);
export const deleteCollection = (id) => api.delete(`/collections/${id}`);

// Groups
export const getGroups = (collectionId) => api.get(`/collections/${collectionId}/groups`);
export const createGroup = (collectionId, data) => api.post(`/collections/${collectionId}/groups`, data);
export const updateGroup = (collectionId, id, data) => api.put(`/collections/${collectionId}/groups/${id}`, data);
export const deleteGroup = (collectionId, id) => api.delete(`/collections/${collectionId}/groups/${id}`);

// Items
export const getItems = (groupId) => api.get(`/groups/${groupId}/items`);
export const createItem = (groupId, data) => api.post(`/groups/${groupId}/items`, data);
export const updateItem = (groupId, id, data) => api.put(`/groups/${groupId}/items/${id}`, data);
export const deleteItem = (groupId, id) => api.delete(`/groups/${groupId}/items/${id}`);

// Lookups
export const getLookups = (type) => api.get(`/lookups/${type}`);
export const createLookup = (type, data) => api.post(`/lookups/${type}`, data);
export const updateLookup = (type, id, data) => api.put(`/lookups/${type}/${id}`, data);
export const deleteLookup = (type, id) => api.delete(`/lookups/${type}/${id}`);

// Costs
export const getPaintCosts = () => api.get('/costs/paint');
export const upsertPaintCost = (data) => api.put('/costs/paint', data);
export const getBasingCosts = () => api.get('/costs/basing');
export const upsertBasingCost = (data) => api.put('/costs/basing', data);
export const getExchangeRates = () => api.get('/costs/exchange');
export const upsertExchangeRate = (data) => api.put('/costs/exchange', data);
export const deleteExchangeRate = (code) => api.delete(`/costs/exchange/${encodeURIComponent(code)}`);
export const getFigureCosts = () => api.get('/costs/figure');
export const upsertFigureCost = (data) => api.put('/costs/figure', data);
export const deleteFigureCost = (manufacturerId, scaleId, figureTypeId, materialId) => {
  const params = new URLSearchParams({ manufacturerId, scaleId, figureTypeId });
  if (materialId) params.append('materialId', materialId);
  return api.delete(`/costs/figure?${params}`);
};
export const getManufacturerNotes = () => api.get('/costs/mfrnotes');
export const upsertManufacturerNote = (data) => api.put('/costs/mfrnotes', data);
export const getPaintRateNotes = () => api.get('/costs/paintratenotes');
export const upsertPaintRateNote = (data) => api.put('/costs/paintratenotes', data);
export const getScaleFigureTypes = () => api.get('/costs/scalefiguretype');
export const addScaleFigureType = (data) => api.put('/costs/scalefiguretype', data);
export const removeScaleFigureType = (scaleId, figureTypeId) =>
  api.delete(`/costs/scalefiguretype?scaleId=${encodeURIComponent(scaleId)}&figureTypeId=${encodeURIComponent(figureTypeId)}`);

// Reports
export const getReport = (type) => api.get(`/reports/${type}`);

// Users (admin)
export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);

// Images
export const getImages     = (entityId) => api.get(`/images?entityId=${encodeURIComponent(entityId)}`);
export const registerImage = (data) => api.post('/images/register', data);
export const deleteImage   = (key, entityId) =>
  api.delete(`/images?key=${encodeURIComponent(key)}&entityId=${encodeURIComponent(entityId)}`);

const MAX_IMAGE_PX = 1920;
const IMAGE_QUALITY = 0.82;
const COMPRESS_THRESHOLD = 200 * 1024; // skip files already under 200 KB

async function compressImage(file) {
  if (file.size <= COMPRESS_THRESHOLD) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const longest = Math.max(width, height);
      if (longest > MAX_IMAGE_PX) {
        const scale = MAX_IMAGE_PX / longest;
        width  = Math.round(width  * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          const name = file.name.replace(/\.[^.]+$/, '.webp');
          resolve(new File([blob], name, { type: 'image/webp' }));
        },
        'image/webp',
        IMAGE_QUALITY,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// Handles presigned-URL upload then registers metadata. In mock mode uses a data URL instead.
export async function uploadImage(file, entityId) {
  const compressed = await compressImage(file);
  if (USE_MOCK) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });
    const key = `mock/${Date.now()}-${compressed.name}`;
    await registerImage({ entityId, key, filename: compressed.name, contentType: compressed.type, url: dataUrl });
    return key;
  }
  const { uploadUrl, key } = await api.post('/images/upload-url', { filename: compressed.name, contentType: compressed.type, entityId });
  await fetch(uploadUrl, { method: 'PUT', body: compressed, headers: { 'Content-Type': compressed.type } });
  await registerImage({ entityId, key, filename: compressed.name, contentType: compressed.type });
  return key;
}
