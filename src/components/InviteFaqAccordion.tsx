import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Gift } from 'lucide-react';
import {
  CREDITS_PER_PHOTO,
  INVITE_FREE_BONUS_MONTHLY_CAP,
  INVITE_MILESTONE_REWARD_CREDITS,
  INVITE_REWARD_CREDITS,
  INVITE_SUBSCRIPTION_FRIEND_BONUS,
  INVITE_SUBSCRIPTION_REWARD_CREDITS,
} from '../shared/invites';

const INVITE_FAQ_ITEMS = [
  {
    q: 'Como funciona o ganho de créditos no sistema de convites?',
    a: `Ao compartilhar seu link pessoal disponível em /convites, você ganha ${INVITE_REWARD_CREDITS} créditos assim que seu amigo cria a conta. Quando ele envia a 1ª foto de referência facial, vocês dois ganham mais ${INVITE_MILESTONE_REWARD_CREDITS} créditos bônus. E se ele assinar um plano, você recebe mais ${INVITE_SUBSCRIPTION_REWARD_CREDITS} créditos.`,
  },
  {
    q: 'O que o meu amigo convidado ganha ao entrar pelo link?',
    a: `Seu amigo recebe os ${CREDITS_PER_PHOTO} créditos iniciais de boas-vindas (1 foto grátis), ganha mais ${INVITE_MILESTONE_REWARD_CREDITS} créditos ao enviar a 1ª foto de referência e recebe +${INVITE_SUBSCRIPTION_FRIEND_BONUS} créditos extras no 1º mês caso assine um plano.`,
  },
  {
    q: 'Quantas fotos eu consigo gerar com os créditos de convite?',
    a: `Cada foto gerada no modelo padrão ou edição no Studio custa ${CREDITS_PER_PHOTO} créditos (ou 20 créditos usando o Nano Banana Pro). Ou seja, a cada amigo que entra pelo seu link você já garante créditos suficientes para 1 nova fotografia.`,
  },
  {
    q: 'Existe limite mensal de convites ou regras de segurança?',
    a: `O bônus extra de 1ª foto é limitado a ${INVITE_FREE_BONUS_MONTHLY_CAP} amigos por mês (${INVITE_FREE_BONUS_MONTHLY_CAP * INVITE_MILESTONE_REWARD_CREDITS} créditos), enquanto o bônus de ${INVITE_SUBSCRIPTION_REWARD_CREDITS} créditos por assinatura não tem limite. Para manter o programa justo, autoindicação é bloqueada e cada conta só gera recompensa uma vez.`,
  },
  {
    q: 'Onde acompanho meus amigos convidados e meu saldo ganho?',
    a: 'Dentro da página Convites (/convites) ou no cartão Indique e Ganhe em Meu Espaço, você encontra seu link pessoal, botão de envio direto para WhatsApp e a lista com o status de cada amigo (entrou ou pendente).',
  },
];

/**
 * Acordeão interativo de Perguntas Frequentes focado no sistema de convites e ganho de créditos.
 */
export function InviteFaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      aria-labelledby="home-invite-faq-heading"
      className="mx-auto max-w-4xl px-4 sm:px-6 py-12"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            <Gift className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Sistema de convites e créditos</span>
          </p>
          <h2
            id="home-invite-faq-heading"
            className="mt-2 font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white"
          >
            Como funciona o programa de indicação
          </h2>
        </div>

        <Link
          to="/convites"
          className="text-xs font-semibold uppercase tracking-wider text-violet-700 hover:text-violet-900 dark:text-[#A855F7] dark:hover:text-white whitespace-nowrap"
        >
          Acessar página de convites →
        </Link>
      </div>

      <div className="mt-7 space-y-3">
        {INVITE_FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={item.q}
              className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface overflow-hidden"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4 text-left hover:bg-slate-100/70 dark:hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-display text-sm sm:text-base font-medium text-slate-950 dark:text-white">
                  {item.q}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-600 dark:text-[#A1A1AA] shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-violet-700 dark:text-[#8B5CF6]' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
              {isOpen && (
                <div className="px-5 sm:px-6 pb-5 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed border-t border-slate-200 dark:border-white/5 pt-4">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
