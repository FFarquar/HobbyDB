import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, ok, created, noContent, badRequest, notFound, serverError, newId, now, requireAdmin } from './_shared.mjs';

// PK: LOOKUP#<TYPE>   SK: VALUE#<id>
//
// Valid lookup types:
//   SCALE, MANUFACTURER, FIGURETYPE, NATIONALITY, PERIOD, RULES,
//   BASESIZE, BASEMATERIAL, PAINTQUALITY

const VALID_TYPES = ['SCALE', 'MANUFACTURER', 'FIGURETYPE', 'NATIONALITY', 'PERIOD', 'RULES', 'BASESIZE', 'BASEMATERIAL', 'PAINTQUALITY'];

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const pathParams = event.pathParameters || {};
  const type = (pathParams.type || '').toUpperCase();

  if (!VALID_TYPES.includes(type)) {
    return badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  try {
    switch (method) {
      case 'GET': return await listLookups(type);
      case 'POST': return await createLookup(type, event);
      case 'PUT': return await updateLookup(type, pathParams.id, event);
      case 'DELETE': return await deleteLookup(type, pathParams.id, event);
      default: return badRequest('Method not supported');
    }
  } catch (err) {
    return serverError(err);
  }
};

async function listLookups(type) {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `LOOKUP#${type}` },
  }));

  const items = (result.Items || []).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
  return ok(items);
}

async function createLookup(type, event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };

  const body = JSON.parse(event.body || '{}');
  const { label, abbreviation } = body;
  if (!label) return badRequest('label is required');

  const id = newId();
  const timestamp = now();
  const item = {
    PK: `LOOKUP#${type}`,
    SK: `VALUE#${id}`,
    id,
    type,
    label,
    abbreviation: abbreviation || '',
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return created(item);
}

async function updateLookup(type, id, event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };
  if (!id) return badRequest('id is required');

  const body = JSON.parse(event.body || '{}');
  const updates = ['updatedAt = :updatedAt'];
  const exprValues = { ':updatedAt': now() };
  const exprNames = {};

  if (body.label !== undefined) { updates.push('#label = :label'); exprNames['#label'] = 'label'; exprValues[':label'] = body.label; }
  if (body.abbreviation !== undefined) { updates.push('abbreviation = :abbreviation'); exprValues[':abbreviation'] = body.abbreviation; }
  if (body.active !== undefined) { updates.push('active = :active'); exprValues[':active'] = body.active; }

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `LOOKUP#${type}`, SK: `VALUE#${id}` },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: exprValues,
    ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  }));
  return ok(result.Attributes);
}

async function deleteLookup(type, id, event) {
  if (!requireAdmin(event)) return { statusCode: 403, headers: {}, body: JSON.stringify({ message: 'Admin only' }) };
  if (!id) return badRequest('id is required');

  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: `LOOKUP#${type}`, SK: `VALUE#${id}` },
    ConditionExpression: 'attribute_exists(PK)',
  }));
  return noContent();
}
