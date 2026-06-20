const env = import.meta.env;

export const API_BASE_URL = env.VITE_API_URL || '';
export const ENVIRONMENT = env.VITE_ENVIRONMENT || 'local';
export const USE_MOCK = !API_BASE_URL || ENVIRONMENT === 'local';

export const ITEM_CATEGORIES = [
  { value: 'MINIATURE', label: 'Miniature Figure' },
  { value: 'TERRAIN', label: 'Terrain / Building' },
  { value: 'BOARDGAME', label: 'Board Game' },
  { value: 'BOOK', label: 'Book / Publication' },
  { value: 'OTHER', label: 'Other' },
];

export const ROLES = { ADMIN: 'ADMIN', USER: 'USER' };

export const PAINT_QUALITY_LABELS = {
  1: 'Level 1 — Tabletop Ready',
  2: 'Level 2 — Solid Wargames Standard',
  3: 'Level 3 — Display Quality',
  4: 'Level 4 — Competition / Gallery',
};
