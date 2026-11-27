/**
 * Programa de convites — regras compartilhadas entre a página /convites,
 * o cadastro (/login?convite=CODIGO) e o link de compartilhamento.
 *
 * O código tem 8 caracteres do alfabeto sem confusos (sem I, O, 0, 1).
 * A recompensa é paga no cadastro pelo trigger handle_new_user (migração 8):
 * 10 créditos para quem convidou, 1 vez por conta convidada.
 */

export const INVITE_REWARD_CREDITS = 10;
export const INVITE_MILESTONE_REWARD_CREDITS = 5;
export const INVITE_SUBSCRIPTION_REWARD_CREDITS = 30;
export const INVITE_SUBSCRIPTION_FRIEND_BONUS = 10;
export const INVITE_FREE_BONUS_MONTHLY_CAP = 5;
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_SITE_URL = 'https://www.promptface.com.br';
/** Custo de 1 foto (para a barra de meta "falta X para a próxima foto"). */
export const CREDITS_PER_PHOTO = 10;

export function isValidInviteCode(code: string | null | undefined): boolean {
  if (typeof code !== 'string') return false;
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== INVITE_CODE_LENGTH) return false;
  return [...normalized].every((ch) => INVITE_CODE_ALPHABET.includes(ch));
}

export function normalizeInviteCode(code: string | null | undefined): string | null {
  if (!isValidInviteCode(code)) return null;
  return (code as string).trim().toUpperCase();
}

export function buildInviteLink(code: string): string {
  return `${INVITE_SITE_URL}/convite/${code.trim().toUpperCase()}`;
}

/** Link curto com ?ref= (para a home e para o compartilhamento de cenário). */
export function buildInviteRefLink(code: string): string {
  return `${INVITE_SITE_URL}/?ref=${code.trim().toUpperCase()}`;
}

/** Link que abre a criação já naquele cenário, com o convite junto. */
export function buildScenarioInviteLink(scenarioId: string, code: string): string {
  return `/criar?cenario=${encodeURIComponent(scenarioId)}&ref=${code.trim().toUpperCase()}`;
}

export function buildInviteShareMessage(inviteLink: string): string {
  return `Estou criando fotos profissionais com IA no PromptFace! Entre pelo meu link de convite e crie sua conta: ${inviteLink}`;
}

/**
 * O código de convite sobrevive à navegação: quando alguém abre um link
 * com ?ref= ou /convite/CODIGO sem estar logado, o código fica guardado
 * no navegador até o cadastro terminar.
 */
const STORED_INVITE_CODE_KEY = 'promptface_invite_code';

export function saveInviteCode(code: string | null | undefined): void {
  try {
    const normalized = normalizeInviteCode(code);
    if (!normalized) return;
    window.localStorage.setItem(STORED_INVITE_CODE_KEY, normalized);
  } catch {
    // Navegador sem localStorage: o cadastro sem o código segue normal.
  }
}

export function getStoredInviteCode(): string | null {
  try {
    return normalizeInviteCode(window.localStorage.getItem(STORED_INVITE_CODE_KEY));
  } catch {
    return null;
  }
}

export function clearStoredInviteCode(): void {
  try {
    window.localStorage.removeItem(STORED_INVITE_CODE_KEY);
  } catch {
    // Sem localStorage, não há nada para limpar.
  }
}

/** Quantos créditos faltam para a próxima foto grátis (0 a 10). */
export function creditsToNextPhoto(credits: number): number {
  const safe = Math.max(0, Math.floor(credits));
  const remainder = safe % CREDITS_PER_PHOTO;
  return remainder === 0 ? CREDITS_PER_PHOTO : CREDITS_PER_PHOTO - remainder;
}
