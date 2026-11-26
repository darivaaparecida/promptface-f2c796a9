import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CATEGORIES, INITIAL_PLANS, INITIAL_SCENARIOS } from '../src/shared/catalog.ts';
import type { DatabaseSchema } from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
export const GENERATED_DIR = path.resolve(DATA_DIR, 'generated');
const DB_PATH = path.resolve(DATA_DIR, 'promptface-db.json');

const ASSETS_IMAGES_DIR = path.resolve(process.cwd(), 'src', 'assets', 'images');

function ensureDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function copySeedAsset(srcFilename: string, targetDir: string, targetFilename: string): boolean {
  const srcPath = path.resolve(ASSETS_IMAGES_DIR, srcFilename);
  const destPath = path.resolve(targetDir, targetFilename);
  if (fs.existsSync(destPath)) return true;
  if (!fs.existsSync(srcPath)) return false;
  fs.copyFileSync(srcPath, destPath);
  return true;
}

function hashSeedPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function createInitialDb(): DatabaseSchema {
  ensureDirs();
  const now = Date.now();
  const createdUserAt = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const createdGen1At = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const createdVer1At = new Date(now - 60 * 60 * 1000).toISOString();
  const createdGen2At = new Date(now - 30 * 60 * 1000).toISOString();

  const testUserId = 'user-teste-admin';
  const hasFaceAsset = copySeedAsset(
    'ba_selfie_man_glasses_1795644052386.jpg',
    UPLOADS_DIR,
    'teste-face-ref.jpg'
  );
  const hasGen1Asset = copySeedAsset(
    'hero_luxury_office_1795644050857.jpg',
    GENERATED_DIR,
    'teste-studio-office.jpg'
  );
  const hasVer1Asset = copySeedAsset(
    'ba_result_1920s_1795644054285.jpg',
    GENERATED_DIR,
    'teste-studio-1920s-v1.jpg'
  );
  const hasGen2Asset = copySeedAsset(
    'hero_dubai_lambo_1795644049769.jpg',
    GENERATED_DIR,
    'teste-dubai-lambo.jpg'
  );

  const generations = [];
  if (hasGen1Asset) {
    generations.push({
      id: 'gen-teste-studio-1',
      userId: testUserId,
      mode: 'preset' as const,
      scenarioId: 'ceo-escritorio-panoramico',
      scenarioTitle: 'Executivo em Escritório Panorâmico',
      categoryId: 'corporativo',
      categoryName: 'Corporativo & LinkedIn',
      promptUsed:
        'Retrato corporativo em escritório moderno panorâmico com terno sob medida e iluminação natural de janela.',
      aspectRatio: '3:4',
      filename: 'teste-studio-office.jpg',
      mimeType: 'image/jpeg',
      costCredits: 10,
      estimatedCostUsd: 0.04,
      status: 'completed' as const,
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite-image',
      favorite: true,
      folderId: 'folder-teste-studio',
      tags: ['Corporativo', 'Retrato'],
      synthIdMarked: true,
      versions: hasVer1Asset
        ? [
            {
              id: 'ver-teste-studio-1',
              instruction:
                'Transformar o ambiente em um salão clássico anos 1920 com iluminação quente e terno risca de giz',
              filename: 'teste-studio-1920s-v1.jpg',
              mimeType: 'image/jpeg',
              createdAt: createdVer1At,
            },
          ]
        : [],
      createdAt: createdGen1At,
    });
  }

  if (hasGen2Asset) {
    generations.push({
      id: 'gen-teste-gallery-2',
      userId: testUserId,
      mode: 'free' as const,
      scenarioTitle: 'Editorial em Dubai ao Entardecer',
      categoryId: 'carros',
      categoryName: 'Carros & Esportes',
      promptUsed:
        'Fotografia lifestyle ao entardecer em Dubai com iluminação dourada cinematográfica e supercarro ao fundo.',
      aspectRatio: '3:4',
      filename: 'teste-dubai-lambo.jpg',
      mimeType: 'image/jpeg',
      costCredits: 10,
      estimatedCostUsd: 0.06,
      status: 'completed' as const,
      provider: 'gemini',
      model: 'gemini-nano-banana-2.1',
      favorite: false,
      folderId: 'folder-teste-studio',
      tags: ['Editorial', 'Viagem'],
      synthIdMarked: true,
      versions: [],
      createdAt: createdGen2At,
    });
  }

  return {
    users: [
      {
        id: testUserId,
        name: 'Conta Teste Admin',
        email: 'teste@promptface.com.br',
        passwordHash: hashSeedPassword('PromptFace@2026'),
        role: 'admin',
        emailVerified: true,
        credits: 180,
        planId: 'pro',
        subscriptionStatus: 'active',
        preferredModel: 'auto',
        createdAt: createdUserAt,
      },
    ],
    visualProfiles: {
      [testUserId]: {
        eyeColor: 'Castanhos escuros',
        hairColorStyle: 'Castanho curto moderno',
        hairType: 'Liso / ondulado',
        beardMustache: 'Barba curta aparada',
        skinTone: 'Oliva',
        facialFeatures: 'Óculos de grau discretos',
        heightBodyType: '1,78m, porte atlético',
        otherCharacteristics: '',
        preferredModel: 'auto',
        updatedAt: createdUserAt,
      },
    },
    faceReferences: hasFaceAsset
      ? [
          {
            id: 'face-teste-1',
            userId: testUserId,
            filename: 'teste-face-ref.jpg',
            mimeType: 'image/jpeg',
            consentAccepted: true,
            consentTimestamp: createdUserAt,
            faceVerified: true,
            createdAt: createdUserAt,
          },
        ]
      : [],
    generations,
    folders: [
      {
        id: 'folder-teste-studio',
        userId: testUserId,
        name: 'Studio & Favoritas',
        createdAt: createdUserAt,
      },
    ],
    creditLedger: [
      {
        id: 'led-teste-4',
        userId: testUserId,
        type: 'reserve',
        operation: 'studio_edit',
        amount: -10,
        balanceAfter: 180,
        description: 'Edição no Studio: Transformar o ambiente em salão clássico anos 1920',
        createdAt: createdVer1At,
      },
      {
        id: 'led-teste-3',
        userId: testUserId,
        type: 'reserve',
        operation: 'generate',
        amount: -10,
        balanceAfter: 190,
        description: 'Geração: Executivo em Escritório Panorâmico',
        createdAt: createdGen1At,
      },
      {
        id: 'led-teste-2',
        userId: testUserId,
        type: 'subscription_grant',
        operation: 'plan_pro',
        amount: 200,
        balanceAfter: 200,
        description: 'Créditos mensais do Plano PRO (conta de teste)',
        createdAt: createdUserAt,
      },
    ],
    payments: [],
    moderationLogs: [],
    notices: [
      {
        id: 'notice-launch',
        title: 'Novos cenários em alta resolução',
        message: 'Explore os 84 cenários prontos divididos em 14 categorias ou crie livremente com melhoria de descrição.',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ],
    waitlist: [],
    categories: [...CATEGORIES],
    scenarios: [...INITIAL_SCENARIOS],
    plans: [...INITIAL_PLANS],
  };
}

let dbCache: DatabaseSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

export function loadDb(): DatabaseSchema {
  ensureDirs();
  if (dbCache) return dbCache;

  if (!fs.existsSync(DB_PATH)) {
    dbCache = createInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf8');
    return dbCache;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    const defaults = createInitialDb();
    dbCache = {
      users: parsed.users ?? defaults.users,
      visualProfiles: parsed.visualProfiles ?? defaults.visualProfiles,
      faceReferences: parsed.faceReferences ?? defaults.faceReferences,
      generations: parsed.generations ?? defaults.generations,
      folders: parsed.folders ?? defaults.folders,
      creditLedger: parsed.creditLedger ?? defaults.creditLedger,
      payments: parsed.payments ?? defaults.payments,
      moderationLogs: parsed.moderationLogs ?? defaults.moderationLogs,
      notices: parsed.notices ?? defaults.notices,
      waitlist: parsed.waitlist ?? defaults.waitlist,
      categories: parsed.categories?.length ? parsed.categories : defaults.categories,
      scenarios: parsed.scenarios?.length ? parsed.scenarios : defaults.scenarios,
      plans: parsed.plans?.length ? parsed.plans : defaults.plans,
    };
    return dbCache;
  } catch {
    dbCache = createInitialDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2), 'utf8');
    return dbCache;
  }
}

export async function saveDb(db: DatabaseSchema): Promise<void> {
  ensureDirs();
  dbCache = db;
  const serialized = JSON.stringify(db, null, 2);
  writeQueue = writeQueue.then(async () => {
    const tmpPath = `${DB_PATH}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    await fs.promises.writeFile(tmpPath, serialized, 'utf8');
    await fs.promises.rename(tmpPath, DB_PATH);
  });
  await writeQueue;
}

export function resolveSafeFile(baseDir: string, filename: string): string | null {
  if (!filename || typeof filename !== 'string') return null;
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) return null;
  const resolved = path.resolve(baseDir, filename);
  if (!resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}

export async function saveImageFile(
  baseDir: string,
  base64Data: string,
  mimeType: string
): Promise<{ filename: string; fullPath: string }> {
  ensureDirs();
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const fullPath = resolveSafeFile(baseDir, filename);
  if (!fullPath) {
    throw new Error('Invalid storage filename');
  }
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  await fs.promises.writeFile(fullPath, buffer);
  return { filename, fullPath };
}

export async function deleteImageFile(baseDir: string, filename: string): Promise<void> {
  const fullPath = resolveSafeFile(baseDir, filename);
  if (!fullPath) return;
  try {
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  } catch {
    // Ignore already deleted file
  }
}

export function readImageAsBase64(baseDir: string, filename: string): string | null {
  const fullPath = resolveSafeFile(baseDir, filename);
  if (!fullPath || !fs.existsSync(fullPath)) return null;
  const buf = fs.readFileSync(fullPath);
  return buf.toString('base64');
}
