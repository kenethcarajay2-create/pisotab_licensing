import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb);
export function token() { return randomBytes(32).toString('base64url'); }
export function digest(secret, value) { return createHmac('sha256', secret).update(value).digest('hex'); }
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  try {
    const [algorithm, cost, salt, hex] = stored.split('$');
    if (algorithm !== 'scrypt' || cost !== '32768' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
    const attempt = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(Buffer.from(hex, 'hex'), attempt);
  } catch { return false; }
}
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newLicenseKey() {
  const data = randomBytes(24);
  const chars = [...data].map(v => alphabet[v % alphabet.length]).join('');
  return `PT-${chars.slice(0,6)}-${chars.slice(6,12)}-${chars.slice(12,18)}-${chars.slice(18,24)}`;
}
export function licenseMask(key) { return `PT-••••••-••••••-${key.slice(-6)}`; }
export function serializeLicense(item) {
  const expired = item.expiresAt && new Date(item.expiresAt).getTime() < Date.now();
  return { id: item._id.toString(), label: item.label, customer: item.customer, plan: item.plan,
    status: item.status === 'revoked' ? 'revoked' : expired ? 'expired' : item.status,
    keyHint: item.keyHint, maxDevices: item.maxDevices, activationCount: item.activationCount ?? 0,
    createdAt: item.createdAt, expiresAt: item.expiresAt, revokedAt: item.revokedAt ?? null,
    notes: item.notes ?? '', deviceBinding: 'Not yet enabled' };
}
