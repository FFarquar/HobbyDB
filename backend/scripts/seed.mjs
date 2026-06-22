/**
 * Seed script — populates DynamoDB with initial data.
 *
 * Usage:
 *   node scripts/seed.mjs --env stage
 *   node scripts/seed.mjs --env prod
 *
 * Prerequisites:
 *   - AWS credentials configured locally (same profile used for deployment)
 *   - npm install run in the backend folder
 *   - The CloudFormation stack must already be deployed
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const envArg = args[args.indexOf('--env') + 1];

if (!envArg || !['stage', 'prod'].includes(envArg)) {
  console.error('Usage: node scripts/seed.mjs --env stage|prod');
  process.exit(1);
}

const TABLE_NAME = `hobbydb-${envArg}`;
const REGION = 'ap-southeast-2';

const client = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(client);

console.log(`\n🌱 Seeding table: ${TABLE_NAME} (${REGION})\n`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const now = () => new Date().toISOString();

async function put(item) {
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

async function batchPut(items) {
  // DynamoDB batch write limit is 25 items
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25).map(Item => ({ PutRequest: { Item } }));
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: chunk } }));
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

async function seedUsers() {
  console.log('👤 Seeding users...');

  const users = [
    { loginID: 'admin',   password: 'Admin1234!',  role: 'ADMIN', displayName: 'Administrator' },
    { loginID: 'FFarquar', password: 'Change1234!', role: 'ADMIN', displayName: 'F Farquar' },
    { loginID: 'viewer',  password: 'View1234!',   role: 'USER',  displayName: 'View Only' },
    { loginID: 'Dean_P',  password: 'Password123', role: 'USER',  displayName: 'Dean P' },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await put({
      PK: `USER#${u.loginID}`,
      SK: 'PROFILE',
      GSI1PK: 'USER',
      GSI1SK: `USER#${u.loginID}`,
      loginID: u.loginID,
      passwordHash,
      role: u.role,
      displayName: u.displayName,
      active: true,
      createdAt: now(),
      updatedAt: now(),
    });
    console.log(`   ✓ ${u.loginID} (${u.role}) — password: ${u.password}`);
  }
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

async function seedLookups() {
  console.log('\n🔖 Seeding lookup tables...');

  const lookups = [
    // Scales
    { type: 'SCALE', id: 'scale-6mm',  label: '6mm',  abbreviation: '6mm',  sortOrder: 1 },
    { type: 'SCALE', id: 'scale-10mm', label: '10mm', abbreviation: '10mm', sortOrder: 2 },
    { type: 'SCALE', id: 'scale-15mm', label: '15mm', abbreviation: '15mm', sortOrder: 3 },
    { type: 'SCALE', id: 'scale-25mm', label: '25mm', abbreviation: '25mm', sortOrder: 4 },
    { type: 'SCALE', id: 'scale-28mm', label: '28mm', abbreviation: '28mm', sortOrder: 5 },

    // Manufacturers
    { type: 'MANUFACTURER', id: 'mfr-ab',       label: 'AB Miniatures',   abbreviation: 'AB',       sortOrder: 1 },
    { type: 'MANUFACTURER', id: 'mfr-essex',    label: 'Essex Miniatures', abbreviation: 'Essex',   sortOrder: 2 },
    { type: 'MANUFACTURER', id: 'mfr-baccus',   label: 'Baccus',          abbreviation: 'Baccus',   sortOrder: 3 },
    { type: 'MANUFACTURER', id: 'mfr-xyston',   label: 'Xyston',          abbreviation: 'Xyston',   sortOrder: 4 },
    { type: 'MANUFACTURER', id: 'mfr-pendraken', label: 'Pendraken',      abbreviation: 'Pendraken',sortOrder: 5 },
    { type: 'MANUFACTURER', id: 'mfr-museum',   label: 'Museum Miniatures',abbreviation: 'Museum',  sortOrder: 6 },
    { type: 'MANUFACTURER', id: 'mfr-old-glory', label: 'Old Glory',      abbreviation: 'OG',       sortOrder: 7 },

    // Figure Types
    { type: 'FIGURETYPE', id: 'ft-infantry', label: 'Infantry',  abbreviation: 'Inf',   sortOrder: 1 },
    { type: 'FIGURETYPE', id: 'ft-cavalry',  label: 'Cavalry',   abbreviation: 'Cav',   sortOrder: 2 },
    { type: 'FIGURETYPE', id: 'ft-gun',      label: 'Artillery', abbreviation: 'Gun',   sortOrder: 3 },
    { type: 'FIGURETYPE', id: 'ft-tank',     label: 'Tank',      abbreviation: 'Tank',  sortOrder: 4 },
    { type: 'FIGURETYPE', id: 'ft-chariot',  label: 'Chariot',   abbreviation: 'Chrt',  sortOrder: 5 },
    { type: 'FIGURETYPE', id: 'ft-elephant', label: 'Elephant',  abbreviation: 'Eleph', sortOrder: 6 },
    { type: 'FIGURETYPE', id: 'ft-ship',     label: 'Ship',      abbreviation: 'Ship',  sortOrder: 7 },

    // Nationalities
    { type: 'NATIONALITY', id: 'nat-roman',    label: 'Roman',    abbreviation: 'ROM', sortOrder: 1 },
    { type: 'NATIONALITY', id: 'nat-greek',    label: 'Greek',    abbreviation: 'GRK', sortOrder: 2 },
    { type: 'NATIONALITY', id: 'nat-persian',  label: 'Persian',  abbreviation: 'PER', sortOrder: 3 },
    { type: 'NATIONALITY', id: 'nat-carthage', label: 'Carthaginian', abbreviation: 'CATH', sortOrder: 4 },
    { type: 'NATIONALITY', id: 'nat-french',   label: 'French',   abbreviation: 'FRN', sortOrder: 5 },
    { type: 'NATIONALITY', id: 'nat-british',  label: 'British',  abbreviation: 'BRT', sortOrder: 6 },
    { type: 'NATIONALITY', id: 'nat-german',   label: 'German',   abbreviation: 'GER', sortOrder: 7 },
    { type: 'NATIONALITY', id: 'nat-russian',  label: 'Russian',  abbreviation: 'RUS', sortOrder: 8 },
    { type: 'NATIONALITY', id: 'nat-american', label: 'American', abbreviation: 'USA', sortOrder: 9 },

    // Periods
    { type: 'PERIOD', id: 'per-ancient',    label: 'Ancient',            abbreviation: 'Anc',  sortOrder: 1 },
    { type: 'PERIOD', id: 'per-medieval',   label: 'Medieval',           abbreviation: 'Med',  sortOrder: 2 },
    { type: 'PERIOD', id: 'per-renaissance',label: 'Renaissance',        abbreviation: 'Ren',  sortOrder: 3 },
    { type: 'PERIOD', id: 'per-ecw',        label: 'English Civil War',  abbreviation: 'ECW',  sortOrder: 4 },
    { type: 'PERIOD', id: 'per-napoleonic', label: 'Napoleonic',         abbreviation: 'Nap',  sortOrder: 5 },
    { type: 'PERIOD', id: 'per-acw',        label: 'American Civil War', abbreviation: 'ACW',  sortOrder: 6 },
    { type: 'PERIOD', id: 'per-ww1',        label: 'World War I',        abbreviation: 'WW1',  sortOrder: 7 },
    { type: 'PERIOD', id: 'per-ww2',        label: 'World War II',       abbreviation: 'WW2',  sortOrder: 8 },
    { type: 'PERIOD', id: 'per-modern',     label: 'Modern',             abbreviation: 'Mod',  sortOrder: 9 },

    // Rules
    { type: 'RULES', id: 'rules-dbm',        label: 'DBM',              abbreviation: 'DBM',  sortOrder: 1 },
    { type: 'RULES', id: 'rules-dbmm',       label: 'DBMM',             abbreviation: 'DBMM', sortOrder: 2 },
    { type: 'RULES', id: 'rules-fog',        label: 'Field of Glory',   abbreviation: 'FoG',  sortOrder: 3 },
    { type: 'RULES', id: 'rules-fog2',       label: 'Field of Glory II',abbreviation: 'FoG2', sortOrder: 4 },
    { type: 'RULES', id: 'rules-grandarmee', label: 'Grande Armée',     abbreviation: 'GA',   sortOrder: 5 },
    { type: 'RULES', id: 'rules-blackpowder',label: 'Black Powder',     abbreviation: 'BP',   sortOrder: 6 },
    { type: 'RULES', id: 'rules-coc',        label: 'Chain of Command', abbreviation: 'CoC',  sortOrder: 7 },
    { type: 'RULES', id: 'rules-boltaction', label: 'Bolt Action',      abbreviation: 'BA',   sortOrder: 8 },

    // Base Sizes
    { type: 'BASESIZE', id: 'base-40x15',  label: '40×15mm',  abbreviation: '40×15',  sortOrder: 1 },
    { type: 'BASESIZE', id: 'base-40x20',  label: '40×20mm',  abbreviation: '40×20',  sortOrder: 2 },
    { type: 'BASESIZE', id: 'base-40x30',  label: '40×30mm',  abbreviation: '40×30',  sortOrder: 3 },
    { type: 'BASESIZE', id: 'base-40x40',  label: '40×40mm',  abbreviation: '40×40',  sortOrder: 4 },
    { type: 'BASESIZE', id: 'base-60x20',  label: '60×20mm',  abbreviation: '60×20',  sortOrder: 5 },
    { type: 'BASESIZE', id: 'base-60x30',  label: '60×30mm',  abbreviation: '60×30',  sortOrder: 6 },
    { type: 'BASESIZE', id: 'base-60x40',  label: '60×40mm',  abbreviation: '60×40',  sortOrder: 7 },
    { type: 'BASESIZE', id: 'base-60x60',  label: '60×60mm',  abbreviation: '60×60',  sortOrder: 8 },
    { type: 'BASESIZE', id: 'base-25mm-rd',label: '25mm Round',abbreviation: '25rnd', sortOrder: 9 },
    { type: 'BASESIZE', id: 'base-40mm-rd',label: '40mm Round',abbreviation: '40rnd', sortOrder: 10 },

    // Base Materials
    { type: 'BASEMATERIAL', id: 'mat-metal',   label: 'Metal',   abbreviation: 'Metal',   sortOrder: 1 },
    { type: 'BASEMATERIAL', id: 'mat-mdf',     label: 'MDF',     abbreviation: 'MDF',     sortOrder: 2 },
    { type: 'BASEMATERIAL', id: 'mat-plastic', label: 'Plastic', abbreviation: 'Plastic', sortOrder: 3 },
    { type: 'BASEMATERIAL', id: 'mat-wood',    label: 'Wood',    abbreviation: 'Wood',    sortOrder: 4 },
    { type: 'BASEMATERIAL', id: 'mat-card',    label: 'Card',    abbreviation: 'Card',    sortOrder: 5 },

    // Paint Quality
    { type: 'PAINTQUALITY', id: '1', label: 'Level 1 — Tabletop Ready',          abbreviation: 'L1', sortOrder: 1 },
    { type: 'PAINTQUALITY', id: '2', label: 'Level 2 — Solid Wargames Standard', abbreviation: 'L2', sortOrder: 2 },
    { type: 'PAINTQUALITY', id: '3', label: 'Level 3 — Display Quality',         abbreviation: 'L3', sortOrder: 3 },
    { type: 'PAINTQUALITY', id: '4', label: 'Level 4 — Competition / Gallery',   abbreviation: 'L4', sortOrder: 4 },
  ];

  const items = lookups.map(l => ({
    PK: `LOOKUP#${l.type}`,
    SK: `VALUE#${l.id}`,
    id: l.id,
    type: l.type,
    label: l.label,
    abbreviation: l.abbreviation,
    sortOrder: l.sortOrder,
    active: true,
    createdAt: now(),
    updatedAt: now(),
  }));

  await batchPut(items);
  console.log(`   ✓ ${items.length} lookup values written`);
}

// ─── Exchange rates ───────────────────────────────────────────────────────────

async function seedExchangeRates() {
  console.log('\n💱 Seeding exchange rates...');

  const rates = [
    { currencyCode: 'USD', name: 'US Dollar',         rateToAUD: 1.55 },
    { currencyCode: 'GBP', name: 'British Pound',     rateToAUD: 2.05 },
    { currencyCode: 'EUR', name: 'Euro',              rateToAUD: 1.70 },
    { currencyCode: 'NZD', name: 'New Zealand Dollar',rateToAUD: 0.92 },
    { currencyCode: 'CAD', name: 'Canadian Dollar',   rateToAUD: 1.12 },
  ];

  for (const r of rates) {
    await put({
      PK: 'EXCHANGERATE',
      SK: `CURRENCY#${r.currencyCode}`,
      currencyCode: r.currencyCode,
      name: r.name,
      rateToAUD: r.rateToAUD,
      updatedAt: now(),
    });
    console.log(`   ✓ ${r.currencyCode} — 1 ${r.currencyCode} = ${r.rateToAUD} AUD`);
  }
}

// ─── Painting rates (sample) ──────────────────────────────────────────────────

async function seedPaintingRates() {
  console.log('\n🎨 Seeding painting rates...');

  // USD per figure — based on commercial rates (Fernando Enterprises / miniaturelovers.com)
  const rates = [
    // 6mm
    { scaleId: 'scale-6mm', figureTypeId: 'ft-infantry', qualityId: '1', costUSD: 0.50 },
    { scaleId: 'scale-6mm', figureTypeId: 'ft-infantry', qualityId: '2', costUSD: 1.00 },
    { scaleId: 'scale-6mm', figureTypeId: 'ft-infantry', qualityId: '3', costUSD: 1.50 },
    { scaleId: 'scale-6mm', figureTypeId: 'ft-infantry', qualityId: '4', costUSD: 3.00 },
    { scaleId: 'scale-6mm', figureTypeId: 'ft-cavalry',  qualityId: '1', costUSD: 0.80 },
    { scaleId: 'scale-6mm', figureTypeId: 'ft-cavalry',  qualityId: '2', costUSD: 1.50 },
    { scaleId: 'scale-6mm', figureTypeId: 'ft-cavalry',  qualityId: '3', costUSD: 2.50 },
    { scaleId: 'scale-6mm', figureTypeId: 'ft-cavalry',  qualityId: '4', costUSD: 5.00 },
    // 15mm
    { scaleId: 'scale-15mm', figureTypeId: 'ft-infantry', qualityId: '1', costUSD: 1.50 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-infantry', qualityId: '2', costUSD: 2.50 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-infantry', qualityId: '3', costUSD: 4.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-infantry', qualityId: '4', costUSD: 8.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-cavalry',  qualityId: '1', costUSD: 2.50 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-cavalry',  qualityId: '2', costUSD: 4.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-cavalry',  qualityId: '3', costUSD: 6.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-cavalry',  qualityId: '4', costUSD: 12.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-gun',      qualityId: '1', costUSD: 3.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-gun',      qualityId: '2', costUSD: 5.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-gun',      qualityId: '3', costUSD: 8.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-gun',      qualityId: '4', costUSD: 15.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-elephant', qualityId: '1', costUSD: 5.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-elephant', qualityId: '2', costUSD: 8.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-elephant', qualityId: '3', costUSD: 12.00 },
    { scaleId: 'scale-15mm', figureTypeId: 'ft-elephant', qualityId: '4', costUSD: 20.00 },
    // 25mm
    { scaleId: 'scale-25mm', figureTypeId: 'ft-infantry', qualityId: '1', costUSD: 3.00 },
    { scaleId: 'scale-25mm', figureTypeId: 'ft-infantry', qualityId: '2', costUSD: 5.00 },
    { scaleId: 'scale-25mm', figureTypeId: 'ft-infantry', qualityId: '3', costUSD: 8.00 },
    { scaleId: 'scale-25mm', figureTypeId: 'ft-infantry', qualityId: '4', costUSD: 15.00 },
    { scaleId: 'scale-25mm', figureTypeId: 'ft-cavalry',  qualityId: '1', costUSD: 5.00 },
    { scaleId: 'scale-25mm', figureTypeId: 'ft-cavalry',  qualityId: '2', costUSD: 8.00 },
    { scaleId: 'scale-25mm', figureTypeId: 'ft-cavalry',  qualityId: '3', costUSD: 12.00 },
    { scaleId: 'scale-25mm', figureTypeId: 'ft-cavalry',  qualityId: '4', costUSD: 20.00 },
  ];

  const items = rates.map(r => ({
    PK: `PAINTCOST#${r.scaleId}#${r.figureTypeId}`,
    SK: `QUALITY#${r.qualityId}`,
    ...r,
    updatedAt: now(),
  }));

  await batchPut(items);
  console.log(`   ✓ ${items.length} painting rates written`);
}

// ─── Basing rates (sample) ────────────────────────────────────────────────────

async function seedBasingRates() {
  console.log('\n🪨 Seeding basing rates...');

  const rates = [
    { materialId: 'mat-metal',   sizeId: 'base-40x15', costAUD: 0.20 },
    { materialId: 'mat-metal',   sizeId: 'base-40x20', costAUD: 0.25 },
    { materialId: 'mat-metal',   sizeId: 'base-40x30', costAUD: 0.35 },
    { materialId: 'mat-metal',   sizeId: 'base-60x30', costAUD: 0.40 },
    { materialId: 'mat-metal',   sizeId: 'base-60x60', costAUD: 0.60 },
    { materialId: 'mat-mdf',     sizeId: 'base-40x15', costAUD: 0.08 },
    { materialId: 'mat-mdf',     sizeId: 'base-40x20', costAUD: 0.10 },
    { materialId: 'mat-mdf',     sizeId: 'base-40x30', costAUD: 0.12 },
    { materialId: 'mat-mdf',     sizeId: 'base-60x30', costAUD: 0.15 },
    { materialId: 'mat-mdf',     sizeId: 'base-60x60', costAUD: 0.20 },
    { materialId: 'mat-plastic', sizeId: 'base-40x20', costAUD: 0.05 },
    { materialId: 'mat-plastic', sizeId: 'base-40x30', costAUD: 0.07 },
    { materialId: 'mat-plastic', sizeId: 'base-60x30', costAUD: 0.10 },
  ];

  const items = rates.map(r => ({
    PK: `BASECOST#${r.materialId}`,
    SK: `SIZE#${r.sizeId}`,
    ...r,
    updatedAt: now(),
  }));

  await batchPut(items);
  console.log(`   ✓ ${items.length} basing rates written`);
}

// ─── Collections ─────────────────────────────────────────────────────────────

async function seedCollections() {
  console.log('\n📦 Seeding collections...');

  const collections = [
    { id: 'col-miniature-01', name: 'Miniature Armies', category: 'MINIATURE', description: 'Scale miniature military figures' },
    { id: 'col-boardgame-01', name: 'Board Games',      category: 'BOARDGAME', description: 'Board game collection' },
    { id: 'col-book-01',      name: 'Books & Publications', category: 'BOOK',  description: 'Wargaming and history books' },
    { id: 'col-terrain-01',   name: 'Terrain',          category: 'TERRAIN',   description: 'Terrain and buildings' },
  ];

  for (const c of collections) {
    await put({
      PK: `COLLECTION#${c.id}`,
      SK: 'METADATA',
      GSI1PK: 'COLLECTION',
      GSI1SK: `COLLECTION#${c.id}`,
      id: c.id,
      name: c.name,
      category: c.category,
      description: c.description,
      ownerId: 'GLOBAL',
      createdAt: now(),
      updatedAt: now(),
    });
    console.log(`   ✓ ${c.name}`);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    await seedUsers();
    await seedLookups();
    await seedExchangeRates();
    await seedPaintingRates();
    await seedBasingRates();
    await seedCollections();

    console.log('\n✅ Seed complete!\n');
    console.log('Login credentials:');
    console.log('  admin     / Admin1234!   (ADMIN)');
    console.log('  FFarquar  / Change1234!  (ADMIN) ← change this password after first login');
    console.log('  viewer    / View1234!    (USER)\n');
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  }
}

main();
