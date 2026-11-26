export function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-6 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
      <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">Termos de Uso — PromptFace</h1>
      <p>
        Ao criar uma conta em promptface.com.br, você concorda em utilizar a plataforma exclusivamente com fotografias do seu próprio rosto ou de pessoas que concederam autorização expressa e documentada.
      </p>
      <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white pt-2">1. Uso proibido</h2>
      <p>
        É estritamente proibido gerar conteúdo sexual ou nudez, violência, fraude, falsificação de identidade ou documentos, deepfakes prejudiciais e material político enganoso. Violações resultam em bloqueio automático e encerramento da conta.
      </p>
      <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white pt-2">2. Créditos e assinaturas</h2>
      <p>
        Novos cadastros recebem 10 créditos iniciais (equivalente a 1 foto grátis). Planos mensais renovam os créditos a cada ciclo e créditos não utilizados não acumulam para o mês seguinte. Em caso de falha técnica na geração, os créditos reservados são estornados automaticamente.
      </p>
      <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white pt-2">3. Suporte</h2>
      <p>
        Dúvidas gerais e solicitações podem ser enviadas para{' '}
        <a href="mailto:contato@promptface.com.br" className="text-violet-700 dark:text-[#8B5CF6] underline">
          contato@promptface.com.br
        </a>.
      </p>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-6 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
      <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">Política de Privacidade</h1>
      <p>
        O PromptFace trata seus dados cadastrais e suas fotos de referência facial com sigilo absoluto. Suas referências faciais são privadas por padrão e visíveis apenas para você na sua área logada.
      </p>
      <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white pt-2">1. Nunca treinamos modelos com seu rosto</h2>
      <p>
        As fotos enviadas para o seu Perfil Visual são utilizadas exclusivamente no momento da geração ou edição solicitada por você. Elas não são comercializadas, tornadas públicas ou usadas para treinamento de modelos de inteligência artificial.
      </p>
      <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white pt-2">2. Exclusão imediata</h2>
      <p>
        Ao excluir uma foto de referência ou uma imagem gerada em Meu Espaço ou Meu Perfil Visual, removemos tanto o arquivo armazenado quanto o respectivo registro no banco de dados.
      </p>
      <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white pt-2">3. Contato</h2>
      <p>
        Atendimento geral:{' '}
        <a href="mailto:contato@promptface.com.br" className="text-violet-700 dark:text-[#8B5CF6] underline">
          contato@promptface.com.br
        </a>.
      </p>
    </article>
  );
}

export function LgpdPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-6 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
      <h1 className="font-display text-3xl font-bold text-slate-950 dark:text-white">LGPD — Proteção de Dados Pessoais</h1>
      <p>
        Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), detalhamos abaixo como tratamos dados biométricos e pessoais no PromptFace:
      </p>
      <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white pt-2">1. Finalidade e Base Legal</h2>
      <p>
        As imagens faciais enviadas e os atributos do Perfil Visual são tratados mediante o seu consentimento explícito e específico (art. 7º, I e art. 11, I da LGPD), coletado antes de qualquer upload, exclusivamente para gerar e editar fotografias solicitadas por você.
      </p>
      <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white pt-2">2. Direitos do Titular</h2>
      <p>
        Você pode a qualquer momento confirmar a existência do tratamento, acessar, corrigir, exportar ou excluir permanentemente suas fotos e dados de perfil diretamente pela plataforma ou pelo canal abaixo.
      </p>
      <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white pt-2">3. Encarregado pelo Tratamento de Dados (DPO)</h2>
      <p>
        Para solicitações relacionadas à LGPD, escreva para{' '}
        <a href="mailto:dpo@promptface.com.br" className="text-violet-700 dark:text-[#8B5CF6] underline">
          dpo@promptface.com.br
        </a>{' '}
        ou para nosso suporte geral em{' '}
        <a href="mailto:contato@promptface.com.br" className="text-violet-700 dark:text-[#8B5CF6] underline">
          contato@promptface.com.br
        </a>.
      </p>
    </article>
  );
}
