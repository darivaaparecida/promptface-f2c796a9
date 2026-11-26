import type { CategoryItem, PlanDefinition, ScenarioItem } from '../src/shared/catalog.ts';
import type { VisualProfileData } from '../src/shared/rules.ts';
import type { PreferredAiModelId } from '../src/shared/aiModels.ts';
import type { MaintenanceConfig } from '../src/shared/adminStats.ts';
import type { FalQuotaState } from '../src/shared/providerQuota.ts';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  verificationCode?: string;
  resetCode?: string;
  resetExpiresAt?: number;
  credits: number;
  planId: 'free_trial' | 'pro' | 'premium';
  subscriptionStatus: 'inactive' | 'active' | 'canceled' | 'past_due';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  preferredModel?: PreferredAiModelId;
  createdAt: string;
}

export interface FaceReferenceRecord {
  id: string;
  userId: string;
  filename: string;
  mimeType: string;
  consentAccepted: boolean;
  consentTimestamp: string;
  faceVerified: boolean;
  createdAt: string;
}

export interface StudioVersionRecord {
  id: string;
  instruction: string;
  filename: string;
  mimeType: string;
  createdAt: string;
}

export interface GenerationRecord {
  id: string;
  userId: string;
  mode: 'preset' | 'free' | 'variation';
  scenarioId?: string;
  scenarioTitle: string;
  categoryId: string;
  categoryName: string;
  promptUsed: string;
  aspectRatio: string;
  filename: string;
  mimeType: string;
  costCredits: number;
  estimatedCostUsd: number;
  status: 'pending' | 'completed' | 'failed';
  provider: string;
  model: string;
  favorite: boolean;
  folderId?: string;
  tags?: string[];
  synthIdMarked: boolean;
  versions: StudioVersionRecord[];
  createdAt: string;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  type: 'signup_bonus' | 'reserve' | 'confirm' | 'refund' | 'subscription_grant' | 'admin_adjustment';
  operation: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  planId: 'pro' | 'premium';
  amountBrl: number;
  status: 'paid' | 'canceled' | 'refunded' | 'pending';
  stripeSessionId?: string;
  method: string;
  createdAt: string;
}

export interface ModerationLogRecord {
  id: string;
  userId?: string;
  userEmail?: string;
  inputSnippet: string;
  reason: string;
  action: 'blocked_prompt' | 'blocked_upload';
  createdAt: string;
}

export interface NoticeRecord {
  id: string;
  title: string;
  message: string;
  active: boolean;
  createdAt: string;
}

export interface WaitlistRecord {
  id: string;
  email: string;
  feature: 'generation' | 'payments' | 'general';
  createdAt: string;
}

export interface FolderRecord {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: UserRecord[];
  visualProfiles: Record<string, VisualProfileData & { updatedAt: string }>;
  faceReferences: FaceReferenceRecord[];
  generations: GenerationRecord[];
  folders: FolderRecord[];
  creditLedger: CreditLedgerEntry[];
  payments: PaymentRecord[];
  moderationLogs: ModerationLogRecord[];
  notices: NoticeRecord[];
  waitlist: WaitlistRecord[];
  categories: CategoryItem[];
  scenarios: ScenarioItem[];
  plans: PlanDefinition[];
  maintenance?: MaintenanceConfig;
  falQuota?: FalQuotaState;
}
