import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { ok, badRequest, serverError, cors } from './_shared.mjs';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const pathParams = event.pathParameters || {};

  try {
    if (method === 'POST') return await getUploadUrl(event);
    if (method === 'DELETE') return await deleteImage(pathParams.key);
    return badRequest('Method not supported');
  } catch (err) {
    return serverError(err);
  }
};

async function getUploadUrl(event) {
  const body = JSON.parse(event.body || '{}');
  const { filename, contentType } = body;
  if (!filename || !contentType) return badRequest('filename and contentType are required');

  const key = `items/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const command = new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return ok({ uploadUrl, key });
}

async function deleteImage(key) {
  if (!key) return badRequest('key is required');
  const decodedKey = decodeURIComponent(key);
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: decodedKey }));
  return { statusCode: 204, headers: cors, body: '' };
}
