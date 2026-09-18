/**
 * Serviço de In-App Purchase (IAP) — Apple App Store
 *
 * REGRA CENTRAL DESTE ARQUIVO: o app não decide qual plano o usuário tem.
 *
 * Tudo que acontece aqui termina numa chamada à Edge Function
 * `validate-iap-receipt`, que pergunta à Apple e grava o resultado. O celular
 * nunca calcula data de expiração nem escreve subscription_plan.
 *
 * O modelo anterior fazia `expira = compra + 30 dias` localmente, o que causava
 * três problemas: a Apple cobra por mês de calendário (não 30 dias), renovação
 * automática nunca era detectada (usuário pagava e caía para o plano grátis), e
 * qualquer um podia se dar premium editando a própria linha no banco.
 *
 * MIGRAÇÃO DE 18/09/2026 — de `expo-in-app-purchases` para `expo-iap`.
 *
 * O módulo antigo parou de acompanhar o SDK do Expo (peer `expo: *`, sem
 * release há anos) e não sobe no SDK 57, o que travava qualquer build novo.
 * `expo-iap` é StoreKit 2, e isso muda o que o app tem em mãos depois de uma
 * compra: em vez de um recibo base64 do app inteiro, vem uma transação já
 * verificada pelo StoreKit, com `id` (transactionId) e
 * `originalTransactionIdentifierIOS`.
 *
 * Por isso o que mandamos ao servidor agora é o `transactionId`, não o recibo.
 * O servidor consulta a App Store Server API por esse id — o mesmo caminho que
 * o cron `revalidate-subscriptions` e o webhook `appstore-notifications` já
 * usavam. O caminho por recibo (`verifyReceipt`) está depreciado pela Apple e
 * saiu de cena.
 *
 * Efeito colateral que era o objetivo: a compra passa a gravar
 * `subscription_original_transaction_id` no perfil. Sem essa coluna preenchida,
 * webhook e cron selecionam zero linhas — é o que deixou um assinante um mês
 * com premium de graça depois de cancelar.
 *
 * Nota: implementação iOS. Android ainda não tem compra habilitada.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

// Precisa bater com PRODUCT_TO_PLAN em supabase/functions/_shared/subscription.ts
const PRODUCT_IDS = {
  basic: 'com.kavicki.com.llord.subscription.basic.monthly',
  premium: 'com.kavicki.com.llord.subscription.premium.monthly',
};

let Iap = null;
let isModuleAvailable = false;
let iapInitialized = false;

// Assinaturas dos listeners do StoreKit, para não registrar em duplicidade.
let purchaseSubscriptionHandle = null;
let errorSubscriptionHandle = null;

// Promises da UI aguardando a confirmação de uma compra, por productId.
const pendingPurchases = new Map();

// Compra pode passar por "Ask to Buy" e demorar. Depois disso orientamos o
// usuário a usar "Restaurar compras" em vez de deixar a tela travada.
const PURCHASE_TIMEOUT_MS = 180_000;

/**
 * Importa o módulo nativo sob demanda. Ele não existe em Expo Go nem em builds
 * feitos antes de `expo-iap` entrar no projeto, e o import estático derrubaria
 * o app inteiro nesses casos — inclusive para o time, que roda em Expo Go.
 */
async function ensureModuleAvailable() {
  if (isModuleAvailable && Iap) return true;

  try {
    Iap = await import('expo-iap');
    isModuleAvailable = true;
    return true;
  } catch (error) {
    console.warn('IAP: Módulo nativo indisponível. É preciso um novo build:', error.message);
    isModuleAvailable = false;
    Iap = null;
    return false;
  }
}

/**
 * Manda a transação para o servidor validar com a Apple.
 *
 * `transactionId` é o `id` de um objeto Purchase do StoreKit 2. Omiti-lo é um
 * uso legítimo: pede ao servidor para revalidar o vínculo que ele já guardou
 * (`subscription_original_transaction_id`), que é como conferimos renovação sem
 * envolver o StoreKit nem pedir senha ao usuário.
 */
async function validateWithServer(transactionId = null) {
  try {
    const { data, error } = await supabase.functions.invoke('validate-iap-receipt', {
      body: transactionId ? { transactionId } : {},
    });

    if (error) {
      // FunctionsHttpError guarda o corpo da resposta; sem ler isso, todo erro
      // do servidor vira "Edge Function returned a non-2xx status code".
      let detail = error.message;
      try {
        const body = await error.context?.json?.();
        if (body?.error) detail = body.error;
      } catch { /* corpo não era JSON */ }

      console.error('IAP: Validação no servidor falhou:', detail);
      return { success: false, error: detail };
    }

    console.log('IAP: Servidor confirmou:', data?.reason);
    return { success: true, ...data };
  } catch (error) {
    console.error('IAP: Erro ao chamar validate-iap-receipt:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Tira a transação da fila do StoreKit.
 *
 * `isConsumable: false` — assinatura não se consome. Transação não finalizada é
 * reentregue pelo StoreKit a cada abertura do app, para sempre, então uma falha
 * aqui não perde dinheiro, só gera repetição.
 */
async function finishPurchase(purchase) {
  if (!Iap || !purchase) return;

  try {
    await Iap.finishTransaction({ purchase, isConsumable: false });
    console.log('IAP: Transação finalizada:', purchase.id);
  } catch (error) {
    // Já finalizada é um erro benigno e comum. Não propagar.
    console.warn('IAP: Erro ao finalizar transação (pode já estar finalizada):', error.message);
  }
}

/**
 * Processa uma compra confirmada: valida no servidor e só então finaliza.
 *
 * A ordem importa. Finalizar antes de validar perderia a compra para sempre se
 * a validação falhasse — a Apple não reentrega uma transação finalizada.
 */
async function processPurchase(purchase) {
  const result = await validateWithServer(purchase.id);

  if (!result.success) {
    // Deixamos a transação NA FILA de propósito. O StoreKit vai reentregar na
    // próxima abertura do app e tentamos de novo, então uma falha de rede na
    // hora da compra não custa o plano de quem pagou.
    throw new Error(result.error || 'Não foi possível validar a compra');
  }

  await finishPurchase(purchase);
  return result;
}

/**
 * Listeners globais de compra e de erro.
 *
 * O de compra recebe tanto as compras iniciadas pelo usuário quanto as
 * RENOVAÇÕES automáticas e transações não finalizadas de sessões anteriores,
 * sempre que o app estiver aberto. É o caminho mais rápido de detectar
 * renovação; a varredura horária no servidor cobre quem não abre o app.
 *
 * Diferença para o módulo antigo: lá havia um `setPurchaseListener` único, que
 * recebia sucesso, cancelamento e erro no mesmo callback, separados por
 * `responseCode`. Aqui são dois listeners distintos, e cada um devolve um
 * handle que precisa ser removido — registrar de novo sem remover duplica
 * eventos, e uma compra seria validada duas vezes.
 */
function configureListeners() {
  if (!Iap) return;

  purchaseSubscriptionHandle?.remove?.();
  errorSubscriptionHandle?.remove?.();

  purchaseSubscriptionHandle = Iap.purchaseUpdatedListener(async (purchase) => {
    console.log('IAP: Compra recebida:', purchase.productId, purchase.purchaseState);

    // "Ask to Buy": aguarda aprovação de um responsável. A compra pode chegar
    // horas depois, por este mesmo listener, com o app aberto.
    if (purchase.purchaseState === 'pending') {
      console.log('IAP: Compra aguardando aprovação (deferred)');
      const waiting = pendingPurchases.get(purchase.productId);
      if (waiting) {
        waiting.resolve({ success: false, deferred: true });
        pendingPurchases.delete(purchase.productId);
      }
      return;
    }

    const pending = pendingPurchases.get(purchase.productId);

    try {
      const result = await processPurchase(purchase);

      if (pending) {
        pending.resolve({ success: true, purchase, plan: result.plan });
        pendingPurchases.delete(purchase.productId);
      } else {
        // Sem promise de UI: é uma renovação automática ou uma transação
        // pendente entregue na abertura do app. Já foi gravada no banco.
        console.log('IAP: Compra processada em background (renovação ou pendência).');
      }
    } catch (error) {
      console.error('IAP: Falha ao processar compra:', error.message);
      if (pending) {
        pending.reject({ success: false, error: error.message });
        pendingPurchases.delete(purchase.productId);
      }
    }
  });

  errorSubscriptionHandle = Iap.purchaseErrorListener((error) => {
    // 'user-cancelled' é o código do OpenIAP. No módulo antigo isso era
    // IAPResponseCode.USER_CANCELED, e a grafia com dois L resolvia para
    // undefined — o cancelamento não casava com nenhum ramo e a tela ficava
    // esperando uma promise que nunca resolvia.
    const cancelled = error?.code === 'user-cancelled';

    if (cancelled) {
      console.log('IAP: Compra cancelada pelo usuário');
    } else {
      console.error('IAP: Erro na compra:', error?.code, error?.message);
    }

    // O erro pode ou não trazer o productId. Sem ele, não há como saber qual
    // compra falhou, então encerramos todas as que estavam esperando.
    const targets = error?.productId && pendingPurchases.has(error.productId)
      ? [error.productId]
      : Array.from(pendingPurchases.keys());

    targets.forEach((productId) => {
      const pending = pendingPurchases.get(productId);
      pendingPurchases.delete(productId);
      if (!pending) return;
      pending.reject(
        cancelled
          ? { success: false, cancelled: true, error: 'Compra cancelada' }
          : { success: false, error: describeErrorCode(error?.code) }
      );
    });
  });

  console.log('IAP: Listeners configurados');
}

/**
 * Inicializa a conexão com a App Store. Chamado uma vez, na abertura do app.
 */
export async function initializeIAP() {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'IAP disponível apenas para iOS' };
  }

  const moduleAvailable = await ensureModuleAvailable();
  if (!moduleAvailable) {
    return { success: false, error: 'Módulo nativo não disponível. Faça um novo build.' };
  }

  if (iapInitialized) {
    configureListeners();
    return { success: true };
  }

  // Os listeners precisam existir ANTES de conectar: ao conectar, o StoreKit
  // entrega imediatamente as transações pendentes, e sem listener elas se
  // perdem.
  configureListeners();

  try {
    await Iap.initConnection();
    iapInitialized = true;
    console.log('IAP: Conectado à App Store');
    return { success: true };
  } catch (error) {
    if (error?.code === 'already-prepared') {
      iapInitialized = true;
      return { success: true };
    }
    console.error('IAP: Erro ao conectar:', error);
    return { success: false, error };
  }
}

export async function disconnectIAP() {
  if (!iapInitialized || !Iap) {
    return { success: true };
  }

  try {
    purchaseSubscriptionHandle?.remove?.();
    errorSubscriptionHandle?.remove?.();
    purchaseSubscriptionHandle = null;
    errorSubscriptionHandle = null;

    await Iap.endConnection();
    iapInitialized = false;
    console.log('IAP: Desconectado da App Store');
    return { success: true };
  } catch (error) {
    console.error('IAP: Erro ao desconectar:', error);
    return { success: false, error };
  }
}

/**
 * Busca os planos disponíveis na App Store.
 *
 * Em produção nunca devolvemos preços inventados: um botão de compra que não
 * funciona engana o usuário e é reprovado na revisão da Apple. Mocks só em
 * desenvolvimento.
 */
export async function getAvailableProducts() {
  const mockProducts = [
    { productId: PRODUCT_IDS.basic, title: 'Plano Básico', description: 'Até 10 imóveis',
      price: 'R$ 19,90', currency: 'BRL', localizedPrice: 'R$ 19,90' },
    { productId: PRODUCT_IDS.premium, title: 'Plano Premium', description: 'Imóveis ilimitados',
      price: 'R$ 39,90', currency: 'BRL', localizedPrice: 'R$ 39,90' },
  ];

  const devFallback = (warning) => {
    if (__DEV__) {
      console.warn('IAP: Usando produtos mockados —', warning);
      return { success: true, products: mockProducts, warning };
    }
    return { success: false, error: warning, products: [] };
  };

  if (Platform.OS !== 'ios') {
    return devFallback('IAP disponível apenas para iOS');
  }

  if (!(await ensureModuleAvailable())) {
    return devFallback('Serviço de assinatura indisponível. Atualize o aplicativo.');
  }

  if (!iapInitialized) {
    const init = await initializeIAP();
    if (!init.success) {
      return devFallback('Não foi possível conectar ao serviço de assinaturas.');
    }
  }

  try {
    // type 'subs': os dois produtos são assinaturas renováveis. Pedir 'in-app'
    // devolveria lista vazia sem erro nenhum.
    const results = await Iap.fetchProducts({
      skus: Object.values(PRODUCT_IDS),
      type: 'subs',
    });

    if (!results?.length) {
      if (__DEV__) return devFallback('Nenhum produto encontrado no App Store Connect');
      // Sucesso com lista vazia: a tela mostra os planos sem botão de compra,
      // em vez de exibir uma tela de erro.
      return { success: true, products: [], warning: 'Nenhum plano disponível no momento.' };
    }

    // No StoreKit 2 o identificador do produto é `id`, e o preço já vem
    // formatado na moeda da loja do usuário em `displayPrice`.
    const products = results.map((product) => ({
      productId: product.id,
      title: product.displayNameIOS || product.title || '',
      description: product.description || '',
      price: product.displayPrice || '',
      currency: product.currency || 'BRL',
      localizedPrice: product.displayPrice || '',
    }));

    console.log('IAP: Produtos carregados:', products.map((p) => p.productId));
    return { success: true, products };
  } catch (error) {
    console.error('IAP: Erro ao buscar produtos:', error);
    return devFallback('Não foi possível carregar os planos. Verifique sua conexão.');
  }
}

/**
 * Inicia a compra de uma assinatura.
 *
 * Resolve quando o listener confirmar E o servidor validar a transação. O
 * retorno de `requestPurchase` não serve para saber o resultado — a própria
 * documentação do módulo diz para não confiar nele; o que vale é o evento.
 *
 * Não existe polling com histórico de compras aqui. No módulo antigo essa
 * chamada era, no nativo, `restoreCompletedTransactions()`: abria o diálogo de
 * senha e finalizava TODAS as transações da fila. Rodando a cada 5s durante a
 * compra, podia finalizar a transação em andamento antes de o plano ser
 * gravado — o usuário pagava e não recebia nada.
 */
export async function purchaseSubscription(productId) {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'IAP disponível apenas para iOS' };
  }

  if (!(await ensureModuleAvailable())) {
    return { success: false, error: 'Módulo nativo não disponível. Faça um novo build.' };
  }

  if (!iapInitialized) {
    const init = await initializeIAP();
    if (!init.success) {
      return { success: false, error: 'Não foi possível inicializar o serviço de compras' };
    }
  }

  if (!Object.values(PRODUCT_IDS).includes(productId)) {
    return { success: false, error: 'Product ID inválido' };
  }

  // Dois toques no botão devem aguardar a mesma compra, não abrir duas.
  const existing = pendingPurchases.get(productId);
  if (existing?.promise) {
    console.log('IAP: Compra já em andamento para', productId);
    return existing.promise;
  }

  try {
    // O iOS exige que o produto tenha sido consultado antes da compra: o módulo
    // nativo só aceita comprar algo que esteja no cache de produtos.
    const catalog = await Iap.fetchProducts({
      skus: Object.values(PRODUCT_IDS),
      type: 'subs',
    });

    if (!catalog?.find((p) => p.id === productId)) {
      console.error('IAP: Produto não encontrado.', {
        buscado: productId,
        encontrados: catalog?.map((p) => p.id) ?? [],
      });
      return {
        success: false,
        error: 'Este plano não está disponível no momento. Tente novamente em alguns minutos.',
      };
    }

    let promise;
    promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingPurchases.delete(productId);
        reject({
          success: false,
          error: 'A compra está demorando mais que o esperado. Se o valor foi cobrado, '
            + 'use "Restaurar compras" para ativar seu plano.',
        });
      }, PURCHASE_TIMEOUT_MS);

      const settle = (fn) => (value) => {
        clearTimeout(timeout);
        fn(value);
      };

      // Registrado ANTES de comprar: o listener pode disparar imediatamente.
      pendingPurchases.set(productId, {
        resolve: settle(resolve),
        reject: settle(reject),
        promise,
      });

      Iap.requestPurchase({
        request: { apple: { sku: productId } },
        type: 'subs',
      }).catch((error) => {
        // Falha ao ABRIR a folha de pagamento. Erro depois disso chega pelo
        // purchaseErrorListener, não por aqui.
        console.error('IAP: Erro ao iniciar compra:', error);
        clearTimeout(timeout);
        pendingPurchases.delete(productId);
        reject({
          success: false,
          cancelled: error?.code === 'user-cancelled',
          error: describeErrorCode(error?.code),
        });
      });
    });

    return promise;
  } catch (error) {
    console.error('IAP: Erro ao comprar assinatura:', error);
    pendingPurchases.delete(productId);
    return { success: false, error: error.message };
  }
}

/**
 * Restaura compras anteriores. SEMPRE iniciado pelo usuário.
 *
 * `getAvailablePurchases` no iOS lê as transações da conta da App Store. A
 * Apple exige que exista este botão (guideline 3.1.1). O que não pode é chamar
 * isso em background, como a versão anterior fazia no Dashboard.
 */
export async function restorePurchases() {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'IAP disponível apenas para iOS' };
  }

  if (!(await ensureModuleAvailable())) {
    return { success: false, error: 'Módulo nativo não disponível. Faça um novo build.' };
  }

  if (!iapInitialized) {
    const init = await initializeIAP();
    if (!init.success) {
      return { success: false, error: 'Não foi possível inicializar o serviço de compras' };
    }
  }

  try {
    // onlyIncludeActiveItemsIOS: false — queremos ver também uma assinatura
    // expirada, porque é ela que dá ao servidor o originalTransactionId para
    // mapear o perfil. Uma assinatura cancelada mapeada volta a ser detectada
    // sozinha se a pessoa reassinar.
    const purchases = await Iap.getAvailablePurchases({
      onlyIncludeActiveItemsIOS: false,
    });

    if (!purchases?.length) {
      console.log('IAP: Nenhuma compra encontrada no histórico');
      return { success: true, plan: 'free', restored: false,
        message: 'Nenhuma assinatura encontrada nesta conta da App Store.' };
    }

    // A transação mais recente é a que descreve o estado atual da assinatura.
    // Qualquer uma do mesmo grupo levaria o servidor ao mesmo
    // originalTransactionId, mas a mais nova evita uma consulta a mais.
    const latest = purchases
      .filter((p) => p.id)
      .sort((a, b) => (b.transactionDate ?? 0) - (a.transactionDate ?? 0))[0];

    if (!latest) {
      return { success: true, plan: 'free', restored: false,
        message: 'Nenhuma assinatura encontrada nesta conta da App Store.' };
    }

    // Quem decide o que essa transação vale é o servidor.
    const result = await validateWithServer(latest.id);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Transações restauradas continuam na fila até serem finalizadas, e o
    // StoreKit as reentrega a cada abertura do app enquanto isso não acontecer.
    await finishPurchase(latest);

    return {
      success: true,
      restored: result.plan !== 'free',
      plan: result.plan,
      expiresAt: result.expiresAt,
      message: result.reason,
    };
  } catch (error) {
    console.error('IAP: Erro ao restaurar compras:', error);
    return { success: false, error: 'Não foi possível restaurar as compras.' };
  }
}

/**
 * Confere o estado da assinatura com o servidor.
 *
 * Não fala com o StoreKit: pede ao servidor para revalidar o vínculo já
 * guardado. Isso significa nenhum diálogo de senha, e funciona no Android e no
 * simulador.
 *
 * Não rebaixa ninguém por conta própria. Se o servidor não conseguir confirmar
 * (offline, sem vínculo guardado, Apple fora do ar), o plano atual é MANTIDO. O
 * comportamento anterior — rebaixar para grátis assim que a data local passava,
 * antes de qualquer confirmação — derrubava assinantes que tinham renovado
 * normalmente.
 *
 * @param {string} userId mantido por compatibilidade com as telas; o servidor
 *   identifica o usuário pelo JWT.
 * @returns {{success: boolean, synced: boolean, newPlan?: string, needsRestore?: boolean, reason: string}}
 */
export async function checkAndSyncSubscriptionStatus(userId, _forceAppleCheck = false) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', userId)
      .single();

    const previousPlan = profile?.subscription_plan ?? 'free';

    // Plano grátis não tem o que renovar nem expirar. Evita uma chamada de rede
    // a cada abertura do app para a maior parte da base.
    //
    // Não perdemos nada: uma assinatura nova é validada na hora da compra, e
    // uma feita em outro aparelho já aparece aqui, porque o plano vive no
    // perfil do Supabase (compartilhado), não no dispositivo.
    if (previousPlan === 'free') {
      return { success: true, synced: false, newPlan: 'free', reason: 'Plano gratuito' };
    }

    const result = await validateWithServer();

    if (!result.success) {
      // Sem vínculo guardado + plano pago = assinatura feita antes deste
      // sistema existir, ou cortesia concedida na mão. Não dá para confirmar
      // sozinho; a tela oferece "Restaurar compras". Até lá o acesso continua.
      const needsRestore = previousPlan !== 'free';

      console.log('IAP: Não foi possível confirmar com o servidor:', result.error);
      return {
        success: false,
        synced: false,
        needsRestore,
        reason: result.error || 'Não foi possível verificar a assinatura agora',
      };
    }

    const changed = result.plan !== previousPlan;

    return {
      success: true,
      synced: changed,
      newPlan: result.plan,
      currentPlan: result.plan,
      expiresAt: result.expiresAt,
      autoRenew: result.autoRenew,
      reason: result.reason,
    };
  } catch (error) {
    console.error('IAP: Erro ao sincronizar assinatura:', error);
    return { success: false, synced: false, reason: error.message };
  }
}

/**
 * Traduz códigos de erro do OpenIAP/StoreKit em mensagens para o usuário.
 *
 * Os códigos mudaram com a migração: o módulo antigo usava E_MISSING_PERMISSIONS
 * e E_ITEM_NOT_QUERIED; o OpenIAP usa strings em kebab-case.
 */
function describeErrorCode(errorCode) {
  const messages = {
    'user-cancelled': 'Compra cancelada',
    'item-unavailable': 'Este plano não está disponível no momento.',
    'sku-not-found': 'O plano não está carregado. Feche e abra a tela novamente.',
    'not-prepared': 'O serviço de compras ainda não está pronto. Tente novamente.',
    'already-owned': 'Você já assinou este plano. Use "Restaurar compras" para ativá-lo.',
    'network-error': 'Sem conexão com a App Store. Verifique sua internet.',
    'deferred-payment': 'A compra está aguardando aprovação de um responsável.',
    'transaction-validation-failed': 'Não foi possível confirmar a compra com a Apple.',
    'service-error': 'A App Store está indisponível no momento. Tente mais tarde.',
  };
  return messages[errorCode] || 'Não foi possível concluir a compra. Tente novamente.';
}

/** Mantido para as telas que já importam este helper. */
export function handlePurchaseError(error, responseCode) {
  return {
    success: false,
    message: describeErrorCode(error?.code),
    error,
    responseCode,
  };
}

export function getProductIdForPlan(plan) {
  return PRODUCT_IDS[plan] ?? null;
}
