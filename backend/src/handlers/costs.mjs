import { QueryCommand, PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, ok, noContent, badRequest, serverError, now, requireAdmin } from './_shared.mjs';

// Paint cost matrix:    PK: PAINTCOST#<scaleId>#<figureTypeId>        SK: QUALITY#<qualityId>
// Basing cost matrix:   PK: BASECOST#<materialId>                     SK: SIZE#<sizeId>
// Exchange rates:       PK: EXCHANGERATE                              SK: CURRENCY#<code>
// Figure cost matrix:   PK: FIGURECOST#<manufacturerId>#<scaleId>     SK: FIGURETYPE#<figureTypeId>

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.rawPath || event.path || '';
  const pathParams = event.pathParameters || {};

  try {
    if (path.includes('/costs/paint')) {
      return method === 'GET' ? await getPaintCosts() : await upsertPaintCost(event);
    }
    if (path.includes('/costs/basing')) {
      return method === 'GET' ? await getBasingCosts() : await upsertBasingCost(event);
    }
    if (path.includes('/costs/exchange')) {
      if (method === 'GET') return await getExchangeRates();
      if (method === 'PUT') return await upsertExchangeRate(event);
      if (method === 'DELETE') return await deleteExchangeRate(pathParams.code, event);
    }
    if (path.includes('/costs/figure')) {
      if (method === 'GET') return await getFigureCosts();
      if (method === 'PUT') return await upsertFigureCost(event);
      if (method === 'DELETE') return await deleteFigureCost(event);
    }
    if (path.includes('/costs/mfrnotes')) {
      if (method === 'GET') return await getManufacturerNotes();
      if (method === 'PUT') return await upsertManufacturerNote(event);
    }
    return badRequest('Unknown cost endpoint');
  } catch (err) {
    return serverError(err);
  }
};

async function getPaintCosts() {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'PAINTCOST#' },
  }));
  return ok(result.Items || []);
}

async function upsertPaintCost(event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };

  const body = JSON.parse(event.body || '{}');
  const { scaleId, figureTypeId, qualityId, costUSD } = body;
  if (!scaleId || !figureTypeId || !qualityId || costUSD == null) {
    return badRequest('scaleId, figureTypeId, qualityId, and costUSD are required');
  }

  const item = {
    PK: `PAINTCOST#${scaleId}#${figureTypeId}`,
    SK: `QUALITY#${qualityId}`,
    scaleId,
    figureTypeId,
    qualityId,
    costUSD: Number(costUSD),
    updatedAt: now(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return ok(item);
}

async function getExchangeRates() {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': 'EXCHANGERATE' },
  }));
  return ok(result.Items || []);
}

async function upsertExchangeRate(event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };

  const body = JSON.parse(event.body || '{}');
  const { currencyCode, name, rateToAUD } = body;
  if (!currencyCode || rateToAUD == null) return badRequest('currencyCode and rateToAUD are required');

  const code = currencyCode.toUpperCase();
  const item = {
    PK: 'EXCHANGERATE',
    SK: `CURRENCY#${code}`,
    currencyCode: code,
    name: name || code,
    rateToAUD: Number(rateToAUD),
    updatedAt: now(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return ok(item);
}

async function deleteExchangeRate(code, event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };
  if (!code) return badRequest('currency code is required');

  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: 'EXCHANGERATE', SK: `CURRENCY#${code.toUpperCase()}` },
    ConditionExpression: 'attribute_exists(PK)',
  }));
  return noContent();
}

async function getFigureCosts() {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'FIGURECOST#' },
  }));
  return ok(result.Items || []);
}

async function upsertFigureCost(event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };

  const body = JSON.parse(event.body || '{}');
  const { manufacturerId, scaleId, figureTypeId, cost, currency } = body;
  if (!manufacturerId || !scaleId || !figureTypeId || cost == null || !currency) {
    return badRequest('manufacturerId, scaleId, figureTypeId, cost, and currency are required');
  }

  const item = {
    PK: `FIGURECOST#${manufacturerId}#${scaleId}`,
    SK: `FIGURETYPE#${figureTypeId}`,
    manufacturerId,
    scaleId,
    figureTypeId,
    cost: Number(cost),
    currency: currency.toUpperCase(),
    updatedAt: now(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return ok(item);
}

async function deleteFigureCost(event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };

  const qs = event.queryStringParameters || {};
  const { manufacturerId, scaleId, figureTypeId } = qs;
  if (!manufacturerId || !scaleId || !figureTypeId) {
    return badRequest('manufacturerId, scaleId, and figureTypeId query params are required');
  }

  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `FIGURECOST#${manufacturerId}#${scaleId}`,
      SK: `FIGURETYPE#${figureTypeId}`,
    },
    ConditionExpression: 'attribute_exists(PK)',
  }));
  return noContent();
}

async function getBasingCosts() {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'BASECOST#' },
  }));
  return ok(result.Items || []);
}

async function upsertBasingCost(event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };

  const body = JSON.parse(event.body || '{}');
  const { materialId, sizeId, costUSD } = body;
  if (!materialId || !sizeId || costUSD == null) {
    return badRequest('materialId, sizeId, and costUSD are required');
  }

  const item = {
    PK: `BASECOST#${materialId}`,
    SK: `SIZE#${sizeId}`,
    materialId,
    sizeId,
    costUSD: Number(costUSD),
    updatedAt: now(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return ok(item);
}

// Manufacturer pricing notes:  PK: MFRNOTES#<manufacturerId>   SK: NOTES
async function getManufacturerNotes() {
  const result = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix)',
    ExpressionAttributeValues: { ':prefix': 'MFRNOTES#' },
  }));
  return ok(result.Items || []);
}

async function upsertManufacturerNote(event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };

  const body = JSON.parse(event.body || '{}');
  const { manufacturerId, notes } = body;
  if (!manufacturerId) return badRequest('manufacturerId is required');

  const item = {
    PK: `MFRNOTES#${manufacturerId}`,
    SK: 'NOTES',
    manufacturerId,
    notes: notes || '',
    updatedAt: now(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return ok(item);
}
