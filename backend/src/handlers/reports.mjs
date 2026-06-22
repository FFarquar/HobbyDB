import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, ok, badRequest, serverError } from './_shared.mjs';

// Report types:
//   figures-by-scale    - count of miniatures grouped by scale
//   figures-by-period   - count of miniatures grouped by period
//   collection-value    - estimated USD value per collection (painting + basing cost rollup)
//   inventory-summary   - total counts by category
//   value-by-army       - figure price + paint + basing cost per army (AUD)

export const handler = async (event) => {
  const pathParams = event.pathParameters || {};
  const reportType = pathParams.type;

  try {
    switch (reportType) {
      case 'figures-by-scale': return await figuresByScale();
      case 'figures-by-period': return await figuresByPeriod();
      case 'collection-value': return await collectionValue();
      case 'inventory-summary': return await inventorySummary();
      case 'value-by-army': return await valueByArmy();
      default: return badRequest(`Unknown report type: ${reportType}. Valid types: figures-by-scale, figures-by-period, collection-value, inventory-summary, value-by-army`);
    }
  } catch (err) {
    return serverError(err);
  }
};

async function scanAllItems() {
  const items = [];
  let lastKey;
  do {
    const result = await ddb.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: { ':skPrefix': 'ITEM#' },
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function scanAllCosts(prefix) {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix)',
    ExpressionAttributeValues: { ':prefix': prefix },
  }));
  return result.Items || [];
}

async function figuresByScale() {
  const items = await scanAllItems();
  const miniatures = items.filter(i => i.category === 'MINIATURE');

  const grouped = {};
  for (const item of miniatures) {
    const key = item.scaleName || item.scaleId || 'Unknown';
    const totalFigs = (item.numberBases || 0) * (item.quantity || 1);
    grouped[key] = (grouped[key] || 0) + totalFigs;
  }

  const rows = Object.entries(grouped)
    .map(([scale, count]) => ({ scale, count }))
    .sort((a, b) => b.count - a.count);

  const totalFigures = miniatures.reduce((s, i) => s + (i.numberBases || 0) * (i.quantity || 1), 0);
  return ok({ reportType: 'figures-by-scale', rows, totalFigures });
}

async function figuresByPeriod() {
  const items = await scanAllItems();
  const miniatures = items.filter(i => i.category === 'MINIATURE');

  const grouped = {};
  for (const item of miniatures) {
    const key = item.periodName || item.periodId || 'Unknown';
    const totalFigs = (item.numberBases || 0) * (item.quantity || 1);
    grouped[key] = (grouped[key] || 0) + totalFigs;
  }

  const rows = Object.entries(grouped)
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => b.count - a.count);

  const totalFigures = miniatures.reduce((s, i) => s + (i.numberBases || 0) * (i.quantity || 1), 0);
  return ok({ reportType: 'figures-by-period', rows, totalFigures });
}

async function collectionValue() {
  const [items, figureCosts, paintCosts, basingCosts, exchangeRatesData] = await Promise.all([
    scanAllItems(),
    scanAllCosts('FIGURECOST#'),
    scanAllCosts('PAINTCOST#'),
    scanAllCosts('BASECOST#'),
    scanExchangeRates(),
  ]);

  const rateMap = { AUD: 1.0 };
  for (const er of exchangeRatesData) rateMap[er.currencyCode] = er.rateToAUD;

  const figureMap = {};
  for (const fc of figureCosts) {
    figureMap[`${fc.manufacturerId}|${fc.scaleId}|${fc.figureTypeId}`] = fc;
  }
  const paintMap = {};
  for (const pc of paintCosts) {
    paintMap[`${pc.scaleId}|${pc.figureTypeId}|${pc.qualityId}`] = pc;
  }
  const basingMap = {};
  for (const bc of basingCosts) {
    basingMap[`${bc.materialId}|${bc.sizeId}`] = bc.costAUD;
  }

  const collections = {};
  for (const item of items) {
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

  return ok({ reportType: 'collection-value', collections: Object.values(collections) });
}

async function scanAllGroups() {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: { ':skPrefix': 'GROUP#' },
  }));
  return result.Items || [];
}

async function scanAllCollections() {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: { ':sk': 'METADATA' },
  }));
  return result.Items || [];
}

async function scanExchangeRates() {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': 'EXCHANGERATE' },
  }));
  return result.Items || [];
}

async function inventorySummary() {
  const items = await scanAllItems();
  const summary = {};
  let totalItems = 0;
  let totalQty = 0;

  for (const item of items) {
    const cat = item.category || 'OTHER';
    if (!summary[cat]) summary[cat] = { category: cat, itemCount: 0, totalQuantity: 0 };
    summary[cat].itemCount++;
    const qty = cat === 'MINIATURE'
      ? (item.numberBases || 0) * (item.quantity || 1)
      : (item.quantity || 1);
    summary[cat].totalQuantity += qty;
    totalItems++;
    totalQty += qty;
  }

  return ok({ reportType: 'inventory-summary', categories: Object.values(summary), totalItems, totalQuantity: totalQty });
}

async function valueByArmy() {
  const [items, figureCostsData, paintCostsData, basingCostsData, exchangeRatesData, groupsData, collectionsData] = await Promise.all([
    scanAllItems(),
    scanAllCosts('FIGURECOST#'),
    scanAllCosts('PAINTCOST#'),
    scanAllCosts('BASECOST#'),
    scanExchangeRates(),
    scanAllGroups(),
    scanAllCollections(),
  ]);

  const figureMap = {};
  for (const fc of figureCostsData) {
    figureMap[`${fc.manufacturerId}|${fc.scaleId}|${fc.figureTypeId}`] = fc;
  }
  const paintMap = {};
  for (const pc of paintCostsData) {
    paintMap[`${pc.scaleId}|${pc.figureTypeId}|${pc.qualityId}`] = pc;
  }
  const basingMap = {};
  for (const bc of basingCostsData) {
    basingMap[`${bc.materialId}|${bc.sizeId}`] = bc.costAUD;
  }
  const rateMap = { AUD: 1.0 };
  for (const er of exchangeRatesData) {
    rateMap[er.currencyCode] = er.rateToAUD;
  }

  const collectionMap = {};
  for (const c of collectionsData) {
    if (c.id) collectionMap[c.id] = c;
  }

  const itemsByGroup = {};
  for (const item of items) {
    if (!itemsByGroup[item.groupId]) itemsByGroup[item.groupId] = [];
    itemsByGroup[item.groupId].push(item);
  }

  const armies = [];
  for (const group of groupsData) {
    const collection = collectionMap[group.collectionId];
    if (!collection || collection.category !== 'MINIATURE') continue;

    const miniatures = (itemsByGroup[group.id] || []).filter(i => i.category === 'MINIATURE');
    let totalFigureCostAUD = 0, totalPaintCostAUD = 0, totalBasingCostAUD = 0;

    const itemRows = miniatures.map(item => {
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
      items: itemRows,
    });
  }

  armies.sort((a, b) => b.totalAUD - a.totalAUD);
  return ok({ reportType: 'value-by-army', armies });
}
