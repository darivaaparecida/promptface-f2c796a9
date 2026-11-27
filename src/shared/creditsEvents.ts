/**
 * Evento local de mudança de saldo.
 *
 * Qualquer código que altere os créditos do usuário (resgate mensal,
 * ajuste do admin, e na Fase 2 a dedução após gerar uma foto ou editar
 * no Studio) dispara `notifyCreditsChanged()` depois de confirmar a
 * mudança no banco. O AuthContext escuta o evento e recarrega o perfil,
 * então o indicador de créditos da Navbar atualiza na hora, sem F5.
 */
export const CREDITS_CHANGED_EVENT = 'promptface:credits-changed';

export function notifyCreditsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CREDITS_CHANGED_EVENT));
  }
}
