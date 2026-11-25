import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CATEGORIES, INITIAL_PLANS, INITIAL_SCENARIOS } from '../src/shared/catalog.ts';
import type { DatabaseSchema } from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
export const GENERATED_DIR = path.resolve(DATA_DIR, 'generated');
const DB_PATH = path.resolve(DATA_DIR, 'promptface-db.json');

function ensureDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function createInitialDb(): DatabaseSchema {
  return {
    users: [],
    visualProfiles: {},
    faceReferences: [],
    generations: [],
    folders: [],
    creditLedger: [],
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
