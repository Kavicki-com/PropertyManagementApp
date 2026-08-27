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
 * Nota: implementação iOS. Android ainda não tem compra habilitada.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

// Precisa bater com PRODUCT_TO_PLAN em supabase/functions/_shared/appleSubscription.ts
const PRODUCT_IDS = {
  basic: 'com.kavicki.com.llord.subscription.basic.monthly',
  premium: 'com.kavicki.com.llord.subscription.premium.monthly',
};

let InAppPurchases = null;
let isModuleAvailable = false;
let iapInitialized = false;

// Promises da UI aguardando a confirmação de uma compra, por productId.
const pendingPurchases = new Map();

// Compra pode passar por "Ask to Buy" e demorar. Depois disso orientamos o
// usuário a usar "Restaurar compras" em vez de deixar a tela travada.
const PURCHASE_TIMEOUT_MS = 180_000;

/**
 * Importa o módulo nativo sob demanda. Ele não existe em Expo Go nem em builds
 * feitos antes de `expo-in-app-purchases` entrar no projeto, e o import
 * estático derrubaria o app inteiro nesses casos.
 */
async function ensureModuleAvailable() {
  if (isModuleAvailable && InAppPurchases) return true;

  try {
    InAppPurchases = await import('expo-in-app-purchases');
    isModuleAvailable = true;
    return true;
  } catch (error) {
    console.warn('IAP: Módulo nativo indisponível. É preciso um novo build:', error.message);
    isModuleAvailable = false;
    InAppPurchases = null;
    return false;
  }
}

/**
 * Manda o recibo para o servidor validar com a Apple.
 *
 * `receipt` é o recibo completo do app em base64. Ele vem no campo
 * `transactionReceipt` de qualquer objeto de compra do expo-in-app-purchases.
 * Omitir o recibo é um uso legítimo: pede ao servidor para revalidar o que ele
 * já guardou, que é como conferimos renovação sem envolver o StoreKit.
 */
async function validateWithServer(receipt = null) {
  try {
    const { data, error } = await supabase.functions.invoke('validate-iap-receipt', {
      body: receipt ? { receipt } : {},
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
 * O identificador correto é `orderId`. O código anterior procurava
 * `transactionId`/`transactionIdentifier`, que não existem neste módulo — então
 * nenhuma transação era finalizada e a Apple reentregava o mesmo evento a cada
 * abertura do app, para sempre.
 */
async function finishTransaction(purchase) {
  if (!InAppPurchases || !purchase) return;

  // O módulo já ignora compras marcadas como acknowledged (as vindas do
  // histórico já foram finalizadas pelo lado nativo).
  if (purchase.acknowledged) return;

  if (!purchase.orderId) {
    console.warn('IAP: Compra sem orderId, não é possível finalizar:', purchase.productId);
    return;
  }

  try {
    // consumeItem = false: assinatura não se consome.
    await InAppPurchases.finishTransactionAsync(purchase, false);
    console.log('IAP: Transação finalizada:', purchase.orderId);
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
  const result = await validateWithServer(purchase.transactionReceipt);

  if (!result.success) {
    // Deixamos a transação NA FILA de propósito. A Apple vai reentregar na
    // próxima abertura do app e tentamos de novo, então uma falha de rede na
    // hora da compra não custa o plano de quem pagou.
    throw new Error(result.error || 'Não foi possível validar a compra');
  }

  await finishTransaction(purchase);
  return result;
}

/**
 * Listener global de compras.
 *
 * Recebe tanto as compras iniciadas pelo usuário quanto as RENOVAÇÕES
 * automáticas e transações não finalizadas de sessões anteriores, sempre que o
 * app estiver aberto. É o caminho mais rápido de detectar renovação; a
 * varredura horária no servidor cobre quem não abre o app.
 */
function configurePurchaseListener() {
  if (!InAppPurchases) return;

  // setPurchaseListener remove o listener anterior internamente, então chamar
  // isto mais de uma vez não duplica eventos.
  InAppPurchases.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
    const { IAPResponseCode } = InAppPurchases;

    if (responseCode === IAPResponseCode.OK && results?.length > 0) {
      for (const purchase of results) {
        console.log('IAP: Compra recebida:', purchase.productId);
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
      }
      return;
    }

    // USER_CANCELED tem um L só. A grafia anterior (USER_CANCELLED) resolvia
    // para undefined, então o cancelamento não casava com nenhum ramo e a tela
    // ficava travada esperando uma promise que nunca resolvia.
    if (responseCode === IAPResponseCode.USER_CANCELED) {
      console.log('IAP: Compra cancelada pelo usuário');
      pendingPurchases.forEach((pending) => {
        pending.reject({ success: false, cancelled: true, error: 'Compra cancelada' });
      });
      pendingPurchases.clear();
      return;
    }

    if (responseCode === IAPResponseCode.DEFERRED) {
      // "Ask to Buy": aguarda aprovação de um responsável. A compra pode
      // chegar horas depois, pelo listener, com o app aberto.
      console.log('IAP: Compra aguardando aprovação (deferred)');
      pendingPurchases.forEach((pending) => {
        pending.resolve({ success: false, deferred: true });
      });
      pendingPurchases.clear();
      return;
    }

    console.error('IAP: Erro na compra. errorCode:', errorCode);
    pendingPurchases.forEach((pending) => {
      pending.reject({ success: false, error: describeErrorCode(errorCode) });
    });
    pendingPurchases.clear();
  });

  console.log('IAP: Purchase listener configurado');
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
    configurePurchaseListener();
    return { success: true };
  }

  // O listener precisa existir ANTES de conectar: ao conectar, o StoreKit
  // entrega imediatamente as transações pendentes, e sem listener elas se
  // perdem.
  configurePurchaseListener();

  try {
    await InAppPurchases.connectAsync();
    iapInitialized = true;
    console.log('IAP: Conectado à App Store');
    return { success: true };
  } catch (error) {
    if (error?.message?.includes('Already connected')) {
      iapInitialized = true;
      return { success: true };
    }
    console.error('IAP: Erro ao conectar:', error);
    return { success: false, error };
  }
}

export async function disconnectIAP() {
  if (!iapInitialized || !InAppPurchases) {
    return { success: true };
  }

  try {
    await InAppPurchases.disconnectAsync();
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
    const productIds = Object.values(PRODUCT_IDS);
    const { responseCode, results } = await InAppPurchases.getProductsAsync(productIds);

    if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
      return devFallback(`Erro ao buscar produtos (código ${responseCode})`);
    }

    if (!results?.length) {
      if (__DEV__) return devFallback('Nenhum produto encontrado no App Store Connect');
      // Sucesso com lista vazia: a tela mostra os planos sem botão de compra,
      // em vez de exibir uma tela de erro.
      return { success: true, products: [], warning: 'Nenhum plano disponível no momento.' };
    }

    const products = results.map((product) => ({
      productId: product.productId,
      title: product.title || '',
      description: product.description || '',
      price: product.price || '',
      currency: product.currencyCode || 'BRL',
      localizedPrice: product.localizedPrice || product.price || '',
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
 * Resolve quando o listener confirmar E o servidor validar o recibo.
 *
 * Diferença importante para a versão anterior: não existe mais polling com
 * getPurchaseHistoryAsync. Aquela chamada é, no nativo,
 * `restoreCompletedTransactions()` — ela abre o diálogo de senha da App Store e
 * finaliza TODAS as transações da fila. Rodando a cada 5s durante a compra, ela
 * podia finalizar a transação em andamento antes de o plano ser gravado, ou
 * seja, o usuário pagava e não recebia nada.
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
    const { responseCode, results } = await InAppPurchases.getProductsAsync(
      Object.values(PRODUCT_IDS)
    );

    if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
      return { success: false, error: 'Não foi possível consultar os planos. Tente novamente.' };
    }

    if (!results?.find((p) => p.productId === productId)) {
      console.error('IAP: Produto não encontrado.', {
        buscado: productId,
        encontrados: results?.map((p) => p.productId) ?? [],
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

      InAppPurchases.purchaseItemAsync(productId).catch((error) => {
        // Falha ao ABRIR a folha de pagamento. Erro depois disso chega pelo
        // listener, não por aqui.
        console.error('IAP: Erro ao iniciar compra:', error);
        clearTimeout(timeout);
        pendingPurchases.delete(productId);
        reject({ success: false, error: describeErrorCode(error?.code) });
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
 * Usa getPurchaseHistoryAsync, que no iOS abre o diálogo de login da App Store.
 * É aceitável aqui porque o usuário pediu explicitamente — e a Apple exige que
 * exista este botão (guideline 3.1.1). O que não pode é chamar isso em
 * background, como a versão anterior fazia no Dashboard.
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
    const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

    if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
      return { success: false, error: 'Não foi possível consultar suas compras. Tente novamente.' };
    }

    // O recibo é do APP inteiro, não de uma transação: qualquer item do
    // histórico carrega o histórico completo de assinaturas. Basta um.
    const receipt = results?.find((p) => p.transactionReceipt)?.transactionReceipt;

    if (!receipt) {
      console.log('IAP: Nenhuma compra encontrada no histórico');
      return { success: true, plan: 'free', restored: false,
        message: 'Nenhuma assinatura encontrada nesta conta da App Store.' };
    }

    // Quem decide o que esse recibo vale é o servidor.
    const result = await validateWithServer(receipt);

    if (!result.success) {
      return { success: false, error: result.error };
    }

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
 * Não fala com o StoreKit: pede ao servidor para revalidar o recibo já
 * guardado. Isso significa nenhum diálogo de senha, e funciona no Android e no
 * simulador.
 *
 * Não rebaixa ninguém por conta própria. Se o servidor não conseguir confirmar
 * (offline, sem recibo guardado, Apple fora do ar), o plano atual é MANTIDO. O
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
      // Sem recibo guardado + plano pago = assinatura feita antes deste sistema
      // existir. Não dá para confirmar sozinho; a tela oferece "Restaurar
      // compras". Até lá o acesso continua.
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

/** Traduz códigos de erro do StoreKit em mensagens para o usuário. */
function describeErrorCode(errorCode) {
  const messages = {
    E_MISSING_PERMISSIONS: 'Este dispositivo não está autorizado a fazer compras. '
      + 'Verifique as restrições em Ajustes > Tempo de Uso.',
    E_ITEM_NOT_QUERIED: 'O plano não está carregado. Feche e abra a tela novamente.',
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
