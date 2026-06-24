import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, ok, created, noContent, badRequest, serverError, newId, now } from './_shared.mjs';

// PK: COLLECTION#<collectionId>  SK: GROUP#<id>
// GSI1PK: GROUP#<id>  GSI1SK: METADATA  (for direct group lookup)

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const pathParams = event.pathParameters || {};

  try {
    switch (method) {
      case 'GET': return await listGroups(pathParams.collectionId);
      case 'POST': return await createGroup(pathParams.collectionId, event);
      case 'PUT': return await updateGroup(pathParams.collectionId, pathParams.id, event);
      case 'DELETE': return await deleteGroup(pathParams.collectionId, pathParams.id);
      default: return badRequest('Method not supported');
    }
  } catch (err) {
    return serverError(err);
  }
};

async function listGroups(collectionId) {
  if (!collectionId) return badRequest('collectionId is required');
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `COLLECTION#${collectionId}`,
      ':skPrefix': 'GROUP#',
    },
  }));
  return ok(result.Items || []);
}

async function createGroup(collectionId, event) {
  if (!collectionId) return badRequest('collectionId is required');
  const body = JSON.parse(event.body || '{}');
  const { name, description, notes, scaleId, scaleName, periodId, periodName, nationalityId, nationalityName,
          postageInboundAmt, postageInboundCurrency, postageReturnAmt, postageReturnCurrency } = body;
  if (!name) return badRequest('name is required');

  const id = newId();
  const timestamp = now();
  const item = {
    PK: `COLLECTION#${collectionId}`,
    SK: `GROUP#${id}`,
    GSI1PK: `GROUP#${id}`,
    GSI1SK: 'METADATA',
    id,
    collectionId,
    name,
    description: description || '',
    notes: notes || '',
    scaleId: scaleId || null,
    scaleName: scaleName || '',
    periodId: periodId || null,
    periodName: periodName || '',
    nationalityId: nationalityId || null,
    nationalityName: nationalityName || '',
    postageInboundAmt: postageInboundAmt ?? null,
    postageInboundCurrency: postageInboundCurrency || 'AUD',
    postageReturnAmt: postageReturnAmt ?? null,
    postageReturnCurrency: postageReturnCurrency || 'AUD',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return created(item);
}

async function updateGroup(collectionId, id, event) {
  if (!collectionId || !id) return badRequest('collectionId and id are required');
  const body = JSON.parse(event.body || '{}');

  const updates = ['updatedAt = :updatedAt'];
  const exprValues = { ':updatedAt': now() };
  const exprNames = {};

  if (body.name !== undefined) { updates.push('#name = :name'); exprNames['#name'] = 'name'; exprValues[':name'] = body.name; }
  if (body.description !== undefined) { updates.push('description = :description'); exprValues[':description'] = body.description; }
  if (body.notes !== undefined) { updates.push('notes = :notes'); exprValues[':notes'] = body.notes; }
  if (body.scaleId !== undefined) { updates.push('scaleId = :scaleId'); exprValues[':scaleId'] = body.scaleId; }
  if (body.scaleName !== undefined) { updates.push('scaleName = :scaleName'); exprValues[':scaleName'] = body.scaleName; }
  if (body.periodId !== undefined) { updates.push('periodId = :periodId'); exprValues[':periodId'] = body.periodId; }
  if (body.periodName !== undefined) { updates.push('periodName = :periodName'); exprValues[':periodName'] = body.periodName; }
  if (body.nationalityId !== undefined) { updates.push('nationalityId = :nationalityId'); exprValues[':nationalityId'] = body.nationalityId; }
  if (body.nationalityName !== undefined) { updates.push('nationalityName = :nationalityName'); exprValues[':nationalityName'] = body.nationalityName; }
  if (body.postageInboundAmt !== undefined) { updates.push('postageInboundAmt = :postageInboundAmt'); exprValues[':postageInboundAmt'] = body.postageInboundAmt; }
  if (body.postageInboundCurrency !== undefined) { updates.push('postageInboundCurrency = :postageInboundCurrency'); exprValues[':postageInboundCurrency'] = body.postageInboundCurrency; }
  if (body.postageReturnAmt !== undefined) { updates.push('postageReturnAmt = :postageReturnAmt'); exprValues[':postageReturnAmt'] = body.postageReturnAmt; }
  if (body.postageReturnCurrency !== undefined) { updates.push('postageReturnCurrency = :postageReturnCurrency'); exprValues[':postageReturnCurrency'] = body.postageReturnCurrency; }

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `COLLECTION#${collectionId}`, SK: `GROUP#${id}` },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: exprValues,
    ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  }));
  return ok(result.Attributes);
}

async function deleteGroup(collectionId, id) {
  if (!collectionId || !id) return badRequest('collectionId and id are required');
  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: `COLLECTION#${collectionId}`, SK: `GROUP#${id}` },
    ConditionExpression: 'attribute_exists(PK)',
  }));
  return noContent();
}
