/**
 * Instrumentação mínima de produto.
 *
 * O app não tinha nenhum analytics: só dava para inferir comportamento pelo que
 * sobra no Postgres — contagem de imóveis e `last_sign_in_at`. Isso não diz
 * onde a pessoa para na primeira sessão, que é exatamente o gargalo (dos 9
 * usuários reais, 9 usaram uma sessão só).
 *
 * Escreve na tabela `app_events` pelo cliente Supabase que já existe. Não é um
 * SDK de terceiro de propósito: qualquer biblioteca de analytics traria módulo
 * nativo, e módulo nativo exige build novo — que hoje está bloqueado pela
 * migração do IAP.
 *
 * Regras:
 * - Nunca lança. Instrumentação que quebra a tela é pior que instrumentação
 *   nenhuma, então todo erro é engolido com um aviso no console.
 * - Nunca bloqueia. Não use `await` nas chamadas: é disparar e esquecer.
 * - Nunca manda PII. `props` carrega contador, flag e nome de plano — jamais
 *   nome, e-mail, CPF, telefone ou endereço.
 */

import { supabase } from './supabase';

export const EVENTOS = {
  // A métrica da aposta: "10 locadores usando o app duas vezes". O banco não
  // responde isso sozinho — `auth.users.last_sign_in_at` guarda só o último
  // login, então não dá para contar segunda sessão sem registrar cada uma.
  SESSAO_INICIADA: 'session_started',

  // Caminho até o primeiro valor
  IMOVEL_FORM_ABERTO: 'property_form_opened',
  IMOVEL_CRIADO: 'property_created',

  // Parede do Gratuito — os dois que o plano pede explicitamente
  LIMITE_ATINGIDO: 'plan_limit_hit',
  ASSINATURA_ABERTA: 'subscription_screen_opened',
};

// Cadastro não entra aqui de propósito: com a confirmação de e-mail ligada,
// `signUp()` volta sem sessão, e sem sessão a RLS (auth.uid() = user_id) recusa
// a escrita. Além disso o dado já existe em `auth.users.created_at`.

/**
 * Registra um evento. Dispare sem await.
 *
 * @param {string} evento  um valor de EVENTOS
 * @param {object} props   contadores e flags, sem PII
 */
export function track(evento, props = {}) {
  // Encadeado em vez de async/await para deixar explícito que ninguém espera.
  supabase.auth
    .getUser()
    .then(({ data }) => {
      const userId = data?.user?.id;

      // Sem sessão não há como satisfazer a RLS (auth.uid() = user_id), e um
      // evento anônimo não tem valor aqui: o que interessa é a trajetória de
      // uma conta na primeira sessão.
      if (!userId) return null;

      return supabase.from('app_events').insert({
        user_id: userId,
        event: evento,
        props,
      });
    })
    .then((resultado) => {
      if (resultado?.error) {
        console.warn('analytics: falha ao registrar', evento, resultado.error.message);
      }
    })
    .catch((erro) => {
      console.warn('analytics: falha ao registrar', evento, erro?.message);
    });
}
