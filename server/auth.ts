import type { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from './supabase.ts';
import { loadDb } from './store.ts';
import type { UserRecord } from './types.ts';

// ---------------------------------------------------------------------------
// Autenticação — Supabase Auth (substitui senha scrypt + sessão HMAC)
// ---------------------------------------------------------------------------
// - A senha vive SOMENTE no Supabase Auth; este servidor nunca a armazena.
// - O token que o frontend envia (Bearer ou cookie pf_session) é o
//   access_token (JWT) do Supabase. Ele dura 1h; o refresh_token fica no
//   cookie pf_refresh (httpOnly) e renova a sessão automaticamente.
// - Login com Google NÃO está ativado (botão continua desativado no frontend).
// - As senhas scrypt antigas NÃO migraram: contas do JSON antigo precisam
//   criar conta nova ou usar "Esqueci a senha" após o claim-admin.
// ---------------------------------------------------------------------------

export interface AuthenticatedRequest extends Request {
  authUser?: UserRecord;
  /** Access token válido do Supabase para esta requisição (renovado, se preciso). */
  authToken?: string;
}

export interface AuthSessionTokens {
  accessToken: string;
  refreshToken: string;
  authUserId: string;
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

export function setSessionCookie(res: Response, token: string, refreshToken?: string): void {
  const cookies = [
    `pf_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=3600`,
  ];
  if (refreshToken) {
    cookies.push(
      `pf_refresh=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=2592000`
    );
  }
  res.setHeader('Set-Cookie', cookies);
}

export function clearSessionCookie(res: Response): void {
  res.setHeader('Set-Cookie', [
    'pf_session=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0',
    'pf_refresh=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0',
  ]);
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

/** Valida um access_token do Supabase e devolve o perfil interno do usuário. */
export async function getSessionFromToken(
  token: string
): Promise<{ user: UserRecord; accessToken: string } | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    const db = loadDb();
    const user = db.users.find((u) => u.authUserId === data.user.id);
    if (!user) return null;
    return { user, accessToken: token };
  } catch (err) {
    console.error('[auth] Falha ao validar sessão:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Tenta renovar a sessão com o refresh_token do cookie pf_refresh. */
async function refreshSessionFromCookie(req: Request): Promise<AuthSessionTokens | null> {
  const cookies = parseCookies(req.headers.cookie);
  const refreshToken = cookies.pf_refresh;
  if (!refreshToken) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session || !data.user) return null;
    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      authUserId: data.user.id,
    };
  } catch {
    return null;
  }
}

export interface ResolvedSession {
  user: UserRecord;
  accessToken: string;
  refreshedTokens?: AuthSessionTokens;
}

/**
 * Resolve a sessão da requisição: valida o token enviado e, se ele expirou,
 * tenta renovar com o refresh_token do cookie. Quando renova, grava os
 * cookies novos na resposta (se `res` for passado).
 */
export async function resolveSession(
  req: Request,
  res?: Response
): Promise<ResolvedSession | null> {
  const { token } = extractBearerToken(req);
  if (!token) return null;
  const session = await getSessionFromToken(token);
  if (session) return { user: session.user, accessToken: token };
  const refreshed = await refreshSessionFromCookie(req);
  if (!refreshed) return null;
  const renewed = await getSessionFromToken(refreshed.accessToken);
  if (!renewed) return null;
  if (res) setSessionCookie(res, refreshed.accessToken, refreshed.refreshToken);
  return { user: renewed.user, accessToken: refreshed.accessToken, refreshedTokens: refreshed };
}

/** Validação leve para as rotas de mídia (/media/faces, /media/generated). */
export async function validateAccessToken(
  token: string
): Promise<{ uid: string; role: 'user' | 'admin' } | null> {
  const session = await getSessionFromToken(token);
  if (!session) return null;
  return { uid: session.user.id, role: session.user.role };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
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
    const session = await resolveSession(req, res);
    if (!session) {
      res.status(401).json({ error: 'Sessão expirada ou inválida. Entre novamente.' });
      return;
    }
    req.authUser = session.user;
    req.authToken = session.accessToken;
    next();
  } catch (err) {
    console.error('[auth] Erro no requireAuth:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Falha ao validar a sessão. Tente novamente.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  void requireAuth(req, res, () => {
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

// ------------------------- operações no Supabase Auth ----------------------

export interface AuthOperationResult {
  ok: boolean;
  authUserId?: string;
  status: number;
  error?: string;
}

function supabaseErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Supabase indisponível.';
}

/** Cria o usuário no Supabase Auth (já confirmado — a confirmação de e-mail é a do app, com código de 6 dígitos). */
export async function createAuthUser(
  email: string,
  password: string,
  name: string
): Promise<AuthOperationResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error || !data.user) {
      const message = error?.message ?? 'Não foi possível criar a conta.';
      const alreadyExists = /already registered|already exists/i.test(message);
      return {
        ok: false,
        status: alreadyExists ? 409 : 400,
        error: alreadyExists ? 'Já existe uma conta com este e-mail.' : message,
      };
    }
    return { ok: true, authUserId: data.user.id, status: 201 };
  } catch (err) {
    return { ok: false, status: 503, error: supabaseErrorMessage(err) };
  }
}

/** Login com e-mail + senha no Supabase Auth. */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<
  | { ok: true; session: AuthSessionTokens }
  | { ok: false; error: string }
> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return { ok: false, error: 'E-mail ou senha incorretos.' };
    }
    return {
      ok: true,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        authUserId: data.user.id,
      },
    };
  } catch (err) {
    return { ok: false, error: supabaseErrorMessage(err) };
  }
}

/** Troca a senha de um usuário do Supabase Auth (fluxo "esqueci a senha" do app). */
export async function updateAuthUserPassword(
  authUserId: string,
  newPassword: string
): Promise<AuthOperationResult> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.auth.admin.updateUserById(authUserId, {
      password: newPassword,
    });
    if (error) return { ok: false, status: 400, error: error.message };
    return { ok: true, authUserId, status: 200 };
  } catch (err) {
    return { ok: false, status: 503, error: supabaseErrorMessage(err) };
  }
}

/**
 * Cria uma sessão para um usuário que já existe no Supabase Auth, sem precisar
 * da senha (usado após a confirmação do código de e-mail, quando o frontend
 * espera receber o token). Usa link mágico gerado pela Admin API — nenhum
 * e-mail é enviado neste passo.
 */
export async function createSessionForUser(
  email: string
): Promise<{ ok: true; session: AuthSessionTokens } | { ok: false; error: string }> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      return { ok: false, error: 'Não foi possível iniciar a sessão. Entre com sua senha.' };
    }
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: 'magiclink',
    });
    if (error || !data.session || !data.user) {
      return { ok: false, error: 'Não foi possível iniciar a sessão. Entre com sua senha.' };
    }
    return {
      ok: true,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        authUserId: data.user.id,
      },
    };
  } catch (err) {
    return { ok: false, error: supabaseErrorMessage(err) };
  }
}

/** Invalida a sessão no Supabase Auth (best-effort — o logout local sempre acontece). */
export async function signOutSession(token: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.auth.admin.signOut(token);
  } catch {
    // Ignora: o cookie local já foi limpo.
  }
}
