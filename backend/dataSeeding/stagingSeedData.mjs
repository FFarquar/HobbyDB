import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "hobbydb-stage";
const ts = new Date().toISOString();

// ─── COLLECTIONS ──────────────────────────────────────────────────────────────

const collections = [
  {
    PK: "COLLECTION#col-miniature-01", SK: "METADATA",
    GSI1PK: "COLLECTION", GSI1SK: "COLLECTION#col-miniature-01",
    id: "col-miniature-01", name: "Miniature Armies", category: "MINIATURE",
    description: "Scale miniature military figures", ownerId: "GLOBAL",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    PK: "COLLECTION#col-boardgame-01", SK: "METADATA",
    GSI1PK: "COLLECTION", GSI1SK: "COLLECTION#col-boardgame-01",
    id: "col-boardgame-01", name: "Board Games", category: "BOARDGAME",
    description: "My board game collection", ownerId: "GLOBAL",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    PK: "COLLECTION#col-book-01", SK: "METADATA",
    GSI1PK: "COLLECTION", GSI1SK: "COLLECTION#col-book-01",
    id: "col-book-01", name: "Books & Publications", category: "BOOK",
    description: "Wargaming and history books", ownerId: "GLOBAL",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
];

// ─── GROUPS ───────────────────────────────────────────────────────────────────

const groups = [
  {
    PK: "COLLECTION#col-miniature-01", SK: "GROUP#grp-romans-01",
    GSI1PK: "GROUP#grp-romans-01", GSI1SK: "METADATA",
    id: "grp-romans-01", collectionId: "col-miniature-01",
    name: "Republican Romans", description: "15mm Republican Roman army",
    notes: "DBM Army list II/33",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    PK: "COLLECTION#col-miniature-01", SK: "GROUP#grp-napoleon-01",
    GSI1PK: "GROUP#grp-napoleon-01", GSI1SK: "METADATA",
    id: "grp-napoleon-01", collectionId: "col-miniature-01",
    name: "Napoleonic French", description: "6mm Napoleonic French Corps",
    notes: "For use with Grande Armée rules",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    PK: "COLLECTION#col-boardgame-01", SK: "GROUP#grp-twilight-01",
    GSI1PK: "GROUP#grp-twilight-01", GSI1SK: "METADATA",
    id: "grp-twilight-01", collectionId: "col-boardgame-01",
    name: "Twilight Imperium", description: "4th Edition + Prophecy of Kings",
    notes: "",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
];

// ─── ITEMS ────────────────────────────────────────────────────────────────────

const items = [
  {
    PK: "GROUP#grp-romans-01", SK: "ITEM#item-001",
    GSI1PK: "ITEM#item-001", GSI1SK: "METADATA",
    id: "item-001", groupId: "grp-romans-01", collectionId: "col-miniature-01",
    category: "MINIATURE", name: "Hastati / Principes",
    quantity: 120, notes: "AB Miniatures, based on 40x20mm", imageKeys: [],
    scaleId: "scale-15mm", scaleName: "15mm",
    manufacturerId: "mfr-ab", manufacturerName: "AB Miniatures",
    figureTypeId: "ft-infantry", figureTypeName: "Infantry",
    nationalityId: "nat-roman", periodId: "per-ancient", rulesId: "rules-dbm",
    paintQualityId: "3", paintQualityName: "Level 3 — Display Quality",
    baseSizeId: "base-40x20", baseMaterialId: "mat-metal",
    numberBases: 30, purchasePriceAmt: 1.1, purchasePriceCurrency: "AUD",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    PK: "GROUP#grp-romans-01", SK: "ITEM#item-002",
    GSI1PK: "ITEM#item-002", GSI1SK: "METADATA",
    id: "item-002", groupId: "grp-romans-01", collectionId: "col-miniature-01",
    category: "MINIATURE", name: "Equites (Roman Cavalry)",
    quantity: 24, notes: "Essex Miniatures", imageKeys: [],
    scaleId: "scale-15mm", scaleName: "15mm",
    manufacturerId: "mfr-essex", manufacturerName: "Essex Miniatures",
    figureTypeId: "ft-cavalry", figureTypeName: "Cavalry",
    nationalityId: "nat-roman", periodId: "per-ancient", rulesId: "rules-dbm",
    paintQualityId: "2", paintQualityName: "Level 2 — Solid Wargames Standard",
    baseSizeId: "base-40x30", baseMaterialId: "mat-metal",
    numberBases: 8, purchasePriceAmt: 1.5, purchasePriceCurrency: "GBP",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    PK: "GROUP#grp-napoleon-01", SK: "ITEM#item-003",
    GSI1PK: "ITEM#item-003", GSI1SK: "METADATA",
    id: "item-003", groupId: "grp-napoleon-01", collectionId: "col-miniature-01",
    category: "MINIATURE", name: "Line Infantry",
    quantity: 200, notes: "Baccus 6mm", imageKeys: [],
    scaleId: "scale-6mm", scaleName: "6mm",
    manufacturerId: "mfr-baccus", manufacturerName: "Baccus",
    figureTypeId: "ft-infantry", figureTypeName: "Infantry",
    nationalityId: "nat-french", periodId: "per-napoleonic", rulesId: "rules-grandarmee",
    paintQualityId: "2", paintQualityName: "Level 2 — Solid Wargames Standard",
    baseSizeId: "base-60x30", baseMaterialId: "mat-mdf",
    numberBases: 25, purchasePriceAmt: 0.3, purchasePriceCurrency: "GBP",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    PK: "GROUP#grp-twilight-01", SK: "ITEM#item-004",
    GSI1PK: "ITEM#item-004", GSI1SK: "METADATA",
    id: "item-004", groupId: "grp-twilight-01", collectionId: "col-boardgame-01",
    category: "BOARDGAME", name: "Twilight Imperium 4th Edition",
    quantity: 1, notes: "Includes Prophecy of Kings expansion", imageKeys: [],
    publisher: "Fantasy Flight Games", minPlayers: 3, maxPlayers: 8,
    playTimeMinutes: 480, bggId: "233078",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  },
];

// ─── LOOKUPS ──────────────────────────────────────────────────────────────────

const lookups = [
  { id: "scale-6mm",   type: "SCALE", label: "6mm",   abbreviation: "6mm",   sortOrder: 1 },
  { id: "scale-10mm",  type: "SCALE", label: "10mm",  abbreviation: "10mm",  sortOrder: 2 },
  { id: "scale-15mm",  type: "SCALE", label: "15mm",  abbreviation: "15mm",  sortOrder: 3 },
  { id: "scale-25mm",  type: "SCALE", label: "25mm",  abbreviation: "25mm",  sortOrder: 4 },
  { id: "scale-28mm",  type: "SCALE", label: "28mm",  abbreviation: "28mm",  sortOrder: 5 },

  { id: "mfr-ab",       type: "MANUFACTURER", label: "AB Miniatures",    abbreviation: "AB",       sortOrder: 1 },
  { id: "mfr-essex",    type: "MANUFACTURER", label: "Essex Miniatures",  abbreviation: "Essex",    sortOrder: 2 },
  { id: "mfr-baccus",   type: "MANUFACTURER", label: "Baccus",            abbreviation: "Baccus",   sortOrder: 3 },
  { id: "mfr-xyston",   type: "MANUFACTURER", label: "Xyston",            abbreviation: "Xyston",   sortOrder: 4 },
  { id: "mfr-pendraken",type: "MANUFACTURER", label: "Pendraken",         abbreviation: "Pendraken",sortOrder: 5 },

  { id: "ft-infantry", type: "FIGURETYPE", label: "Infantry",  abbreviation: "Inf",   sortOrder: 1 },
  { id: "ft-cavalry",  type: "FIGURETYPE", label: "Cavalry",   abbreviation: "Cav",   sortOrder: 2 },
  { id: "ft-gun",      type: "FIGURETYPE", label: "Artillery", abbreviation: "Gun",   sortOrder: 3 },
  { id: "ft-tank",     type: "FIGURETYPE", label: "Tank",      abbreviation: "Tank",  sortOrder: 4 },
  { id: "ft-chariot",  type: "FIGURETYPE", label: "Chariot",   abbreviation: "Chrt",  sortOrder: 5 },
  { id: "ft-elephant", type: "FIGURETYPE", label: "Elephant",  abbreviation: "Eleph", sortOrder: 6 },

  { id: "nat-roman",   type: "NATIONALITY", label: "Roman",   abbreviation: "ROM", sortOrder: 1 },
  { id: "nat-greek",   type: "NATIONALITY", label: "Greek",   abbreviation: "GRK", sortOrder: 2 },
  { id: "nat-french",  type: "NATIONALITY", label: "French",  abbreviation: "FRN", sortOrder: 3 },
  { id: "nat-british", type: "NATIONALITY", label: "British", abbreviation: "BRT", sortOrder: 4 },
  { id: "nat-german",  type: "NATIONALITY", label: "German",  abbreviation: "GER", sortOrder: 5 },

  { id: "per-ancient",    type: "PERIOD", label: "Ancient",           abbreviation: "Anc", sortOrder: 1 },
  { id: "per-medieval",   type: "PERIOD", label: "Medieval",          abbreviation: "Med", sortOrder: 2 },
  { id: "per-napoleonic", type: "PERIOD", label: "Napoleonic",        abbreviation: "Nap", sortOrder: 3 },
  { id: "per-acw",        type: "PERIOD", label: "American Civil War", abbreviation: "ACW", sortOrder: 4 },
  { id: "per-ww2",        type: "PERIOD", label: "World War II",      abbreviation: "WW2", sortOrder: 5 },

  { id: "rules-dbm",        type: "RULES", label: "DBM",             abbreviation: "DBM", sortOrder: 1 },
  { id: "rules-fog",        type: "RULES", label: "Field of Glory",  abbreviation: "FoG", sortOrder: 2 },
  { id: "rules-grandarmee", type: "RULES", label: "Grande Armée",    abbreviation: "GA",  sortOrder: 3 },
  { id: "rules-coc",        type: "RULES", label: "Chain of Command", abbreviation: "CoC", sortOrder: 4 },

  { id: "base-40x20",  type: "BASESIZE", label: "40×20mm",   abbreviation: "40×20",  sortOrder: 1 },
  { id: "base-40x30",  type: "BASESIZE", label: "40×30mm",   abbreviation: "40×30",  sortOrder: 2 },
  { id: "base-60x30",  type: "BASESIZE", label: "60×30mm",   abbreviation: "60×30",  sortOrder: 3 },
  { id: "base-60x60",  type: "BASESIZE", label: "60×60mm",   abbreviation: "60×60",  sortOrder: 4 },
  { id: "base-25mm-rd",type: "BASESIZE", label: "25mm Round", abbreviation: "25rnd", sortOrder: 5 },

  { id: "mat-metal",   type: "BASEMATERIAL", label: "Metal",   abbreviation: "Metal",   sortOrder: 1 },
  { id: "mat-mdf",     type: "BASEMATERIAL", label: "MDF",     abbreviation: "MDF",     sortOrder: 2 },
  { id: "mat-plastic", type: "BASEMATERIAL", label: "Plastic", abbreviation: "Plastic", sortOrder: 3 },
  { id: "mat-wood",    type: "BASEMATERIAL", label: "Wood",    abbreviation: "Wood",    sortOrder: 4 },

  { id: "1", type: "PAINTQUALITY", label: "Level 1 — Tabletop Ready",          abbreviation: "L1", sortOrder: 1 },
  { id: "2", type: "PAINTQUALITY", label: "Level 2 — Solid Wargames Standard", abbreviation: "L2", sortOrder: 2 },
  { id: "3", type: "PAINTQUALITY", label: "Level 3 — Display Quality",         abbreviation: "L3", sortOrder: 3 },
  { id: "4", type: "PAINTQUALITY", label: "Level 4 — Competition / Gallery",   abbreviation: "L4", sortOrder: 4 },
].map(l => ({
  PK: `LOOKUP#${l.type}`,
  SK: `VALUE#${l.id}`,
  active: true,
  createdAt: ts,
  updatedAt: ts,
  ...l,
}));

// ─── PAINT COSTS ──────────────────────────────────────────────────────────────

const paintCosts = [
  { scaleId: "scale-6mm",  figureTypeId: "ft-infantry", qualityId: "1", costUSD: 0.5 },
  { scaleId: "scale-6mm",  figureTypeId: "ft-infantry", qualityId: "2", costUSD: 1.0 },
  { scaleId: "scale-6mm",  figureTypeId: "ft-infantry", qualityId: "3", costUSD: 1.5 },
  { scaleId: "scale-6mm",  figureTypeId: "ft-infantry", qualityId: "4", costUSD: 3.0 },
  { scaleId: "scale-15mm", figureTypeId: "ft-infantry", qualityId: "1", costUSD: 1.5 },
  { scaleId: "scale-15mm", figureTypeId: "ft-infantry", qualityId: "2", costUSD: 2.5 },
  { scaleId: "scale-15mm", figureTypeId: "ft-infantry", qualityId: "3", costUSD: 4.0 },
  { scaleId: "scale-15mm", figureTypeId: "ft-infantry", qualityId: "4", costUSD: 8.0 },
  { scaleId: "scale-15mm", figureTypeId: "ft-cavalry",  qualityId: "1", costUSD: 2.5 },
  { scaleId: "scale-15mm", figureTypeId: "ft-cavalry",  qualityId: "2", costUSD: 4.0 },
  { scaleId: "scale-15mm", figureTypeId: "ft-cavalry",  qualityId: "3", costUSD: 6.0 },
  { scaleId: "scale-15mm", figureTypeId: "ft-cavalry",  qualityId: "4", costUSD: 12.0 },
].map(p => ({
  PK: `PAINTCOST#${p.scaleId}#${p.figureTypeId}`,
  SK: `QUALITY#${p.qualityId}`,
  updatedAt: ts,
  ...p,
}));

// ─── BASING COSTS ─────────────────────────────────────────────────────────────

const basingCosts = [
  { materialId: "mat-metal", sizeId: "base-40x20", costUSD: 0.25 },
  { materialId: "mat-metal", sizeId: "base-40x30", costUSD: 0.35 },
  { materialId: "mat-metal", sizeId: "base-60x30", costUSD: 0.40 },
  { materialId: "mat-mdf",   sizeId: "base-40x20", costUSD: 0.10 },
  { materialId: "mat-mdf",   sizeId: "base-40x30", costUSD: 0.12 },
  { materialId: "mat-mdf",   sizeId: "base-60x30", costUSD: 0.15 },
].map(b => ({
  PK: `BASECOST#${b.materialId}`,
  SK: `SIZE#${b.sizeId}`,
  updatedAt: ts,
  ...b,
}));

// ─── EXCHANGE RATES ───────────────────────────────────────────────────────────

const exchangeRates = [
  { currencyCode: "USD", name: "US Dollar",          rateToAUD: 1.55 },
  { currencyCode: "GBP", name: "British Pound",       rateToAUD: 2.05 },
  { currencyCode: "EUR", name: "Euro",                rateToAUD: 1.70 },
  { currencyCode: "NZD", name: "New Zealand Dollar",  rateToAUD: 0.92 },
].map(r => ({
  PK: "EXCHANGERATE",
  SK: `CURRENCY#${r.currencyCode}`,
  updatedAt: ts,
  ...r,
}));

// ─── INSERT ALL ───────────────────────────────────────────────────────────────

const allItems = [...collections, ...groups, ...items, ...lookups, ...paintCosts, ...basingCosts, ...exchangeRates];

for (const item of allItems) {
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  console.log("Inserted:", item.PK, item.SK);
}

console.log(`\nDone — ${allItems.length} items written to ${TABLE_NAME}`);
