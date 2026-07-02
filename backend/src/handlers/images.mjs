import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, serverError, cors } from './_shared.mjs';

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BUCKET = process.env.BUCKET_NAME;
const TABLE  = process.env.TABLE_NAME;

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path   = event.rawPath || event.path || '';

  try {
    if (method === 'GET')                           return await listImages(event);
    if (method === 'POST' && path.endsWith('/upload-url')) return await getUploadUrl(event);
    if (method === 'POST' && path.endsWith('/register'))   return await registerImage(event);
    if (method === 'DELETE')                        return await deleteImage(event);
    return badRequest('Method not supported');
  } catch (err) {
    return serverError(err);
  }
};

async function listImages(event) {
  const qs = event.queryStringParameters || {};
  const { entityId } = qs;
  if (!entityId) return badRequest('entityId is required');

  const result = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: { ':pk': `ENTITY#${entityId}`, ':sk': 'IMAGE#' },
  }));

  const images = await Promise.all((result.Items || []).map(async item => {
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: item.key }), { expiresIn: 3600 });
    return { key: item.key, filename: item.filename, uploadedAt: item.uploadedAt, url };
  }));

  return ok(images.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)));
}

async function getUploadUrl(event) {
  const body = JSON.parse(event.body || '{}');
  const { filename, contentType, entityId, entityLabel } = body;
  if (!filename || !contentType) return badRequest('filename and contentType are required');

  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const slug = (entityLabel || '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const folder = slug ? `${slug}-${entityId || 'general'}` : (entityId || 'general');
  const key  = `collections/${folder}/${Date.now()}-${safe}`;
  const cmd  = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });

  return ok({ uploadUrl, key });
}

async function registerImage(event) {
  const body = JSON.parse(event.body || '{}');
  const { entityId, key, filename, contentType } = body;
  if (!entityId || !key) return badRequest('entityId and key are required');

  const item = {
    PK: `ENTITY#${entityId}`,
    SK: `IMAGE#${key}`,
    key, filename, contentType,
    uploadedAt: new Date().toISOString(),
  };
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return ok(item);
}

async function deleteImage(event) {
  const qs = event.queryStringParameters || {};
  const { key, entityId } = qs;
  if (!key) return badRequest('key is required');

  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));

  if (entityId) {
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `ENTITY#${entityId}`, SK: `IMAGE#${key}` },
    }));
  }

  return { statusCode: 204, headers: cors, body: '' };
}
