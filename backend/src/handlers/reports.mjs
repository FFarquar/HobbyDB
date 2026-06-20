import { ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, ok, badRequest, serverError } from './_shared.mjs';

// Report types:
//   figures-by-scale    - count of miniatures grouped by scale
//   figures-by-period   - count of miniatures grouped by period
//   collection-value    - estimated USD value per collection (painting + basing cost rollup)
//   inventory-summary   - total counts by category

export const handler = async (event) => {
  const pathParams = event.pathParameters || {};
  const reportType = pathParams.type;

  try {
    switch (reportType) {
      case 'figures-by-scale': return await figuresByScale();
      case 'figures-by-period': return await figuresByPeriod();
      case 'collection-value': return await collectionValue();
      case 'inventory-summary': return await inventorySummary();
      default: return badRequest(`Unknown report type: ${reportType}. Valid types: figures-by-scale, figures-by-period, collection-value, inventory-summary`);
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
    grouped[key] = (grouped[key] || 0) + (item.quantity || 1);
  }

  const rows = Object.entries(grouped)
    .map(([scale, count]) => ({ scale, count }))
    .sort((a, b) => b.count - a.count);

  return ok({ reportType: 'figures-by-scale', rows, totalFigures: miniatures.reduce((s, i) => s + (i.quantity || 1), 0) });
}

async function figuresByPeriod() {
  const items = await scanAllItems();
  const miniatures = items.filter(i => i.category === 'MINIATURE');

  const grouped = {};
  for (const item of miniatures) {
    const key = item.periodName || item.periodId || 'Unknown';
    grouped[key] = (grouped[key] || 0) + (item.quantity || 1);
  }

  const rows = Object.entries(grouped)
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => b.count - a.count);

  return ok({ reportType: 'figures-by-period', rows, totalFigures: miniatures.reduce((s, i) => s + (i.quantity || 1), 0) });
}

async function collectionValue() {
  const [items, paintCosts, basingCosts] = await Promise.all([
    scanAllItems(),
    scanAllCosts('PAINTCOST#'),
    scanAllCosts('BASECOST#'),
  ]);

  // Build lookup maps
  const paintMap = {};
  for (const pc of paintCosts) {
    paintMap[pc.PK + '|' + pc.SK] = pc.costUSD;
  }
  const basingMap = {};
  for (const bc of basingCosts) {
    basingMap[bc.PK + '|' + bc.SK] = bc.costUSD;
  }

  // Aggregate by collectionId
  const collections = {};
  for (const item of items) {
    const colId = item.collectionId || 'unknown';
    if (!collections[colId]) collections[colId] = { collectionId: colId, items: 0, totalValueUSD: 0 };
    collections[colId].items++;

    if (item.category === 'MINIATURE' && item.scaleId && item.figureTypeId && item.paintQualityId) {
      const paintKey = `PAINTCOST#${item.scaleId}#${item.figureTypeId}|QUALITY#${item.paintQualityId}`;
      const paintRate = paintMap[paintKey] || 0;
      const qty = item.quantity || 1;
      collections[colId].totalValueUSD += paintRate * qty;

      if (item.baseMaterialId && item.baseSizeId) {
        const basingKey = `BASECOST#${item.baseMaterialId}|SIZE#${item.baseSizeId}`;
        const basingRate = basingMap[basingKey] || 0;
        collections[colId].totalValueUSD += basingRate * (item.numberBases || qty);
      }
    }
  }

  return ok({ reportType: 'collection-value', collections: Object.values(collections) });
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
    summary[cat].totalQuantity += item.quantity || 1;
    totalItems++;
    totalQty += item.quantity || 1;
  }

  return ok({ reportType: 'inventory-summary', categories: Object.values(summary), totalItems, totalQuantity: totalQty });
}
