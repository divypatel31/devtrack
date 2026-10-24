import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';

// Track consumed or active OAuth state nonces to prevent replay attacks within the TTL window
const activeOAuthNonces = new Map<string, number>();

function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, exp] of activeOAuthNonces.entries()) {
    if (now > exp) {
      activeOAuthNonces.delete(nonce);
    }
  }
}

function getEncryptionKey(): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'utf8'),
      Buffer.from('devtrack-token-salt-v2', 'utf8'),
      Buffer.from('devtrack-aes-256-gcm-token-v1', 'utf8'),
      32
    )
  );
}

function getStateHmacKey(): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(env.JWT_SECRET, 'utf8'),
      Buffer.from('devtrack-state-salt-v2', 'utf8'),
      Buffer.from('devtrack-oauth-state-hmac-v1', 'utf8'),
      32
    )
  );
}

/**
 * Encrypts sensitive provider tokens (access/refresh) at rest using AES-256-GCM.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Cannot encrypt empty secret.');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts AES-256-GCM encrypted provider tokens on the server.
 */
export function decryptSecret(ciphertext: string): string {
  const parts = typeof ciphertext === 'string' ? ciphertext.split(':') : [];
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format.');
  }
  const [ivHex, tagHex, dataHex] = parts;
  if (ivHex.length !== 24 || tagHex.length !== 32 || dataHex.length === 0) {
    throw new Error('Malformed encrypted token components.');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export interface OAuthStatePayload {
  userId: string;
  provider: 'STRAVA' | 'GITHUB';
  nonce: string;
  exp: number;
}

/**
 * Generates an HMAC-SHA256 signed OAuth state parameter bound to the authenticated userId
 * and registers its one-time nonce to prevent replay attacks.
 */
export function createOAuthState(
  userId: string,
  provider: 'STRAVA' | 'GITHUB',
  ttlMs = 10 * 60 * 1000
): string {
  cleanupExpiredNonces();
  const exp = Date.now() + ttlMs;
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload: OAuthStatePayload = {
    userId,
    provider,
    nonce,
    exp,
  };
  activeOAuthNonces.set(nonce, exp);

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getStateHmacKey())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

/**
 * Verifies an OAuth state parameter, ensures it matches the expected userId and provider,
 * and atomically consumes the one-time nonce so replayed state tokens are rejected.
 */
export function verifyOAuthState(
  stateToken: string,
  expectedUserId: string,
  expectedProvider: 'STRAVA' | 'GITHUB'
): OAuthStatePayload {
  cleanupExpiredNonces();
  if (typeof stateToken !== 'string' || !stateToken.includes('.')) {
    throw new Error('Invalid OAuth state format.');
  }
  const parts = stateToken.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid OAuth state structure.');
  }
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getStateHmacKey())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('OAuth state signature verification failed.');
  }

  let parsed: OAuthStatePayload;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthStatePayload;
  } catch {
    throw new Error('Malformed OAuth state payload.');
  }

  if (!parsed || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
    throw new Error('OAuth state has expired.');
  }
  if (parsed.userId !== expectedUserId || parsed.provider !== expectedProvider) {
    throw new Error('OAuth state user or provider mismatch.');
  }

  // One-time replay prevention: nonce must exist in activeOAuthNonces and is deleted immediately on first use
  if (!parsed.nonce || !activeOAuthNonces.has(parsed.nonce)) {
    throw new Error('OAuth state nonce has already been used or is invalid (replay blocked).');
  }
  activeOAuthNonces.delete(parsed.nonce);

  return parsed;
}