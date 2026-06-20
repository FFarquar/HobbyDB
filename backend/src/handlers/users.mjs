import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';
import { ddb, TABLE_NAME, ok, created, noContent, badRequest, forbidden, serverError, newId, now, requireAdmin, getCallerContext } from './_shared.mjs';

// PK: USER#<loginID>  SK: PROFILE
// GSI1PK: USER  GSI1SK: USER#<loginID>

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const pathParams = event.pathParameters || {};

  try {
    switch (method) {
      case 'GET': return await listUsers(event);
      case 'POST': return await createUser(event);
      case 'PUT': return await updateUser(pathParams.id, event);
      case 'DELETE': return await deleteUser(pathParams.id, event);
      default: return badRequest('Method not supported');
    }
  } catch (err) {
    return serverError(err);
  }
};

async function listUsers(event) {
  if (!requireAdmin(event)) return forbidden();
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :gsi1pk',
    ExpressionAttributeValues: { ':gsi1pk': 'USER' },
  }));
  const users = (result.Items || []).map(u => ({ ...u, passwordHash: undefined }));
  return ok(users);
}

async function createUser(event) {
  if (!requireAdmin(event)) return forbidden();
  const body = JSON.parse(event.body || '{}');
  const { loginID, password, role = 'USER', displayName } = body;
  if (!loginID || !password) return badRequest('loginID and password are required');

  const passwordHash = await bcrypt.hash(password, 12);
  const timestamp = now();
  const item = {
    PK: `USER#${loginID}`,
    SK: 'PROFILE',
    GSI1PK: 'USER',
    GSI1SK: `USER#${loginID}`,
    loginID,
    passwordHash,
    role,
    displayName: displayName || loginID,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item, ConditionExpression: 'attribute_not_exists(PK)' }));
  return created({ ...item, passwordHash: undefined });
}

async function updateUser(loginID, event) {
  const caller = getCallerContext(event);
  const isAdmin = caller.role === 'ADMIN';
  const isSelf = caller.loginID === loginID;
  if (!isAdmin && !isSelf) return forbidden();

  const body = JSON.parse(event.body || '{}');
  const updates = ['updatedAt = :updatedAt'];
  const exprValues = { ':updatedAt': now() };
  const exprNames = {};

  if (body.displayName !== undefined) { updates.push('displayName = :displayName'); exprValues[':displayName'] = body.displayName; }
  if (isAdmin && body.role !== undefined) { updates.push('#role = :role'); exprNames['#role'] = 'role'; exprValues[':role'] = body.role; }
  if (isAdmin && body.active !== undefined) { updates.push('active = :active'); exprValues[':active'] = body.active; }
  if (body.password) {
    const passwordHash = await bcrypt.hash(body.password, 12);
    updates.push('passwordHash = :passwordHash');
    exprValues[':passwordHash'] = passwordHash;
  }

  const result = await ddb.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${loginID}`, SK: 'PROFILE' },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeValues: exprValues,
    ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
    ConditionExpression: 'attribute_exists(PK)',
    ReturnValues: 'ALL_NEW',
  }));
  return ok({ ...result.Attributes, passwordHash: undefined });
}

async function deleteUser(loginID, event) {
  if (!requireAdmin(event)) return forbidden();
  const caller = getCallerContext(event);
  if (caller.loginID === loginID) return badRequest('Cannot delete your own account');

  await ddb.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${loginID}`, SK: 'PROFILE' },
    ConditionExpression: 'attribute_exists(PK)',
  }));
  return noContent();
}
