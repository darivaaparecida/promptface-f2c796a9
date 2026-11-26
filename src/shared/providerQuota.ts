export const DEFAULT_FAL_FREE_LIMIT = 12;

export interface FalQuotaState {
  falImagesUsed: number;
  falFreeLimit: number;
  updatedAt?: string;
}

export interface FalQuotaSummary {
  active: boolean;
  used: number;
  limit: number;
  inFlight: number;
  remaining: number;
  exhausted: boolean;
  updatedAt?: string;
}

export function normalizeFalQuotaState(
  input?: Partial<FalQuotaState> | null
): FalQuotaState {
  const rawUsed = typeof input?.falImagesUsed === 'number' ? input.falImagesUsed : 0;
  const rawLimit =
    typeof input?.falFreeLimit === 'number' ? input.falFreeLimit : DEFAULT_FAL_FREE_LIMIT;

  const falImagesUsed = Number.isFinite(rawUsed) ? Math.max(0, Math.floor(rawUsed)) : 0;
  const falFreeLimit = Number.isFinite(rawLimit)
    ? Math.max(0, Math.floor(rawLimit))
    : DEFAULT_FAL_FREE_LIMIT;

  return {
    falImagesUsed,
    falFreeLimit,
    updatedAt: typeof input?.updatedAt === 'string' ? input.updatedAt : undefined,
  };
}

export function getFalQuotaSummary(
  state: FalQuotaState,
  options?: { active?: boolean; inFlight?: number }
): FalQuotaSummary {
  const normalized = normalizeFalQuotaState(state);
  const inFlightRaw = typeof options?.inFlight === 'number' ? options.inFlight : 0;
  const inFlight = Number.isFinite(inFlightRaw) ? Math.max(0, Math.floor(inFlightRaw)) : 0;
  const remaining = Math.max(0, normalized.falFreeLimit - normalized.falImagesUsed - inFlight);

  return {
    active: Boolean(options?.active),
    used: normalized.falImagesUsed,
    limit: normalized.falFreeLimit,
    inFlight,
    remaining,
    exhausted: normalized.falImagesUsed + inFlight >= normalized.falFreeLimit,
    updatedAt: normalized.updatedAt,
  };
}

export function canConsumeFalImage(state: FalQuotaState, inFlight = 0): boolean {
  const normalized = normalizeFalQuotaState(state);
  const safeInFlight = Number.isFinite(inFlight) ? Math.max(0, Math.floor(inFlight)) : 0;
  return normalized.falImagesUsed + safeInFlight < normalized.falFreeLimit;
}

export function recordFalImageSuccess(
  state: FalQuotaState,
  timestamp = new Date().toISOString()
): FalQuotaState {
  const normalized = normalizeFalQuotaState(state);
  return {
    falImagesUsed: normalized.falImagesUsed + 1,
    falFreeLimit: normalized.falFreeLimit,
    updatedAt: timestamp,
  };
}
