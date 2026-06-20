import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const TABLE_NAME = process.env.TABLE_NAME;

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export const ok = (data) => ({ statusCode: 200, headers: cors, body: JSON.stringify(data) });
export const created = (data) => ({ statusCode: 201, headers: cors, body: JSON.stringify(data) });
export const noContent = () => ({ statusCode: 204, headers: cors, body: '' });
export const badRequest = (msg) => ({ statusCode: 400, headers: cors, body: JSON.stringify({ message: msg }) });
export const notFound = (msg = 'Not found') => ({ statusCode: 404, headers: cors, body: JSON.stringify({ message: msg }) });
export const forbidden = () => ({ statusCode: 403, headers: cors, body: JSON.stringify({ message: 'Forbidden' }) });
export const serverError = (err) => {
  console.error(err);
  return { statusCode: 500, headers: cors, body: JSON.stringify({ message: 'Internal server error' }) };
};

export const newId = () => randomUUID();
export const now = () => new Date().toISOString();

export function getCallerContext(event) {
  return {
    loginID: event.requestContext?.authorizer?.lambda?.loginID || event.requestContext?.authorizer?.loginID || 'unknown',
    role: event.requestContext?.authorizer?.lambda?.role || event.requestContext?.authorizer?.role || 'USER',
  };
}

export function requireAdmin(event) {
  const { role } = getCallerContext(event);
  return role === 'ADMIN';
}
