import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { loadDb } from './store.ts';
import type { UserRecord } from './types.ts';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export interface SessionPayload {
  uid: string;
  role: 'user' | 'admin';
  exp: number;
}

export function signSessionToken(user: Pick<UserRecord, 'id' | 'role'>): string {
  const payload: SessionPayload = {
    uid: user.id,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded.uid || typeof decoded.exp !== 'number' || decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: UserRecord;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

export function setSessionCookie(res: Response, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `pf_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=604800`
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    'pf_session=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0'
  );
}

export function extractBearerToken(req: Request): { token: string | null; viaCookie: boolean } {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return { token: header.slice(7).trim(), viaCookie: false };
  }
  const qToken = typeof req.query.token === 'string' ? req.query.token : null;
  if (qToken) {
    return { token: qToken, viaCookie: false };
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.pf_session) {
    return { token: cookies.pf_session, viaCookie: true };
  }
  return { token: null, viaCookie: false };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const { token, viaCookie } = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Faça login para acessar esta área.' });
    return;
  }
  if (viaCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const customHeader = req.headers['x-requested-with'];
    const origin = req.headers.origin;
    const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
    const originMatchesHost = origin && host ? origin.includes(host) : false;
    if (customHeader !== 'PromptFace' && !originMatchesHost) {
      res.status(403).json({ error: 'Requisição não autorizada.' });
      return;
    }
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão expirada ou inválida. Entre novamente.' });
    return;
  }
  const db = loadDb();
  const user = db.users.find((u) => u.id === payload.uid);
  if (!user) {
    res.status(401).json({ error: 'Conta não encontrada.' });
    return;
  }
  req.authUser = user;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.authUser?.role !== 'admin') {
      res.status(403).json({ error: 'Acesso restrito a administradores.' });
      return;
    }
    next();
  });
}

export function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    credits: user.credits,
    planId: user.planId,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd,
    preferredModel: user.preferredModel || 'auto',
    createdAt: user.createdAt,
  };
}
