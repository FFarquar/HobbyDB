import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME, ok, created, noContent, badRequest, serverError, newId, now } from './_shared.mjs';

// PK: GROUP#<groupId>  SK: ITEM#<id>
// GSI1PK: ITEM#<id>   GSI1SK: METADATA
//
// Common fields: id, groupId, collectionId, category, name, quantity, notes, imageKeys[]
//
// Miniature-specific: scaleId, scaleName, manufacturerId, manufacturerName,
//   figureTypeId, figureTypeName, nationalityId, periodId, rulesId,
//   paintQualityId, paintQualityName, baseSizeId, baseMaterialId,
//   numberBases, purchasePriceAmt, purchasePriceCurrency
//
// BoardGame-specific: publisher, minPlayers, maxPlayers, playTimeMinutes, bggId, purchasePriceAmt, purchasePriceCurrency, datePurchased
// Book-specific: author, isbn, publisher, publishYear, purchasePriceAmt, purchasePriceCurrency, datePurchased
// Terrain-specific: scale, material
// Other: customFields (free text)

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const pathParams = event.pathParameters || {};

  try {
    switch (method) {
      case 'GET': return await listItems(pathParams.groupId);
      case 'POST': return await createItem(pathParams.groupId, event);
      case 'PUT': return await updateItem(pathParams.groupId, pathParams.id, event);
      case 'DELETE': return await deleteItem(pathParams.groupId, pathParams.id);
      default: return badRequest('Method not supported');
    }
  } catch (err) {
    return serverError(err);
  }
};

async function listItems(groupId) {
  if (!groupId) return badRequest('groupId is required');
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `GROUP#${groupId}`,
      ':skPrefix': 'ITEM#',
    },
  }));
  return ok(result.Items || []);
}

const VALID_CATEGORIES = ['MINIATURE', 'BOARDGAME', 'BOOK', 'TERRAIN', 'OTHER'];

async function createItem(groupId, event) {
  if (!groupId) return badRequest('groupId is required');
  const body = JSON.parse(event.body || '{}');
  const { name, category, collectionId, quantity = 1 } = body;

  if (!name) return badRequest('name is required');
  if (!category || !VALID_CATEGORIES.includes(category)) return badRequest(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  if (!collectionId) return badRequest('collectionId is required');

  const id = newId();
  const timestamp = now();

  const item = {
    PK: `GROUP#${groupId}`,
    SK: `ITEM#${id}`,
    GSI1PK: `ITEM#${id}`,
    GSI1SK: 'METADATA',
    id,
    groupId,
    collectionId,
    category,
    name,
    quantity,
    notes: body.notes || '',
    imageKeys: body.imageKeys || [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...buildCategoryFields(category, body),
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return created(item);
}

function buildCategoryFields(category, body) {
  switch (category) {
    case 'MINIATURE':
      return {
        scaleId: body.scaleId || null,
        scaleName: body.scaleName || '',
        manufacturerId: body.manufacturerId || null,
        manufacturerName: body.manufacturerName || '',
        figureTypeId: body.figureTypeId || null,
        figureTypeName: body.figureTypeName || '',
        nationalityId: body.nationalityId || null,
        periodId: body.periodId || null,
        rulesId: body.rulesId || null,
        paintQualityId: body.paintQualityId || null,
        paintQualityName: body.paintQualityName || '',
        baseSizeId: body.baseSizeId || null,
        baseMaterialId: body.baseMaterialId || null,
        numberBases: body.numberBases || 0,
        purchasePriceAmt: body.purchasePriceAmt || null,
        purchasePriceCurrency: body.purchasePriceCurrency || 'AUD',
      };
    case 'BOARDGAME':
      return {
        publisher: body.publisher || '',
        minPlayers: body.minPlayers || null,
        maxPlayers: body.maxPlayers || null,
        playTimeMinutes: body.playTimeMinutes || null,
        bggId: body.bggId || '',
        purchasePriceAmt: body.purchasePriceAmt || null,
        purchasePriceCurrency: body.purchasePriceCurrency || null,
        datePurchased: body.datePurchased || null,
      };
    case 'BOOK':
      return {
        author: body.author || '',
        isbn: body.isbn || '',
        publisher: body.publisher || '',
        publishYear: body.publishYear || null,
        purchasePriceAmt: body.purchasePriceAmt || null,
        purchasePriceCurrency: body.purchasePriceCurrency || null,
        datePurchased: body.datePurchased || null,
      };
    case 'TERRAIN':
      return {
        scaleId: body.scaleId || null,
        scaleName: body.scaleName || '',
        material: body.material || '',
      };
    case 'OTHER':
      return { customFields: body.customFields || '' };
    default:
      return {};
  }
}

async function updateItem(groupId, id, event) {
  if (!groupId || !id) return badRequest('groupId and id are required');
  const body = JSON.parse(event.body || '{}');

  const timestamp = now();
  const updates = ['updatedAt = :updatedAt'];
  const exprValues = { ':updatedAt': timestamp };
  const exprNames = {};

  const simpleFields = ['quantity', 'notes', 'imageKeys', 'scaleId', 'scaleName',
    'manufacturerId', 'manufacturerName', 'figureTypeId', 'figureTypeName',
    'nationalityId', 'periodId', 'rulesId', 'paintQualityId', 'paintQualityName',
    'baseSizeId', 'baseMaterialId', 'numberBases', 'purchasePriceAmt', 'purchasePriceCurrency',
    'publisher', 'minPlayers', 'maxPlayers', 'playTimeMinutes', 'bggId',
    'datePurchased',
    'author', 'isbn', 'publishYear', 'material', 'customFields'];

  for (const field of simpleFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = :${field}`);
      exprValues[`:${field}`] = body[field];
    }
  }

  if (body.name !== undefined) {
    updates.push('#name = :name');
    exprNames['#name'] = 'name';
    exprValues[':name'] = body.name;
  }

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `GROUP#${groupId}`, SK: `ITEM#${id}` },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: exprValues,
    ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  }));
  return ok(result.Attributes);
}

async function deleteItem(groupId, id) {
  if (!groupId || !id) return badRequest('groupId and id are required');
  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: `GROUP#${groupId}`, SK: `ITEM#${id}` },
    ConditionExpression: 'attribute_exists(PK)',
  }));
  return noContent();
}
