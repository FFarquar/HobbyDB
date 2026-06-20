import crypto from 'node:crypto';

const AUTH_SECRET = (process.env.AUTH_SECRET || '').trim();

if (!AUTH_SECRET) {
  console.error('CRITICAL: AUTH_SECRET missing from environment');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function verifyToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerPart, payloadPart, signaturePart] = parts;
  const signingInput = `${headerPart}.${payloadPart}`;

  const expectedSig = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(signingInput)
    .digest('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (expectedSig !== signaturePart) return null;

  const payload = JSON.parse(base64UrlDecode(payloadPart));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;

  return payload;
}

function generatePolicy(principalId, role, effect, resource) {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: effect, Resource: resource }],
    },
    context: { loginID: principalId, role },
  };
}

export const handler = async (event) => {
  try {
    const raw = event.authorizationToken || '';
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    const payload = verifyToken(token);

    if (!payload) {
      return generatePolicy('unknown', 'UNKNOWN', 'Deny', event.methodArn || '*');
    }

    const arnBase = event.methodArn.split('/').slice(0, 2).join('/');
    return generatePolicy(payload.loginID, payload.role || 'USER', 'Allow', `${arnBase}/*/*`);
  } catch (err) {
    console.error(err);
    return generatePolicy('unknown', 'UNKNOWN', 'Deny', '*');
  }
};
