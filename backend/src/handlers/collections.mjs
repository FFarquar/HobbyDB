import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, ok, created, noContent, badRequest, notFound, serverError, newId, now, getCallerContext } from './_shared.mjs';

// PK: COLLECTION#<id>  SK: METADATA
// GSI1PK: COLLECTION  GSI1SK: COLLECTION#<id>

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const pathParams = event.pathParameters || {};

  try {
    switch (method) {
      case 'GET': return await listCollections();
      case 'POST': return await createCollection(event);
      case 'PUT': return await updateCollection(pathParams.id, event);
      case 'DELETE': return await deleteCollection(pathParams.id);
      default: return badRequest('Method not supported');
    }
  } catch (err) {
    return serverError(err);
  }
};

async function listCollections() {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: { ':gsi1pk': 'COLLECTION' },
  }));
  return ok(result.Items || []);
}

async function createCollection(event) {
  const body = JSON.parse(event.body || '{}');
  const { name, category, description } = body;

  if (!name || !category) return badRequest('name and category are required');

  const validCategories = ['MINIATURE', 'BOARDGAME', 'BOOK', 'TERRAIN', 'OTHER'];
  if (!validCategories.includes(category)) return badRequest(`category must be one of: ${validCategories.join(', ')}`);

  const id = newId();
  const timestamp = now();
  const item = {
    PK: `COLLECTION#${id}`,
    SK: 'METADATA',
    GSI1PK: 'COLLECTION',
    GSI1SK: `COLLECTION#${id}`,
    id,
    name,
    category,
    description: description || '',
    ownerId: 'GLOBAL',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return created(item);
}

async function updateCollection(id, event) {
  if (!id) return badRequest('id is required');
  const body = JSON.parse(event.body || '{}');

  const updates = [];
  const exprValues = { ':updatedAt': now() };
  const exprNames = {};

  if (body.name !== undefined) { updates.push('#name = :name'); exprNames['#name'] = 'name'; exprValues[':name'] = body.name; }
  if (body.description !== undefined) { updates.push('description = :description'); exprValues[':description'] = body.description; }
  if (updates.length === 0) return badRequest('Nothing to update');

  updates.push('updatedAt = :updatedAt');

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `COLLECTION#${id}`, SK: 'METADATA' },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: exprValues,
    ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  }));
  return ok(result.Attributes);
}

async function deleteCollection(id) {
  if (!id) return badRequest('id is required');
  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: `COLLECTION#${id}`, SK: 'METADATA' },
    ConditionExpression: 'attribute_exists(PK)',
  }));
  return noContent();
}
