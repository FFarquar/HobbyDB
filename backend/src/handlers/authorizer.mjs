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

// HTTP API v2 simple response format — context lands at
// event.requestContext.authorizer.lambda.* in downstream handlers
export const handler = async (event) => {
  try {
    const raw = event.headers?.authorization || event.headers?.Authorization || '';
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    const payload = verifyToken(token);

    if (!payload) {
      return { isAuthorized: false };
    }

    return {
      isAuthorized: true,
      context: {
        loginID: payload.loginID,
        role: payload.role || 'USER',
      },
    };
  } catch (err) {
    console.error(err);
    return { isAuthorized: false };
  }
};
