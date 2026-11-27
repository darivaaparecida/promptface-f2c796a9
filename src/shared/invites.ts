/**
 * Programa de convites — regras compartilhadas entre a página /convites,
 * o cadastro (/login?convite=CODIGO) e o link de compartilhamento.
 *
 * O código tem 8 caracteres do alfabeto sem confusos (sem I, O, 0, 1).
 * A recompensa é paga no cadastro pelo trigger handle_new_user (migração 8):
 * 10 créditos para quem convidou, 1 vez por conta convidada.
 */

export const INVITE_REWARD_CREDITS = 10;
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_SITE_URL = 'https://www.promptface.com.br';

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

export function buildInviteShareMessage(inviteLink: string): string {
  return `Estou criando fotos profissionais com IA no PromptFace! Entre pelo meu link de convite e crie sua conta: ${inviteLink}`;
}
