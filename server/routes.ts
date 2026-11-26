import crypto from 'node:crypto';
import fs from 'node:fs';
import express from 'express';
import Stripe from 'stripe';
import type { Express, Request, Response } from 'express';
import {
  CREDIT_COSTS,
  INITIAL_SIGNUP_CREDITS,
  buildGenerationPrompt,
  moderatePrompt,
  refundCredits,
  reserveCredits,
} from '../src/shared/rules.ts';
import {
  validateNewFolderName,
  validateRenameFolder,
} from '../src/shared/photoFolders.ts';
import {
  MAX_TAGS_PER_PHOTO,
  normalizeTagList,
  normalizeTagName,
} from '../src/shared/photoTags.ts';
import { normalizePreferredAiModel } from '../src/shared/aiModels.ts';
import {
  buildAdminDailyStats,
  normalizeMaintenanceConfig,
} from '../src/shared/adminStats.ts';
import {
  canConsumeFalImage,
  getFalQuotaSummary,
  normalizeFalQuotaState,
  recordFalImageSuccess,
} from '../src/shared/providerQuota.ts';
import {
  clearSessionCookie,
  hashPassword,
  requireAdmin,
  requireAuth,
  sanitizeUser,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
  extractBearerToken,
  type AuthenticatedRequest,
} from './auth.ts';
import {
  GENERATED_DIR,
  UPLOADS_DIR,
  deleteImageFile,
  loadDb,
  readImageAsBase64,
  resolveSafeFile,
  saveDb,
  saveImageFile,
} from './store.ts';
import {
  editStudioImageWithProvider,
  enhancePromptWithAi,
  generatePortraitWithProvider,
  isFalConfigured,
  isImageProviderConfigured,
  verifyUploadedFace,
  type FalRequestGate,
} from './providers/imageProvider.ts';

let falInFlightCount = 0;

function createFalRequestGate(): FalRequestGate {
  let acquired = false;
  let committed = false;
  return {
    tryAcquire: () => {
      const db = loadDb();
      const quota = normalizeFalQuotaState(db.falQuota);
      if (!canConsumeFalImage(quota, falInFlightCount)) {
        return false;
      }
      falInFlightCount += 1;
      acquired = true;
      return true;
    },
    commit: async () => {
      if (committed) return;
      committed = true;
      const db = loadDb();
      db.falQuota = recordFalImageSuccess(normalizeFalQuotaState(db.falQuota));
      await saveDb(db);
    },
    release: () => {
      if (acquired) {
        acquired = false;
        falInFlightCount = Math.max(0, falInFlightCount - 1);
      }
    },
  };
}

function currentFalQuotaSummary(db: ReturnType<typeof loadDb>) {
  return getFalQuotaSummary(normalizeFalQuotaState(db.falQuota), {
    active: isFalConfigured(),
    inFlight: falInFlightCount,
  });
}

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_PRICE_PRO?.trim() &&
      process.env.STRIPE_PRICE_PREMIUM?.trim()
  );
}

async function sendTransactionalEmail(to: string, subject: string, html: string): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PromptFace <noreply@promptface.com.br>',
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function rejectIfMaintenance(
  db: ReturnType<typeof loadDb>,
  userRole: string | undefined,
  res: Response
): boolean {
  const maintenance = normalizeMaintenanceConfig(db.maintenance);
  if (maintenance.enabled && userRole !== 'admin') {
    res.status(503).json({
      maintenance: true,
      error: maintenance.message,
      title: maintenance.title,
    });
    return true;
  }
  return false;
}

export function registerApiRoutes(app: Express): void {
  // Stripe Webhook MUST receive raw body before express.json()
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const stripe = getStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
      if (!stripe || !webhookSecret) {
        res.status(503).json({ error: 'Webhook indisponível.' });
        return;
      }

      const sig = req.headers['stripe-signature'];
      if (!sig || typeof sig !== 'string') {
        res.status(400).send('Assinatura ausente');
        return;
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Invalid'}`);
        return;
      }

      const db = loadDb();

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId as 'pro' | 'premium' | undefined;
        const user = db.users.find((u) => u.id === userId);
        const plan = db.plans.find((p) => p.id === planId);

        if (user && plan) {
          user.planId = plan.id;
          user.subscriptionStatus = 'active';
          user.stripeCustomerId = typeof session.customer === 'string' ? session.customer : undefined;
          user.stripeSubscriptionId =
            typeof session.subscription === 'string' ? session.subscription : undefined;
          user.credits = plan.creditsMonthly;

          db.creditLedger.unshift({
            id: crypto.randomUUID(),
            userId: user.id,
            type: 'subscription_grant',
            operation: `plan_${plan.id}`,
            amount: plan.creditsMonthly,
            balanceAfter: user.credits,
            description: `Ativação do plano ${plan.name} (${plan.creditsMonthly} créditos mensais)`,
            createdAt: new Date().toISOString(),
          });

          db.payments.unshift({
            id: crypto.randomUUID(),
            userId: user.id,
            planId: plan.id,
            amountBrl: plan.priceBrl,
            status: 'paid',
            stripeSessionId: session.id,
            method: session.payment_method_types?.[0] ?? 'card',
            createdAt: new Date().toISOString(),
          });

          await saveDb(db);
        }
      } else if (event.type === 'invoice.paid') {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : undefined;
        const user = db.users.find((u) => u.stripeCustomerId === customerId);
        if (user && user.planId !== 'free_trial') {
          const plan = db.plans.find((p) => p.id === user.planId);
          if (plan) {
            user.subscriptionStatus = 'active';
            // Monthly credits reset cleanly (unused credits do not roll over)
            user.credits = plan.creditsMonthly;
            db.creditLedger.unshift({
              id: crypto.randomUUID(),
              userId: user.id,
              type: 'subscription_grant',
              operation: `renewal_${plan.id}`,
              amount: plan.creditsMonthly,
              balanceAfter: user.credits,
              description: `Renovação mensal do plano ${plan.name}`,
              createdAt: new Date().toISOString(),
            });
            await saveDb(db);
          }
        }
      } else if (event.type === 'customer.subscription.deleted') {
        const sub = event.data.object as Stripe.Subscription;
        const user = db.users.find((u) => u.stripeSubscriptionId === sub.id);
        if (user) {
          user.subscriptionStatus = 'canceled';
          await saveDb(db);
        }
      }

      res.json({ received: true });
    }
  );

  app.use(express.json({ limit: '10mb' }));

  // Public health and non-secret feature capability flags
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/config/public', (_req, res) => {
    const db = loadDb();
    const hasAdmin = db.users.some((u) => u.role === 'admin');
    res.json({
      geminiConfigured: isImageProviderConfigured(),
      stripeConfigured: isStripeConfigured(),
      googleSignInConfigured: false,
      needsAdminClaim: !hasAdmin && !process.env.ADMIN_PASSWORD?.trim(),
      resendConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
      maintenance: normalizeMaintenanceConfig(db.maintenance),
      falQuota: currentFalQuotaSummary(db),
    });
  });

  // Public catalog & notices
  app.get('/api/catalog', (_req, res) => {
    const db = loadDb();
    res.json({
      categories: db.categories,
      scenarios: db.scenarios.filter((s) => s.active !== false),
      plans: db.plans,
    });
  });

  app.get('/api/notices', (_req, res) => {
    const db = loadDb();
    res.json({ notices: db.notices.filter((n) => n.active) });
  });

  app.post('/api/waitlist', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const feature =
      req.body?.feature === 'payments' || req.body?.feature === 'generation'
        ? req.body.feature
        : 'general';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Informe um e-mail válido.' });
      return;
    }
    const db = loadDb();
    if (!db.waitlist.some((w) => w.email === email && w.feature === feature)) {
      db.waitlist.push({
        id: crypto.randomUUID(),
        email,
        feature,
        createdAt: new Date().toISOString(),
      });
      await saveDb(db);
    }
    res.json({ ok: true, message: 'Você entrou na lista de espera prioritária.' });
  });

  // Auth routes
  app.post('/api/auth/register', async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || name.length > 80) {
      res.status(400).json({ error: 'Informe seu nome completo.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Informe um e-mail válido.' });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    const db = loadDb();
    if (db.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
      return;
    }

    const verificationCode = String(crypto.randomInt(100000, 999999));
    const userId = crypto.randomUUID();

    const newUser = {
      id: userId,
      name,
      email,
      passwordHash: hashPassword(password),
      role: 'user' as const,
      emailVerified: false,
      verificationCode,
      credits: INITIAL_SIGNUP_CREDITS,
      planId: 'free_trial' as const,
      subscriptionStatus: 'inactive' as const,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    db.creditLedger.unshift({
      id: crypto.randomUUID(),
      userId,
      type: 'signup_bonus',
      operation: 'signup',
      amount: INITIAL_SIGNUP_CREDITS,
      balanceAfter: INITIAL_SIGNUP_CREDITS,
      description: 'Bônus de boas-vindas (10 créditos = 1 foto grátis)',
      createdAt: new Date().toISOString(),
    });
    await saveDb(db);

    const sent = await sendTransactionalEmail(
      email,
      'Confirme seu cadastro no PromptFace',
      `<p>Olá, ${name}!</p><p>Seu código de confirmação no PromptFace é: <strong>${verificationCode}</strong></p>`
    );

    res.status(201).json({
      requiresVerification: true,
      email,
      emailSent: sent,
      // Only shown when transactional email service is not configured so flow stays testable
      verificationHint: sent ? undefined : verificationCode,
    });
  });

  app.post('/api/auth/verify-email', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

    const db = loadDb();
    const user = db.users.find((u) => u.email === email);
    if (!user || !user.verificationCode || user.verificationCode !== code) {
      res.status(400).json({ error: 'Código de confirmação inválido.' });
      return;
    }

    user.emailVerified = true;
    user.verificationCode = undefined;
    await saveDb(db);

    const token = signSessionToken(user);
    setSessionCookie(res, token);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const db = loadDb();
    const user = db.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    if (!user.emailVerified) {
      const code = user.verificationCode || String(crypto.randomInt(100000, 999999));
      user.verificationCode = code;
      await saveDb(db);
      const sent = await sendTransactionalEmail(
        user.email,
        'Confirme seu e-mail no PromptFace',
        `<p>Seu código de confirmação é: <strong>${code}</strong></p>`
      );
      res.status(403).json({
        requiresVerification: true,
        email: user.email,
        error: 'Confirme seu e-mail antes de entrar.',
        verificationHint: sent ? undefined : code,
      });
      return;
    }

    const token = signSessionToken(user);
    setSessionCookie(res, token);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const db = loadDb();
    const user = db.users.find((u) => u.email === email);
    if (!user) {
      res.json({ ok: true, message: 'Se o e-mail existir, enviamos instruções de recuperação.' });
      return;
    }

    const resetCode = String(crypto.randomInt(100000, 999999));
    user.resetCode = resetCode;
    user.resetExpiresAt = Date.now() + 30 * 60 * 1000;
    await saveDb(db);

    const sent = await sendTransactionalEmail(
      user.email,
      'Recuperação de senha — PromptFace',
      `<p>Seu código para redefinir a senha no PromptFace é: <strong>${resetCode}</strong></p>`
    );

    res.json({
      ok: true,
      message: 'Código de recuperação gerado.',
      resetHint: sent ? undefined : resetCode,
    });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    const db = loadDb();
    const user = db.users.find((u) => u.email === email);
    if (
      !user ||
      !user.resetCode ||
      user.resetCode !== code ||
      !user.resetExpiresAt ||
      user.resetExpiresAt < Date.now()
    ) {
      res.status(400).json({ error: 'Código inválido ou expirado.' });
      return;
    }

    user.passwordHash = hashPassword(newPassword);
    user.resetCode = undefined;
    user.resetExpiresAt = undefined;
    user.emailVerified = true;
    await saveDb(db);

    const token = signSessionToken(user);
    setSessionCookie(res, token);
    res.json({ ok: true, token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/claim-admin', async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : 'Administrador';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) {
      res.status(400).json({ error: 'Informe um e-mail válido e senha com no mínimo 6 caracteres.' });
      return;
    }

    const db = loadDb();
    const envAdminPass = process.env.ADMIN_PASSWORD?.trim();
    const hasAdmin = db.users.some((u) => u.role === 'admin');

    if (envAdminPass) {
      if (password !== envAdminPass) {
        res.status(403).json({ error: 'Credencial de administrador inválida.' });
        return;
      }
    } else if (hasAdmin) {
      res.status(403).json({ error: 'O administrador principal já foi configurado.' });
      return;
    }

    let adminUser = db.users.find((u) => u.email === email);
    if (adminUser) {
      adminUser.role = 'admin';
      adminUser.emailVerified = true;
      adminUser.passwordHash = hashPassword(password);
    } else {
      adminUser = {
        id: crypto.randomUUID(),
        name: name || 'Administrador',
        email,
        passwordHash: hashPassword(password),
        role: 'admin',
        emailVerified: true,
        credits: 600,
        planId: 'premium',
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString(),
      };
      db.users.push(adminUser);
    }

    await saveDb(db);
    const token = signSessionToken(adminUser);
    setSessionCookie(res, token);
    res.json({ token, user: sanitizeUser(adminUser) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/session', (req, res) => {
    const { token } = extractBearerToken(req);
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
      res.json({ authenticated: false, user: null });
      return;
    }
    const db = loadDb();
    const user = db.users.find((u) => u.id === payload.uid);
    if (!user) {
      res.json({ authenticated: false, user: null });
      return;
    }
    const freshToken = signSessionToken(user);
    res.json({ authenticated: true, user: sanitizeUser(user), token: freshToken });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const token = signSessionToken(req.authUser!);
    res.json({ user: sanitizeUser(req.authUser!), token });
  });

  // Protected private media routes (never public by default!)
  app.get('/media/faces/:filename', (req, res) => {
    const { token } = extractBearerToken(req);
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
      res.status(401).send('Não autorizado');
      return;
    }
    const db = loadDb();
    const face = db.faceReferences.find((f) => f.filename === req.params.filename);
    if (!face || (face.userId !== payload.uid && payload.role !== 'admin')) {
      res.status(403).send('Acesso negado');
      return;
    }
    const safePath = resolveSafeFile(UPLOADS_DIR, req.params.filename);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).send('Arquivo não encontrado');
      return;
    }
    res.type(face.mimeType).sendFile(safePath);
  });

  app.get('/media/generated/:filename', (req, res) => {
    const { token } = extractBearerToken(req);
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
      res.status(401).send('Não autorizado');
      return;
    }
    const db = loadDb();
    const gen = db.generations.find(
      (g) => g.filename === req.params.filename || g.versions.some((v) => v.filename === req.params.filename)
    );
    if (!gen || (gen.userId !== payload.uid && payload.role !== 'admin')) {
      res.status(403).send('Acesso negado');
      return;
    }
    const safePath = resolveSafeFile(GENERATED_DIR, req.params.filename);
    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).send('Arquivo não encontrado');
      return;
    }
    res.type(gen.mimeType).sendFile(safePath);
  });

  // Visual Profile & Face References
  app.get('/api/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const rawProfile = db.visualProfiles[userId] ?? null;
    const preferredModel = normalizePreferredAiModel(
      rawProfile?.preferredModel ?? req.authUser?.preferredModel
    );
    const profile = rawProfile
      ? { ...rawProfile, preferredModel }
      : { preferredModel };
    const faces = db.faceReferences
      .filter((f) => f.userId === userId)
      .map((f) => ({
        ...f,
        url: `/media/faces/${f.filename}`,
      }));

    res.json({ profile, preferredModel, faces });
  });

  app.put('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const user = db.users.find((u) => u.id === userId);
    const body = req.body ?? {};
    const clean = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 120) : '');
    const preferredModel = normalizePreferredAiModel(body.preferredModel);

    db.visualProfiles[userId] = {
      eyeColor: clean(body.eyeColor),
      hairColorStyle: clean(body.hairColorStyle),
      hairType: clean(body.hairType),
      beardMustache: clean(body.beardMustache),
      skinTone: clean(body.skinTone),
      facialFeatures: clean(body.facialFeatures),
      heightBodyType: clean(body.heightBodyType),
      otherCharacteristics: clean(body.otherCharacteristics),
      preferredModel,
      updatedAt: new Date().toISOString(),
    };
    if (user) {
      user.preferredModel = preferredModel;
    }
    await saveDb(db);
    res.json({
      profile: db.visualProfiles[userId],
      preferredModel,
      user: user ? sanitizeUser(user) : undefined,
    });
  });

  app.post('/api/faces', requireAuth, async (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const consentAccepted = req.body?.consentAccepted === true;
    const imageBase64 = typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64 : '';
    const mimeType =
      req.body?.mimeType === 'image/png' || req.body?.mimeType === 'image/webp'
        ? req.body.mimeType
        : 'image/jpeg';

    if (!consentAccepted) {
      res.status(400).json({
        error: 'O consentimento explícito é obrigatório antes do envio da foto facial (LGPD).',
      });
      return;
    }

    const cleanB64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    if (!cleanB64 || cleanB64.length < 100 || cleanB64.length > 8_500_000) {
      res.status(400).json({ error: 'Envie uma foto válida (máximo 6 MB).' });
      return;
    }

    const db = loadDb();
    if (rejectIfMaintenance(db, user.role, res)) return;
    const check = await verifyUploadedFace(cleanB64, mimeType);
    if (!check.valid) {
      db.moderationLogs.unshift({
        id: crypto.randomUUID(),
        userId: user.id,
        userEmail: user.email,
        inputSnippet: 'Upload de referência facial',
        reason: check.reason || 'Foto bloqueada na validação facial.',
        action: 'blocked_upload',
        createdAt: new Date().toISOString(),
      });
      await saveDb(db);
      res.status(400).json({ error: check.reason });
      return;
    }

    const { filename } = await saveImageFile(UPLOADS_DIR, cleanB64, mimeType);
    const record = {
      id: crypto.randomUUID(),
      userId: user.id,
      filename,
      mimeType,
      consentAccepted: true,
      consentTimestamp: new Date().toISOString(),
      faceVerified: check.checkedByAi,
      createdAt: new Date().toISOString(),
    };
    db.faceReferences.unshift(record);
    await saveDb(db);

    res.status(201).json({
      face: { ...record, url: `/media/faces/${record.filename}` },
    });
  });

  app.delete('/api/faces/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const idx = db.faceReferences.findIndex((f) => f.id === req.params.id && f.userId === userId);
    if (idx === -1) {
      res.status(404).json({ error: 'Referência facial não encontrada.' });
      return;
    }
    const [removed] = db.faceReferences.splice(idx, 1);
    await deleteImageFile(UPLOADS_DIR, removed.filename);
    await saveDb(db);
    res.json({ ok: true });
  });

  // Enhance prompt (1 credit)
  app.post('/api/enhance-prompt', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    if (rejectIfMaintenance(db, user.role, res)) return;
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';

    const mod = moderatePrompt(description);
    if (!mod.allowed) {
      db.moderationLogs.unshift({
        id: crypto.randomUUID(),
        userId: user.id,
        userEmail: user.email,
        inputSnippet: description.slice(0, 140),
        reason: mod.reason || 'Prompt bloqueado',
        action: 'blocked_prompt',
        createdAt: new Date().toISOString(),
      });
      await saveDb(db);
      res.status(400).json({ error: mod.reason });
      return;
    }

    const reservation = reserveCredits(user.credits, 'enhance_prompt');
    if (!reservation.ok) {
      res.status(402).json({ error: reservation.error, credits: user.credits });
      return;
    }

    user.credits = reservation.newBalance;
    db.creditLedger.unshift({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'reserve',
      operation: 'enhance_prompt',
      amount: -reservation.reservedAmount,
      balanceAfter: user.credits,
      description: 'Reserva para melhorar descrição',
      createdAt: new Date().toISOString(),
    });
    await saveDb(db);

    const result = await enhancePromptWithAi(description);
    if (!result.ok || !result.enhancedPrompt) {
      user.credits = refundCredits(user.credits, reservation.reservedAmount);
      db.creditLedger.unshift({
        id: crypto.randomUUID(),
        userId: user.id,
        type: 'refund',
        operation: 'enhance_prompt',
        amount: reservation.reservedAmount,
        balanceAfter: user.credits,
        description: 'Estorno automático: melhoria de descrição indisponível',
        createdAt: new Date().toISOString(),
      });
      await saveDb(db);

      if (result.notConfigured) {
        res.status(503).json({
          notConfigured: true,
          error: 'Melhoria automática em breve — estamos ativando os servidores de IA.',
          credits: user.credits,
        });
        return;
      }
      res.status(502).json({ error: result.error, credits: user.credits });
      return;
    }

    res.json({
      enhancedPrompt: result.enhancedPrompt,
      credits: user.credits,
    });
  });

  // Image Generation (10 credits)
  app.post('/api/generate', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    if (rejectIfMaintenance(db, user.role, res)) return;

    const userFaces = db.faceReferences.filter((f) => f.userId === user.id);
    if (userFaces.length === 0) {
      res.status(400).json({
        needsFaceReference: true,
        error: 'Você ainda não enviou seu rosto. Envie uma foto no Perfil Visual antes de gerar.',
      });
      return;
    }

    const mode = req.body?.mode === 'free' ? 'free' : req.body?.isVariation ? 'variation' : 'preset';
    const scenarioId = typeof req.body?.scenarioId === 'string' ? req.body.scenarioId : undefined;
    const scenario = scenarioId ? db.scenarios.find((s) => s.id === scenarioId) : undefined;

    const rawDescription =
      typeof req.body?.description === 'string' && req.body.description.trim()
        ? req.body.description.trim()
        : scenario?.description || '';

    const combinedCheckText = [
      rawDescription,
      req.body?.outfit,
      req.body?.environment,
      req.body?.pose,
    ]
      .filter(Boolean)
      .join(' ');

    const mod = moderatePrompt(combinedCheckText);
    if (!mod.allowed) {
      db.moderationLogs.unshift({
        id: crypto.randomUUID(),
        userId: user.id,
        userEmail: user.email,
        inputSnippet: combinedCheckText.slice(0, 140),
        reason: mod.reason || 'Conteúdo não permitido.',
        action: 'blocked_prompt',
        createdAt: new Date().toISOString(),
      });
      await saveDb(db);
      res.status(400).json({ error: mod.reason });
      return;
    }

    const op = mode === 'variation' ? 'variation' : 'generate';
    const reservation = reserveCredits(user.credits, op);
    if (!reservation.ok) {
      res.status(402).json({ error: reservation.error, credits: user.credits });
      return;
    }

    user.credits = reservation.newBalance;
    db.creditLedger.unshift({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'reserve',
      operation: op,
      amount: -reservation.reservedAmount,
      balanceAfter: user.credits,
      description: `Reserva para ${scenario?.title || 'Criação livre'}`,
      createdAt: new Date().toISOString(),
    });
    await saveDb(db);

    const aspectRatio =
      typeof req.body?.aspectRatio === 'string' ? req.body.aspectRatio : '3:4';

    const prompt = buildGenerationPrompt({
      mode: mode === 'free' ? 'free' : 'preset',
      scenarioTitle: scenario?.title,
      baseDescription: rawDescription,
      outfit: req.body?.outfit,
      environment: req.body?.environment,
      pose: req.body?.pose,
      lighting: req.body?.lighting,
      style: req.body?.style,
      aspectRatio,
      visualProfile: db.visualProfiles[user.id] ?? null,
    });

    const refParts = userFaces
      .slice(0, 3)
      .map((f) => {
        const b64 = readImageAsBase64(UPLOADS_DIR, f.filename);
        return b64 ? { base64: b64, mimeType: f.mimeType } : null;
      })
      .filter((x): x is { base64: string; mimeType: string } => Boolean(x));

    const preferredModel = normalizePreferredAiModel(
      req.body?.preferredModel ?? db.visualProfiles[user.id]?.preferredModel ?? user.preferredModel
    );

    const result = await generatePortraitWithProvider({
      referenceImages: refParts,
      prompt,
      aspectRatio,
      highQuality: Boolean(req.body?.highQuality),
      preferredModel,
      falGate: createFalRequestGate(),
    });

    if (!result.ok || !result.base64) {
      user.credits = refundCredits(user.credits, reservation.reservedAmount);
      db.creditLedger.unshift({
        id: crypto.randomUUID(),
        userId: user.id,
        type: 'refund',
        operation: op,
        amount: reservation.reservedAmount,
        balanceAfter: user.credits,
        description: `Estorno automático (${scenario?.title || 'Criação livre'})`,
        createdAt: new Date().toISOString(),
      });
      await saveDb(db);

      if (result.quotaExhausted) {
        res.status(429).json({
          quotaExhausted: true,
          error:
            result.error ||
            'Limite gratuito de 12 imagens na fal.ai atingido para evitar qualquer cobrança.',
          credits: user.credits,
          falQuota: currentFalQuotaSummary(db),
        });
        return;
      }

      if (result.notConfigured) {
        res.status(503).json({
          notConfigured: true,
          error: 'Geração em breve — estamos ativando nossa infraestrutura de imagem.',
          credits: user.credits,
        });
        return;
      }
      res.status(502).json({
        error: result.error || 'Não foi possível concluir sua foto agora. Seus créditos foram estornados.',
        credits: user.credits,
      });
      return;
    }

    const mimeType = result.mimeType || 'image/png';
    const { filename } = await saveImageFile(GENERATED_DIR, result.base64, mimeType);

    const generation = {
      id: crypto.randomUUID(),
      userId: user.id,
      mode: mode as 'preset' | 'free' | 'variation',
      scenarioId: scenario?.id,
      scenarioTitle: scenario?.title || 'Criação livre personalizada',
      categoryId: scenario?.categoryId || 'livre',
      categoryName: scenario?.categoryName || 'Criação Livre',
      promptUsed: prompt,
      aspectRatio,
      filename,
      mimeType,
      costCredits: CREDIT_COSTS[op],
      estimatedCostUsd: result.estimatedCostUsd,
      status: 'completed' as const,
      provider: result.provider,
      model: result.model,
      favorite: false,
      tags: [],
      synthIdMarked: result.provider === 'gemini',
      versions: [],
      createdAt: new Date().toISOString(),
    };

    db.generations.unshift(generation);
    db.creditLedger.unshift({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'confirm',
      operation: op,
      amount: 0,
      balanceAfter: user.credits,
      description: `Foto gerada: ${generation.scenarioTitle}`,
      createdAt: new Date().toISOString(),
    });
    await saveDb(db);

    res.status(201).json({
      generation: {
        ...generation,
        url: `/media/generated/${generation.filename}`,
      },
      credits: user.credits,
      falQuota: currentFalQuotaSummary(db),
    });
  });

  // PromptFace Studio Edit (10 credits)
  app.post('/api/studio/edit', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    if (rejectIfMaintenance(db, user.role, res)) return;
    const generationId = typeof req.body?.generationId === 'string' ? req.body.generationId : '';
    const instruction = typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';

    const generation = db.generations.find((g) => g.id === generationId && g.userId === user.id);
    if (!generation) {
      res.status(404).json({ error: 'Fotografia não encontrada no seu espaço.' });
      return;
    }

    const mod = moderatePrompt(instruction);
    if (!mod.allowed) {
      db.moderationLogs.unshift({
        id: crypto.randomUUID(),
        userId: user.id,
        userEmail: user.email,
        inputSnippet: instruction.slice(0, 140),
        reason: mod.reason || 'Edição bloqueada',
        action: 'blocked_prompt',
        createdAt: new Date().toISOString(),
      });
      await saveDb(db);
      res.status(400).json({ error: mod.reason });
      return;
    }

    const reservation = reserveCredits(user.credits, 'studio_edit');
    if (!reservation.ok) {
      res.status(402).json({ error: reservation.error, credits: user.credits });
      return;
    }

    user.credits = reservation.newBalance;
    db.creditLedger.unshift({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'reserve',
      operation: 'studio_edit',
      amount: -reservation.reservedAmount,
      balanceAfter: user.credits,
      description: `Reserva Studio: ${instruction.slice(0, 60)}`,
      createdAt: new Date().toISOString(),
    });
    await saveDb(db);

    const latestFilename =
      generation.versions.length > 0
        ? generation.versions[generation.versions.length - 1].filename
        : generation.filename;
    const latestMime =
      generation.versions.length > 0
        ? generation.versions[generation.versions.length - 1].mimeType
        : generation.mimeType;

    const sourceB64 = readImageAsBase64(GENERATED_DIR, latestFilename);
    if (!sourceB64) {
      user.credits = refundCredits(user.credits, reservation.reservedAmount);
      await saveDb(db);
      res.status(404).json({ error: 'Imagem base indisponível.', credits: user.credits });
      return;
    }

    const faceRefs = db.faceReferences
      .filter((f) => f.userId === user.id)
      .slice(0, 2)
      .map((f) => {
        const b64 = readImageAsBase64(UPLOADS_DIR, f.filename);
        return b64 ? { base64: b64, mimeType: f.mimeType } : null;
      })
      .filter((x): x is { base64: string; mimeType: string } => Boolean(x));

    const preferredModel = normalizePreferredAiModel(
      db.visualProfiles[user.id]?.preferredModel ?? user.preferredModel
    );

    const result = await editStudioImageWithProvider({
      sourceImage: { base64: sourceB64, mimeType: latestMime },
      faceReferences: faceRefs,
      instruction,
      preferredModel,
      falGate: createFalRequestGate(),
    });

    if (!result.ok || !result.base64) {
      user.credits = refundCredits(user.credits, reservation.reservedAmount);
      db.creditLedger.unshift({
        id: crypto.randomUUID(),
        userId: user.id,
        type: 'refund',
        operation: 'studio_edit',
        amount: reservation.reservedAmount,
        balanceAfter: user.credits,
        description: 'Estorno automático Studio',
        createdAt: new Date().toISOString(),
      });
      await saveDb(db);

      if (result.quotaExhausted) {
        res.status(429).json({
          quotaExhausted: true,
          error:
            result.error ||
            'Limite gratuito de 12 imagens na fal.ai atingido para evitar qualquer cobrança.',
          credits: user.credits,
          falQuota: currentFalQuotaSummary(db),
        });
        return;
      }

      if (result.notConfigured) {
        res.status(503).json({
          notConfigured: true,
          error: 'Edição no Studio em breve — estamos ativando os servidores de imagem.',
          credits: user.credits,
        });
        return;
      }
      res.status(502).json({ error: result.error, credits: user.credits });
      return;
    }

    const mimeType = result.mimeType || 'image/png';
    const { filename } = await saveImageFile(GENERATED_DIR, result.base64, mimeType);
    const version = {
      id: crypto.randomUUID(),
      instruction,
      filename,
      mimeType,
      createdAt: new Date().toISOString(),
    };
    generation.versions.push(version);
    db.creditLedger.unshift({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'confirm',
      operation: 'studio_edit',
      amount: 0,
      balanceAfter: user.credits,
      description: `Edição concluída no Studio: ${instruction.slice(0, 50)}`,
      createdAt: new Date().toISOString(),
    });
    await saveDb(db);

    res.status(201).json({
      version: { ...version, url: `/media/generated/${version.filename}` },
      generation: {
        ...generation,
        url: `/media/generated/${generation.filename}`,
        versions: generation.versions.map((v) => ({
          ...v,
          url: `/media/generated/${v.filename}`,
        })),
      },
      credits: user.credits,
      falQuota: currentFalQuotaSummary(db),
    });
  });

  // My Space: Generations, Credits, Subscription
  app.get('/api/generations', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const list = db.generations
      .filter((g) => g.userId === userId)
      .map((g) => ({
        ...g,
        tags: normalizeTagList(g.tags ?? []),
        url: `/media/generated/${g.filename}`,
        versions: g.versions.map((v) => ({
          ...v,
          url: `/media/generated/${v.filename}`,
        })),
      }));
    res.json({ generations: list });
  });

  app.patch('/api/generations/:id/favorite', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const gen = db.generations.find((g) => g.id === req.params.id && g.userId === req.authUser!.id);
    if (!gen) {
      res.status(404).json({ error: 'Fotografia não encontrada.' });
      return;
    }
    gen.favorite = !gen.favorite;
    await saveDb(db);
    res.json({ favorite: gen.favorite });
  });

  app.patch('/api/generations/:id/folder', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const gen = db.generations.find((g) => g.id === req.params.id && g.userId === userId);
    if (!gen) {
      res.status(404).json({ error: 'Fotografia não encontrada.' });
      return;
    }

    const rawFolderId = (req.body as { folderId?: unknown } | undefined)?.folderId;
    if (rawFolderId === null || rawFolderId === '' || rawFolderId === undefined) {
      delete gen.folderId;
      await saveDb(db);
      res.json({ folderId: null });
      return;
    }

    if (typeof rawFolderId !== 'string') {
      res.status(400).json({ error: 'Pasta inválida.' });
      return;
    }

    const targetFolder = db.folders.find((f) => f.id === rawFolderId && f.userId === userId);
    if (!targetFolder) {
      res.status(404).json({ error: 'Pasta não encontrada.' });
      return;
    }

    gen.folderId = targetFolder.id;
    await saveDb(db);
    res.json({ folderId: targetFolder.id });
  });

  app.post('/api/generations/batch-folder', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const body = (req.body ?? {}) as { generationIds?: unknown; folderId?: unknown };

    if (!Array.isArray(body.generationIds) || body.generationIds.length === 0) {
      res.status(400).json({ error: 'Selecione pelo menos uma fotografia.' });
      return;
    }

    const validIds = new Set(
      body.generationIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    if (validIds.size === 0) {
      res.status(400).json({ error: 'Nenhuma fotografia válida informada.' });
      return;
    }

    let resolvedFolderId: string | null = null;
    if (body.folderId !== null && body.folderId !== '' && body.folderId !== undefined) {
      if (typeof body.folderId !== 'string') {
        res.status(400).json({ error: 'Pasta de destino inválida.' });
        return;
      }
      const targetFolder = db.folders.find((f) => f.id === body.folderId && f.userId === userId);
      if (!targetFolder) {
        res.status(404).json({ error: 'Pasta de destino não encontrada.' });
        return;
      }
      resolvedFolderId = targetFolder.id;
    }

    const updatedIds: string[] = [];
    for (const gen of db.generations) {
      if (gen.userId === userId && validIds.has(gen.id)) {
        if (resolvedFolderId) {
          gen.folderId = resolvedFolderId;
        } else {
          delete gen.folderId;
        }
        updatedIds.push(gen.id);
      }
    }

    await saveDb(db);
    res.json({ updatedIds, folderId: resolvedFolderId });
  });

  app.patch('/api/generations/:id/tags', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const gen = db.generations.find((g) => g.id === req.params.id && g.userId === userId);
    if (!gen) {
      res.status(404).json({ error: 'Fotografia não encontrada.' });
      return;
    }

    const rawTags = (req.body as { tags?: unknown } | undefined)?.tags;
    if (!Array.isArray(rawTags)) {
      res.status(400).json({ error: 'Lista de tags inválida.' });
      return;
    }

    const normalized = normalizeTagList(rawTags);
    gen.tags = normalized;
    await saveDb(db);
    res.json({ tags: normalized });
  });

  app.post('/api/generations/batch-tags', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const body = (req.body ?? {}) as {
      generationIds?: unknown;
      tag?: unknown;
      action?: unknown;
    };

    if (!Array.isArray(body.generationIds) || body.generationIds.length === 0) {
      res.status(400).json({ error: 'Selecione pelo menos uma fotografia.' });
      return;
    }

    const normalizedTag = normalizeTagName(body.tag);
    if (!normalizedTag) {
      res.status(400).json({ error: 'Informe uma tag válida (2 a 24 caracteres).' });
      return;
    }

    const validIds = new Set(
      body.generationIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    if (validIds.size === 0) {
      res.status(400).json({ error: 'Nenhuma fotografia válida informada.' });
      return;
    }

    const mode = body.action === 'remove' ? 'remove' : 'add';
    const updated: Array<{ id: string; tags: string[] }> = [];
    const tagKey = normalizedTag.toLowerCase();

    for (const gen of db.generations) {
      if (gen.userId === userId && validIds.has(gen.id)) {
        const current = normalizeTagList(gen.tags ?? []);
        let next = current;
        if (mode === 'remove') {
          next = current.filter((t) => t.toLowerCase() !== tagKey);
        } else if (!current.some((t) => t.toLowerCase() === tagKey)) {
          if (current.length < MAX_TAGS_PER_PHOTO) {
            next = [...current, normalizedTag];
          }
        }
        gen.tags = next;
        updated.push({ id: gen.id, tags: next });
      }
    }

    await saveDb(db);
    res.json({ updated, tag: normalizedTag, action: mode });
  });

  app.post('/api/generations/batch-delete', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const body = (req.body ?? {}) as { generationIds?: unknown };

    if (!Array.isArray(body.generationIds) || body.generationIds.length === 0) {
      res.status(400).json({ error: 'Selecione pelo menos uma fotografia para excluir.' });
      return;
    }

    const validIds = new Set(
      body.generationIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    if (validIds.size === 0) {
      res.status(400).json({ error: 'Nenhuma fotografia válida informada.' });
      return;
    }

    const deletedIds: string[] = [];
    const remaining: typeof db.generations = [];

    for (const gen of db.generations) {
      if (gen.userId === userId && validIds.has(gen.id)) {
        deletedIds.push(gen.id);
        await deleteImageFile(GENERATED_DIR, gen.filename);
        for (const v of gen.versions) {
          await deleteImageFile(GENERATED_DIR, v.filename);
        }
      } else {
        remaining.push(gen);
      }
    }

    db.generations = remaining;
    await saveDb(db);
    res.json({ deletedIds });
  });

  app.get('/api/folders', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const folders = db.folders.filter((f) => f.userId === userId);
    res.json({ folders });
  });

  app.post('/api/folders', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const userFolders = db.folders.filter((f) => f.userId === userId);
    const rawName = (req.body as { name?: unknown } | undefined)?.name;
    const validation = validateNewFolderName(userFolders, rawName);
    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const folder = {
      id: `fld-${crypto.randomUUID()}`,
      userId,
      name: validation.name,
      createdAt: new Date().toISOString(),
    };
    db.folders.push(folder);
    await saveDb(db);
    res.status(201).json({ folder });
  });

  app.patch('/api/folders/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const folder = db.folders.find((f) => f.id === req.params.id && f.userId === userId);
    if (!folder) {
      res.status(404).json({ error: 'Pasta não encontrada.' });
      return;
    }

    const userFolders = db.folders.filter((f) => f.userId === userId);
    const rawName = (req.body as { name?: unknown } | undefined)?.name;
    const validation = validateRenameFolder(userFolders, folder.id, rawName);
    if (validation.ok === false) {
      res.status(400).json({ error: validation.error });
      return;
    }

    folder.name = validation.name;
    await saveDb(db);
    res.json({ folder });
  });

  app.delete('/api/folders/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const userId = req.authUser!.id;
    const idx = db.folders.findIndex((f) => f.id === req.params.id && f.userId === userId);
    if (idx === -1) {
      res.status(404).json({ error: 'Pasta não encontrada.' });
      return;
    }

    const [removed] = db.folders.splice(idx, 1);
    for (const gen of db.generations) {
      if (gen.userId === userId && gen.folderId === removed.id) {
        delete gen.folderId;
      }
    }
    await saveDb(db);
    res.json({ ok: true, deletedId: removed.id });
  });

  app.delete('/api/generations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const idx = db.generations.findIndex(
      (g) => g.id === req.params.id && g.userId === req.authUser!.id
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Fotografia não encontrada.' });
      return;
    }
    const [removed] = db.generations.splice(idx, 1);
    await deleteImageFile(GENERATED_DIR, removed.filename);
    for (const v of removed.versions) {
      await deleteImageFile(GENERATED_DIR, v.filename);
    }
    await saveDb(db);
    res.json({ ok: true });
  });

  app.get('/api/credits', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    const ledger = db.creditLedger.filter((e) => e.userId === user.id);
    res.json({ credits: user.credits, ledger });
  });

  app.get('/api/subscription', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    const payments = db.payments.filter((p) => p.userId === user.id);
    const plan = db.plans.find((p) => p.id === user.planId) ?? null;
    res.json({
      planId: user.planId,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      plan,
      payments,
    });
  });

  app.post('/api/checkout', requireAuth, async (req: AuthenticatedRequest, res) => {
    const db = loadDb();
    if (rejectIfMaintenance(db, req.authUser?.role, res)) return;
    const stripe = getStripeClient();
    const planId = req.body?.planId === 'premium' ? 'premium' : 'pro';
    const priceId =
      planId === 'premium'
        ? process.env.STRIPE_PRICE_PREMIUM?.trim()
        : process.env.STRIPE_PRICE_PRO?.trim();

    if (!stripe || !priceId) {
      res.status(503).json({
        notConfigured: true,
        error: 'Pagamentos em breve — estamos finalizando a ativação das assinaturas.',
      });
      return;
    }

    const appUrl =
      process.env.APP_URL?.trim() && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.trim()
        : `${req.protocol}://${req.get('host')}`;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: req.authUser!.email,
        line_items: [{ price: priceId, quantity: 1 }],
        locale: 'pt-BR',
        metadata: {
          userId: req.authUser!.id,
          planId,
        },
        success_url: `${appUrl}/meu-espaco?tab=assinatura&checkout=success`,
        cancel_url: `${appUrl}/planos?checkout=canceled`,
      });
      res.json({ url: session.url });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Erro ao iniciar checkout Stripe.',
      });
    }
  });

  app.post('/api/subscription/cancel', requireAuth, async (req: AuthenticatedRequest, res) => {
    const stripe = getStripeClient();
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;

    if (!stripe || !user.stripeSubscriptionId) {
      res.status(400).json({ error: 'Nenhuma assinatura ativa vinculada ao Stripe.' });
      return;
    }

    try {
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      user.subscriptionStatus = 'canceled';
      await saveDb(db);
      res.json({ ok: true, subscriptionStatus: user.subscriptionStatus });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Não foi possível cancelar a assinatura.',
      });
    }
  });

  // Admin routes (strict role === 'admin')
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const db = loadDb();
    const activeSubs = db.users.filter((u) => u.subscriptionStatus === 'active');
    const canceledSubs = db.users.filter((u) => u.subscriptionStatus === 'canceled');
    const mrr = activeSubs.reduce((sum, u) => {
      const plan = db.plans.find((p) => p.id === u.planId);
      return sum + (plan?.priceBrl ?? 0);
    }, 0);

    const todayStr = new Date().toISOString().slice(0, 10);
    const generationsToday = db.generations.filter((g) => g.createdAt.startsWith(todayStr)).length;
    const totalCostUsd = db.generations.reduce((sum, g) => sum + (g.estimatedCostUsd || 0), 0);
    const avgCostUsd = db.generations.length > 0 ? totalCostUsd / db.generations.length : 0;
    const totalRevenueBrl = db.payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.amountBrl, 0);

    res.json({
      metrics: {
        totalUsers: db.users.length,
        activeSubscriptions: activeSubs.length,
        canceledSubscriptions: canceledSubs.length,
        mrrBrl: mrr,
        totalRevenueBrl,
        totalGenerations: db.generations.length,
        generationsToday,
        avgCostUsd,
        estimatedMarginPct: mrr > 0 ? Math.max(0, ((mrr - totalCostUsd * 5.8) / mrr) * 100) : 0,
      },
      users: db.users.map(sanitizeUser),
      generations: db.generations.slice(0, 50),
      categories: db.categories,
      scenarios: db.scenarios,
      plans: db.plans,
      notices: db.notices,
      moderationLogs: db.moderationLogs.slice(0, 50),
      waitlistCount: db.waitlist.length,
      maintenance: normalizeMaintenanceConfig(db.maintenance),
      falQuota: currentFalQuotaSummary(db),
      dailyStats30d: buildAdminDailyStats({
        users: db.users,
        generations: db.generations,
        days: 30,
      }),
    });
  });

  app.put('/api/admin/fal-quota', requireAdmin, async (req, res) => {
    const db = loadDb();
    const current = normalizeFalQuotaState(db.falQuota);
    const rawLimit = req.body?.falFreeLimit;
    const rawUsed = req.body?.falImagesUsed;

    const nextLimit =
      typeof rawLimit === 'number' && Number.isFinite(rawLimit)
        ? Math.max(0, Math.floor(rawLimit))
        : current.falFreeLimit;
    const nextUsed =
      typeof rawUsed === 'number' && Number.isFinite(rawUsed)
        ? Math.max(0, Math.floor(rawUsed))
        : current.falImagesUsed;

    db.falQuota = normalizeFalQuotaState({
      falFreeLimit: nextLimit,
      falImagesUsed: nextUsed,
      updatedAt: new Date().toISOString(),
    });
    await saveDb(db);
    res.json({ falQuota: currentFalQuotaSummary(db) });
  });

  app.put('/api/admin/maintenance', requireAdmin, async (req, res) => {
    const db = loadDb();
    const body = (req.body ?? {}) as {
      enabled?: unknown;
      title?: unknown;
      message?: unknown;
      estimatedReturn?: unknown;
    };
    const nextConfig = normalizeMaintenanceConfig({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : db.maintenance?.enabled,
      title: typeof body.title === 'string' ? body.title : db.maintenance?.title,
      message: typeof body.message === 'string' ? body.message : db.maintenance?.message,
      estimatedReturn:
        typeof body.estimatedReturn === 'string'
          ? body.estimatedReturn
          : db.maintenance?.estimatedReturn,
      updatedAt: new Date().toISOString(),
    });
    db.maintenance = nextConfig;
    await saveDb(db);
    res.json({ maintenance: nextConfig });
  });

  app.post('/api/admin/users/:id/credits', requireAdmin, async (req, res) => {
    const delta = Number(req.body?.delta);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : 'Ajuste administrativo';
    if (!Number.isFinite(delta) || delta === 0) {
      res.status(400).json({ error: 'Informe uma variação válida de créditos.' });
      return;
    }
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    user.credits = Math.max(0, user.credits + delta);
    db.creditLedger.unshift({
      id: crypto.randomUUID(),
      userId: user.id,
      type: 'admin_adjustment',
      operation: 'admin',
      amount: delta,
      balanceAfter: user.credits,
      description: reason,
      createdAt: new Date().toISOString(),
    });
    await saveDb(db);
    res.json({ user: sanitizeUser(user) });
  });

  app.post('/api/admin/scenarios', requireAdmin, async (req, res) => {
    const db = loadDb();
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const categoryId = typeof req.body?.categoryId === 'string' ? req.body.categoryId : 'luxo';
    const cat = db.categories.find((c) => c.id === categoryId);
    if (!title || !cat) {
      res.status(400).json({ error: 'Título e categoria válida são obrigatórios.' });
      return;
    }

    const scenario = {
      id: `${categoryId}-${crypto.randomUUID().slice(0, 6)}`,
      categoryId: cat.id,
      categoryName: cat.name,
      title,
      description: String(req.body?.description || title).trim(),
      image: String(req.body?.image || cat.image),
      defaultOutfit: String(req.body?.defaultOutfit || 'Traje editorial'),
      defaultEnvironment: String(req.body?.defaultEnvironment || 'Cenário realista'),
      defaultPose: String(req.body?.defaultPose || 'Pose natural'),
      defaultLighting: String(req.body?.defaultLighting || 'Luz natural'),
      defaultStyle: String(req.body?.defaultStyle || 'Fotografia editorial 50mm'),
      popular: Boolean(req.body?.popular),
      active: true,
    };

    db.scenarios.unshift(scenario);
    await saveDb(db);
    res.status(201).json({ scenario });
  });

  app.patch('/api/admin/scenarios/:id', requireAdmin, async (req, res) => {
    const db = loadDb();
    const scenario = db.scenarios.find((s) => s.id === req.params.id);
    if (!scenario) {
      res.status(404).json({ error: 'Cenário não encontrado.' });
      return;
    }
    if (typeof req.body?.title === 'string') scenario.title = req.body.title.trim();
    if (typeof req.body?.description === 'string') scenario.description = req.body.description.trim();
    if (typeof req.body?.active === 'boolean') scenario.active = req.body.active;
    if (typeof req.body?.popular === 'boolean') scenario.popular = req.body.popular;
    await saveDb(db);
    res.json({ scenario });
  });

  app.patch('/api/admin/plans/:id', requireAdmin, async (req, res) => {
    const db = loadDb();
    const plan = db.plans.find((p) => p.id === req.params.id);
    if (!plan) {
      res.status(404).json({ error: 'Plano não encontrado.' });
      return;
    }
    const price = Number(req.body?.priceBrl);
    const credits = Number(req.body?.creditsMonthly);
    if (Number.isFinite(price) && price > 0) {
      plan.priceBrl = price;
      plan.priceFormatted = `R$ ${price.toFixed(2).replace('.', ',')}`;
    }
    if (Number.isFinite(credits) && credits >= 10) {
      plan.creditsMonthly = credits;
      plan.maxPhotosMonthly = Math.floor(credits / CREDIT_COSTS.generate);
    }
    await saveDb(db);
    res.json({ plan });
  });

  app.post('/api/admin/notices', requireAdmin, async (req, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!title || !message) {
      res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
      return;
    }
    const db = loadDb();
    const notice = {
      id: crypto.randomUUID(),
      title,
      message,
      active: true,
      createdAt: new Date().toISOString(),
    };
    db.notices.unshift(notice);
    await saveDb(db);
    res.status(201).json({ notice });
  });

  app.delete('/api/admin/notices/:id', requireAdmin, async (req, res) => {
    const db = loadDb();
    db.notices = db.notices.filter((n) => n.id !== req.params.id);
    await saveDb(db);
    res.json({ ok: true });
  });
}
