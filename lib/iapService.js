/**
 * Serviço de In-App Purchase (IAP)
 * Integração com Apple App Store para assinaturas usando expo-in-app-purchases
 * 
 * Nota: Implementação para iOS. Android será adicionado posteriormente.
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

// Product IDs configurados no App Store Connect
const PRODUCT_IDS = {
  basic: 'com.kavicki.com.llord.subscription.basic.monthly', // R$ 19,90/mês
  premium: 'com.kavicki.com.llord.subscription.premium.monthly', // R$ 39,90/mês
};

let iapInitialized = false;
let listenerConfigured = false;
// Gerenciamento de promises pendentes para compras
const pendingPurchases = new Map();
let InAppPurchases = null;
let isModuleAvailable = false;
// Flag para prevenir chamadas simultâneas ao histórico de compras
let isCheckingHistory = false;

// Flag REMOVIDA: Sandbox durations agora são controladas APENAS por __DEV__.
// Em produção (TestFlight / App Store), sempre usa 30 dias.
// Apenas em desenvolvimento (__DEV__) usa 5 minutos.

/**
 * Converte uma data para string no formato ISO mas com timezone local (BRT)
 * Isso garante que as datas no banco apareçam no horário do Brasil, não UTC
 */
function toLocalISOString(date) {
  // Always use the standard ISO String with 'Z' so Supabase (Postgres) can correctly
  // interpret it as a UTC timestamp and store it correctly without shifting it to the past
  return date.toISOString();
}

const RECONNECT_INTERVAL = 3000;
const POLLING_INTERVAL = 5000; // Aumentado para 5s para evitar congestionamento do Native Module
const POLLING_MAX_ATTEMPTS = 60; // 5 minutos

// Controle de concorrência para polling
let isPolling = false;
let pollingAbortController = null;

/**
 * Helper para garantir que a data do Supabase (timestamp sem timezone) seja interpretada como UTC
 */
function parseSupabaseDate(dateString) {
  if (!dateString) return null;
  if (!dateString.endsWith('Z') && !dateString.includes('+') && dateString.length <= 23) {
    return new Date(dateString + 'Z');
  }
  return new Date(dateString);
}

/**
 * Verifica se o módulo nativo está disponível
 * Importa dinamicamente para evitar crash se não estiver disponível
 */
async function ensureModuleAvailable() {

  try {
    // Importação dinâmica para verificar se o módulo está disponível
    const module = await import('expo-in-app-purchases');
    InAppPurchases = module;
    isModuleAvailable = true;
    return true;
  } catch (error) {
    console.warn('IAP: Módulo nativo não disponível. Faça um novo build de desenvolvimento:', error.message);
    isModuleAvailable = false;
    InAppPurchases = null;
    return false;
  }
}

/**
 * Verifica se o IAP está disponível (módulo nativo + plataforma correta)
 */
function isIAPAvailable() {
  return Platform.OS === 'ios' && isModuleAvailable;
}

/**
 * Inicializa conexão com App Store
 * Deve ser chamado quando o app inicia (apenas iOS)
 */
export async function initializeIAP() {
  // IAP só funciona em iOS por enquanto
  if (Platform.OS !== 'ios') {
    console.log('IAP: Disponível apenas para iOS');
    return { success: false, error: 'IAP disponível apenas para iOS' };
  }

  // Verifica se o módulo nativo está disponível
  const moduleAvailable = await ensureModuleAvailable();
  if (!moduleAvailable) {
    return {
      success: false,
      error: 'Módulo nativo não disponível. Faça um novo build de desenvolvimento incluindo expo-in-app-purchases.'
    };
  }

  if (iapInitialized) {
    // Mesmo se já inicializado, garante que o listener está configurado
    ensurePurchaseListener();
    return { success: true };
  }

  // CRÍTICO: Configura listener ANTES de conectar para não perder eventos iniciais
  ensurePurchaseListener();

  try {
    await InAppPurchases.connectAsync();
    iapInitialized = true;
    console.log('IAP: Conexão estabelecida com App Store');

    // Tenta limpar transações travadas no arranque
    // Isso ajuda a evitar que o app comece travado se houve crash anterior
    // DESATIVADO TEMPORARIAMENTE: Pode causar conflito (Native Module Busy) se o usuário tentar comprar logo em seguida
    // cleanUpStuckTransactions().catch(e => console.error('IAP: Erro no cleanup inicial:', e));

    return { success: true };
  } catch (error) {
    // Se já estiver conectado, consideramos sucesso
    if (error && error.message && error.message.includes('Already connected')) {
      console.log('IAP: Já conectado ao App Store (ignorando erro)');
      iapInitialized = true;
      return { success: true };
    }

    console.error('Erro ao inicializar IAP:', error);
    return { success: false, error };
  }
}

/**
 * Garante que o listener está configurado
 * Força a reconfiguração se necessário
 */
function ensurePurchaseListener() {
  if (!InAppPurchases) {
    console.warn('IAP: Módulo não disponível para configurar listener');
    return;
  }

  // FORÇAR reconfiguração do listener a cada chamada para garantir que está ativo
  // Isso resolve casos onde o listener pode ter sido perdido
  // if (listenerConfigured) {
  //   console.log('IAP: Listener já configurado, reforçando...');
  // }

  console.log('IAP: Configurando purchase listener...');

  // setPurchaseListener retorna void, então usamos um flag separado
  InAppPurchases.setPurchaseListener(async ({ responseCode, results, errorCode }) => {
    console.log('IAP: ======= EVENTO DE COMPRA RECEBIDO =======');
    console.log('IAP: responseCode:', responseCode);
    console.log('IAP: results:', JSON.stringify(results, null, 2));
    console.log('IAP: errorCode:', errorCode);
    console.log('IAP: pendingPurchases size:', pendingPurchases.size);
    console.log('IAP: pendingPurchases keys:', Array.from(pendingPurchases.keys()));

    if (responseCode === InAppPurchases.IAPResponseCode.OK && results && results.length > 0) {
      // Processa cada compra bem-sucedida
      for (const purchase of results) {
        console.log('IAP: Compra confirmada:', purchase.productId);

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            console.log('IAP: Atualizando banco de dados no background para o usuário:', user.id);
            // Chama handlePurchaseSuccess obrigatoriamente antes de tentar resolver a Promise da UI
            const updateResult = await handlePurchaseSuccess(purchase, user.id);
            if (!updateResult.success) {
              throw new Error(updateResult.error || 'Erro ao atualizar banco de dados');
            }
            console.log('IAP: Banco atualizado com sucesso no background e transação finalizada.');
          } else {
            throw new Error('Usuário não autenticado');
          }
        } catch (error) {
          console.error('IAP: Erro Crítico ao processar compra no background:', error);
          
          // Rejeita a promise da UI se existir
          const pendingPurchase = pendingPurchases.get(purchase.productId);
          if (pendingPurchase) {
            pendingPurchase.reject({ success: false, error: error.message });
            pendingPurchases.delete(purchase.productId);
          }
          continue; // Pula para a próxima compra sem resolver sucesso
        }

        // Tenta encontrar promise pendente pelo productId exato
        let pendingPurchase = pendingPurchases.get(purchase.productId);

        // Se não encontrou pelo productId exato, tenta resolver qualquer promise pendente
        // Isso é importante para upgrades onde o productId pode ser diferente
        if (!pendingPurchase && pendingPurchases.size > 0) {
          console.log('IAP: Não encontrou promise para productId específico, tentando primeira pendente...');
          const firstKey = pendingPurchases.keys().next().value;
          pendingPurchase = pendingPurchases.get(firstKey);
          if (pendingPurchase) {
            console.log('IAP: Resolvendo promise pendente (fallback) para:', firstKey);
            pendingPurchase.resolve({ success: true, purchase });
            pendingPurchases.delete(firstKey);
          }
        } else if (pendingPurchase) {
          console.log('IAP: Resolvendo promise pendente para:', purchase.productId);
          pendingPurchase.resolve({ success: true, purchase });
          pendingPurchases.delete(purchase.productId);
        } else {
          console.log('IAP: A compra foi processada com sucesso no background (sem Promise de UI pendente).');
        }
      }
    } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELLED) {
      console.log('IAP: ❌ Usuário cancelou a compra');
      console.log('IAP: Limpando', pendingPurchases.size, 'promise(s) pendente(s)...');
      // Rejeita e LIMPA todas as promises pendentes
      const pendingProductIds = Array.from(pendingPurchases.keys());
      pendingPurchases.forEach((pending, productId) => {
        console.log('IAP: Rejeitando promise pendente para:', productId);
        pending.reject({
          success: false,
          cancelled: true,
          error: handlePurchaseError(null, InAppPurchases.IAPResponseCode.USER_CANCELLED)
        });
      });
      // Limpa TODAS as promises pendentes após rejeição
      pendingPurchases.clear();
      console.log('IAP: ✅ Promises pendentes limpas:', pendingProductIds.join(', '));
    } else if (responseCode === InAppPurchases.IAPResponseCode.ERROR) {
      console.error('IAP: ❌ Erro na compra', errorCode);
      console.log('IAP: Limpando', pendingPurchases.size, 'promise(s) pendente(s)...');
      // Rejeita e LIMPA todas as promises pendentes
      const pendingProductIds = Array.from(pendingPurchases.keys());
      pendingPurchases.forEach((pending, productId) => {
        console.log('IAP: Rejeitando promise pendente para:', productId);
        pending.reject({
          success: false,
          error: handlePurchaseError(null, InAppPurchases.IAPResponseCode.ERROR)
        });
      });
      // Limpa TODAS as promises pendentes após rejeição
      pendingPurchases.clear();
      console.log('IAP: ✅ Promises pendentes limpas:', pendingProductIds.join(', '));
    } else if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
      console.log('IAP: Compra aguardando aprovação (deferred)');
      // Para compras deferred, não resolvemos ainda
    }
  });

  listenerConfigured = true;
  console.log('IAP: Purchase listener configurado com sucesso');
}

/**
 * Desconecta do App Store
 * Deve ser chamado quando o app fecha ou quando não precisar mais do IAP
 */
export async function disconnectIAP() {
  if (!iapInitialized || !InAppPurchases) {
    return { success: true };
  }

  try {
    if (purchaseListener) {
      // Remove o listener se possível
      purchaseListener = null;
    }
    await InAppPurchases.disconnectAsync();
    iapInitialized = false;
    console.log('IAP: Desconectado do App Store');
    return { success: true };
  } catch (error) {
    console.error('Erro ao desconectar IAP:', error);
    return { success: false, error };
  }
}

/**
 * Busca produtos disponíveis (planos) no App Store
 * 
 * Comportamento:
 * - Desenvolvimento (__DEV__): Retorna produtos mockados para facilitar testes de UI
 * - Produção: Retorna apenas produtos reais da Apple. Se falhar, retorna success: false
 *   para não enganar usuários/revisores com botões de compra que não funcionam.
 */
export async function getAvailableProducts() {
  // Produtos mockados para desenvolvimento
  const mockProducts = [
    {
      productId: PRODUCT_IDS.basic,
      title: 'Plano Básico',
      description: 'Até 10 imóveis',
      price: 'R$ 19,90',
      currency: 'BRL',
      localizedPrice: 'R$ 19,90',
    },
    {
      productId: PRODUCT_IDS.premium,
      title: 'Plano Premium',
      description: 'Ilimitado imóveis',
      price: 'R$ 39,90',
      currency: 'BRL',
      localizedPrice: 'R$ 39,90',
    },
  ];

  // Se não for iOS, retorna mockados apenas em dev
  if (Platform.OS !== 'ios') {
    if (__DEV__) {
      console.log('IAP: Retornando produtos mockados (não-iOS em desenvolvimento)');
      return { success: true, products: mockProducts };
    }
    return {
      success: false,
      error: 'IAP disponível apenas para iOS',
      products: []
    };
  }

  // Verifica se o módulo está disponível
  const moduleAvailable = await ensureModuleAvailable();
  if (!moduleAvailable) {
    if (__DEV__) {
      console.warn('IAP: Módulo não disponível, retornando produtos mockados (desenvolvimento)');
      return { success: true, products: mockProducts };
    }
    console.error('IAP: Módulo nativo não disponível em produção');
    return {
      success: false,
      error: 'Serviço de assinatura indisponível. Por favor, atualize o aplicativo ou tente novamente mais tarde.',
      products: []
    };
  }

  // Inicializa IAP se necessário
  if (!iapInitialized) {
    const initResult = await initializeIAP();
    if (!initResult.success) {
      if (__DEV__) {
        console.warn('IAP: Falha ao inicializar, retornando produtos mockados (desenvolvimento)');
        return { success: true, products: mockProducts };
      }
      console.error('IAP: Falha ao inicializar em produção');
      return {
        success: false,
        error: 'Não foi possível conectar ao serviço de assinaturas. Verifique sua conexão e tente novamente.',
        products: []
      };
    }
  }

  try {
    const productIds = Object.values(PRODUCT_IDS);
    console.log('IAP: Buscando produtos:', productIds);

    const { responseCode, results } = await InAppPurchases.getProductsAsync(productIds);

    console.log('IAP: Resposta ao buscar produtos:', {
      responseCode,
      resultsCount: results?.length || 0,
      productIds: results?.map(p => p.productId) || []
    });

    if (responseCode === InAppPurchases.IAPResponseCode.OK) {
      if (!results || results.length === 0) {
        console.warn('IAP: Nenhum produto encontrado no App Store');
        if (__DEV__) {
          console.warn('IAP: Retornando produtos mockados (desenvolvimento)');
          return {
            success: true,
            products: mockProducts,
            warning: 'Produtos não encontrados no App Store. Verifique se estão configurados corretamente.',
          };
        }
        // Em produção, retorna lista vazia com sucesso para não quebrar a UI,
        // mas sem produtos para comprar
        return {
          success: true,
          products: [],
          warning: 'Nenhum plano disponível no momento. Tente novamente mais tarde.',
        };
      }

      // Mapeia produtos para formato esperado pela UI
      const products = results.map((product) => ({
        productId: product.productId,
        title: product.title || '',
        description: product.description || '',
        price: product.price || '',
        currency: product.currencyCode || 'BRL',
        localizedPrice: product.localizedPrice || product.price || '',
      }));

      console.log('IAP: Produtos carregados com sucesso:', products);
      return { success: true, products };
    } else {
      console.error('IAP: Erro ao buscar produtos, responseCode:', responseCode);
      let errorMessage = `Erro ao buscar produtos (código: ${responseCode})`;

      if (responseCode === InAppPurchases.IAPResponseCode.UNAVAILABLE) {
        errorMessage = 'Serviço de assinaturas temporariamente indisponível.';
      }

      if (__DEV__) {
        console.warn('IAP: Retornando produtos mockados após erro (desenvolvimento)');
        return {
          success: true,
          products: mockProducts,
          warning: errorMessage,
        };
      }

      // Em produção, retorna erro
      return {
        success: false,
        error: errorMessage,
        products: [],
      };
    }
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);

    if (__DEV__) {
      console.warn('IAP: Retornando produtos mockados após exceção (desenvolvimento)');
      return {
        success: true,
        products: mockProducts,
        warning: 'Erro ao buscar produtos do App Store (desenvolvimento).',
      };
    }

    // Em produção, retorna erro
    return {
      success: false,
      error: 'Não foi possível carregar os planos. Verifique sua conexão e tente novamente.',
      products: [],
    };
  }
}

/**
 * Inicia compra de assinatura
 * Retorna uma Promise que resolve quando a compra for confirmada pelo listener
 * 
 * IMPORTANTE: Consulta os produtos antes de comprar (requisito do iOS)
 */
export async function purchaseSubscription(productId) {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'IAP disponível apenas para iOS' };
  }

  // Verifica se o módulo está disponível
  const moduleAvailable = await ensureModuleAvailable();
  if (!moduleAvailable || !InAppPurchases) {
    return {
      success: false,
      error: 'Módulo nativo não disponível. Faça um novo build de desenvolvimento incluindo expo-in-app-purchases.'
    };
  }

  if (!iapInitialized) {
    const initResult = await initializeIAP();
    if (!initResult.success) {
      return { success: false, error: 'Não foi possível inicializar IAP' };
    }
  }

  // CRÍTICO: Sempre garante que o listener está configurado ANTES da compra
  // Isso resolve o warning "no listeners registered"
  console.log('IAP: Garantindo que listener está ativo antes da compra...');
  ensurePurchaseListener();
  // Delay curto (250ms) para garantir registro no módulo nativo e evitar "no listeners registered"
  await new Promise(r => setTimeout(r, 250));
  console.log('IAP: Listener ativo, prosseguindo com compra...');

  try {
    // Verifica se o productId é válido
    if (!Object.values(PRODUCT_IDS).includes(productId)) {
      return { success: false, error: 'Product ID inválido' };
    }

    // PROTEÇÃO: Verifica se já existe uma compra pendente para este produto
    // Se sim, retorna a promise existente ao invés de criar uma nova
    const existingPurchase = pendingPurchases.get(productId);
    if (existingPurchase && existingPurchase.promise) {
      console.log('IAP: ⚠️ Já existe uma compra em andamento para:', productId);
      console.log('IAP: Aguardando compra existente ao invés de iniciar nova...');
      return existingPurchase.promise;
    }

    // IMPORTANTE: Consulta os produtos antes de comprar (requisito do iOS)
    // Isso garante que o produto esteja disponível e carregado
    console.log('IAP: Consultando produtos antes da compra...');
    console.log('IAP: Product IDs buscados:', Object.values(PRODUCT_IDS));
    console.log('IAP: Product ID da compra:', productId);

    const productIds = Object.values(PRODUCT_IDS);
    const { responseCode, results } = await InAppPurchases.getProductsAsync(productIds);

    console.log('IAP: Resposta da consulta:', { responseCode, resultsCount: results?.length || 0 });

    if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
      let errorMessage = `Erro ao consultar produtos (código: ${responseCode})`;

      // Mensagens mais específicas baseadas no código de resposta
      if (responseCode === InAppPurchases.IAPResponseCode.UNAVAILABLE) {
        errorMessage = 'Produtos não disponíveis. Verifique se os produtos estão configurados e aprovados no App Store Connect.';
      } else if (responseCode === InAppPurchases.IAPResponseCode.ERROR) {
        errorMessage = 'Erro ao consultar produtos. Verifique sua conexão e tente novamente.';
      }

      console.error('IAP: Erro na consulta:', { responseCode, errorMessage });
      return {
        success: false,
        error: errorMessage,
        responseCode
      };
    }

    // Log dos produtos encontrados para debug
    if (results && results.length > 0) {
      console.log('IAP: Produtos encontrados:', results.map(p => p.productId));
    } else {
      console.warn('IAP: Nenhum produto encontrado na resposta');
    }

    // Verifica se o produto específico está disponível
    const product = results && results.length > 0
      ? results.find(p => p.productId === productId)
      : null;

    if (!product) {
      const foundProductIds = results?.map(p => p.productId) || [];
      const errorMessage = `Produto ${productId} não encontrado ou não disponível. 
      
Produtos configurados: ${productIds.join(', ')}
Produtos encontrados: ${foundProductIds.length > 0 ? foundProductIds.join(', ') : 'Nenhum'}

Possíveis causas:
- O produto não está configurado no App Store Connect
- O produto não está aprovado/disponível ainda
- Aguarde alguns minutos para a Apple propagar os produtos no ambiente sandbox
- Verifique se está usando o Product ID correto`;

      console.error('IAP: Produto não encontrado:', {
        buscado: productId,
        encontrados: foundProductIds,
        configurados: productIds
      });

      return {
        success: false,
        error: errorMessage,
        productId,
        foundProducts: foundProductIds,
        configuredProducts: productIds
      };
    }

    console.log('IAP: Produto consultado com sucesso:', {
      productId: product.productId,
      title: product.title,
      price: product.localizedPrice || product.price
    });

    // Inicia a compra e aguarda confirmação via listener + polling
    // CORREÇÃO Bug #2: usar 'let' para que purchasePromise possa ser referenciada
    // dentro do próprio construtor da Promise sem problema de TDZ (temporal dead zone)
    let purchasePromise;
    purchasePromise = new Promise((resolve, reject) => {
      let purchaseCompleted = false;
      let pollingAttempts = 0;
      const maxPollingAttempts = 20; // 20 tentativas x 2s = 40 segundos
      let pollingInterval = null;

      // CRÍTICO: Registra a promise pendente ANTES de iniciar a compra
      // Isso permite que o listener resolva a promise quando o evento chegar
      pendingPurchases.set(productId, { resolve, reject, promise: purchasePromise });
      console.log('IAP: Promise pendente registrada para:', productId);

      // Função de polling para verificar histórico
      const purchaseStartTime = Date.now(); // Marca quando iniciou a compra

      const pollPurchaseHistory = async () => {
        // Prevenir chamadas simultâneas que causam "Must wait for promise"
        if (isCheckingHistory) {
          console.log('IAP: Polling já em andamento, pulando tentativa...');
          return;
        }

        pollingAttempts++;
        isCheckingHistory = true;
        try {
          // Wrapper com timeout para evitar que o polling tranque se a bridge nativa não responder
          const historyPromise = InAppPurchases.getPurchaseHistoryAsync();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('History fetch timeout')), 5000)
          );

          const { responseCode: historyCode, results: historyResults } = await Promise.race([
            historyPromise,
            timeoutPromise
          ]);

          if (historyCode === InAppPurchases.IAPResponseCode.OK && historyResults?.length > 0) {
            const now = Date.now();

            // DEBUG: Logar todos os items encontrados para entender o problema de re-compra
            console.log(`IAP Polling: Encontrados ${historyResults.length} itens no histórico.`);
            historyResults.forEach((h, i) => {
              if (h.productId === productId) {
                console.log(`Item ${i}: ID=${h.productId}, Time=${h.purchaseTime}, Age=${(now - (h.purchaseTime || 0)) / 1000}s, State=${h.transactionState}`);
              }
            });

            // CORREÇÃO Bug #3: Filtra apenas compras realizadas APÓS o início desta sessão de compra
            // Evita aceitar compras antigas (de sessões anteriores) que ainda estão no histórico
            // NOTA: Usamos filter + sort para garantir que pegamos a mais recente, caso haja múltiplas
            const recentPurchases = historyResults
              .filter(p => p.productId === productId && (p.purchaseTime || 0) >= purchaseStartTime)
              .sort((a, b) => (b.purchaseTime || 0) - (a.purchaseTime || 0));

            const purchase = recentPurchases.length > 0 ? recentPurchases[0] : undefined;

            if (purchase) {
              purchaseCompleted = true;
              clearInterval(pollingInterval);
              pendingPurchases.delete(productId);
              
              try {
                // BUG FIX: Sincroniza log com banco de dados no cenário de fallback
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  console.log('IAP Polling: Sincronizando compra confirmada com Supabase...');
                  await handlePurchaseSuccess(purchase, user.id);
                }
              } catch (e) {
                console.error('IAP Polling: Erro ao sincronizar compra com banco no fallback:', e);
              }
              
              await finishTransaction(purchase);
              resolve({ success: true, purchase });
            }
          }
        } catch (error) {
          // Se o erro for de concorrência nativa, ignoramos (apenas busy)
          if (error.message && error.message.includes('Must wait for promise')) {
            console.log('IAP: Native module busy (Must wait), pulando ciclo...');
            // Importante: NÃO resetamos isCheckingHistory aqui pois o nativo ainda está rodando
            // Mas para o JS não travar, precisamos permitir nova tentativa com cuidado.
            // Na verdade, se está busy, o isCheckingHistory=true do timeout anterior foi violado.
            return;
          }
          if (error.message && error.message.includes('History fetch timeout')) {
            console.log('IAP: Timeout esperado ao buscar histórico (fallback).');
            return;
          }
          console.error('IAP: Erro no polling:', error);
        } finally {
          // Só resetamos se conseguimos rodar (ou timeout). Se foi 'Must Wait', mantemos controle?
          // Simplificação: Sempre libera flag para tentar de novo, mas o catch acima filtra spam
          isCheckingHistory = false;
        }

        // Se atingiu o limite de tentativas sem sucesso
        if (pollingAttempts >= maxPollingAttempts) {
          clearInterval(pollingInterval);
          // Não rejeita aqui se ainda estivermos esperando callbacks do sistema
          // Mas como é polling de fallback, podemos considerar timeout
          if (!purchaseCompleted) {
            reject({ success: false, error: 'Timeout de verificação.' });
          }
        }
      };

      // Inicia a compra
      console.log('IAP: 🚀 Iniciando compra via purchaseItemAsync para:', productId);

      // Wrapper com timeout para a UI do sistema (15s)
      const purchasePromptPromise = InAppPurchases.purchaseItemAsync(productId);
      const promptTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('System UI timeout - App Store sheet did not appear')), 15000)
      );

      Promise.race([purchasePromptPromise, promptTimeoutPromise])
        .then(async () => {
          console.log('IAP: ✅ purchaseItemAsync retornou com sucesso');
          // Delay de 4 segundos antes de iniciar o polling
          // Isso permite que o Listener (que é mais rápido e correto) processe a compra
          // sem que o getPurchaseHistoryAsync bloqueie ou cause race conditions.
          setTimeout(() => {
            if (!purchaseCompleted) {
              console.log('IAP: Listener não detectou compra em 4s, iniciando polling de fallback...');
              pollingInterval = setInterval(pollPurchaseHistory, POLLING_INTERVAL);
            }
          }, 4000);
        })
        .catch((error) => {
          const isUiTimeout = error && error.message && error.message.includes('System UI timeout');
          
          if (isUiTimeout) {
            console.log('IAP: ⚠️ Timeout da UI do sistema atingido (usuário demorou mais de 15s para aprovar ou o App foi suspenso). A compra continuará no background.');
          } else {
            console.error('IAP: ❌ Erro ao iniciar compra:', error);
            console.error('IAP: Tipo de erro:', error?.code || 'unknown');
          }

          // Para o polling se estiver rodando
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }

          // CRÍTICO: Remove da lista de pendentes para permitir retry
          console.log('IAP: Limpando promise pendente após erro...');
          pendingPurchases.delete(productId);
          console.log('IAP: Promises pendentes restantes:', pendingPurchases.size);

          // Se for erro de promise pendente, força limpeza completa
          if (error?.code === 'E_UNFINISHED_PROMISE') {
            console.warn('IAP: ⚠️ Detectado E_UNFINISHED_PROMISE, limpando TODAS as promises...');
            pendingPurchases.clear();
          }

          // Se for erro de timeout de UI, tenta limpar a fila para a próxima tentativa
          if (error.message && error.message.includes('System UI timeout')) {
            console.log('IAP: Timeout de UI detectado, tentando limpar fila de transações travadas...');
            cleanUpStuckTransactions();
          }

          reject({ success: false, error });
        });
    });

    // Retorna a promise criada (permite reutilização em chamadas duplicadas)
    return purchasePromise;
  } catch (error) {
    console.error('Erro ao comprar assinatura:', error);
    // Remove promise pendente se existir
    if (pendingPurchases.has(productId)) {
      pendingPurchases.delete(productId);
    }
    return { success: false, error };
  }
}

/**
 * Restaura compras anteriores do usuário
 */
export async function restorePurchases() {
  if (Platform.OS !== 'ios') {
    return { success: false, error: 'IAP disponível apenas para iOS' };
  }

  // Verifica se o módulo está disponível
  const moduleAvailable = await ensureModuleAvailable();
  if (!moduleAvailable || !InAppPurchases) {
    return {
      success: false,
      error: 'Módulo nativo não disponível. Faça um novo build de desenvolvimento incluindo expo-in-app-purchases.'
    };
  }

  if (!iapInitialized) {
    const initResult = await initializeIAP();
    if (!initResult.success) {
      return { success: false, error: 'Não foi possível inicializar IAP' };
    }
  }

  try {
    const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

    if (responseCode === InAppPurchases.IAPResponseCode.OK) {
      console.log('IAP: Compras restauradas:', results);

      if (!results || results.length === 0) {
        return { success: true, purchases: [], bestPurchase: null };
      }

      // Processa cada compra restaurada
      const restoredPurchases = [];
      for (const purchase of results) {
        // Finaliza a transação para evitar que seja reenviada
        await finishTransaction(purchase);

        restoredPurchases.push({
          productId: purchase.productId,
          transactionId: purchase.transactionId,
          purchaseTime: purchase.purchaseTime,
        });
      }

      // Ordena por data (mais recente primeiro)
      restoredPurchases.sort((a, b) => {
        const timeA = a.purchaseTime || 0;
        const timeB = b.purchaseTime || 0;
        return timeB - timeA;
      });

      // Identifica a assinatura MAIS RECENTE (não a "melhor")
      // Quando o usuário faz downgrade (Premium -> Basic), queremos respeitar essa decisão
      // A lista já está ordenada por data (mais recente primeiro)
      let bestPurchase = null;

      // Procura a primeira assinatura válida (mais recente) na lista ordenada
      for (const purchase of restoredPurchases) {
        if (purchase.productId === PRODUCT_IDS.premium || purchase.productId === PRODUCT_IDS.basic) {
          // Verifica se a compra expirou
          const purchaseDate = new Date(purchase.purchaseTime || Date.now());
          const expiresAt = new Date(purchaseDate.getTime());
          
          // CORREÇÃO Bug #1: usa APENAS __DEV__ para sandbox durations
          if (__DEV__) {
            expiresAt.setMinutes(expiresAt.getMinutes() + 5);
          } else {
            expiresAt.setDate(expiresAt.getDate() + 30);
          }

          if (new Date() > expiresAt) {
            console.log('IAP: Assinatura encontrada no histórico, mas já expirada:', purchase.productId);
            break; // A mais recente expirou, então não há assinatura ativa
          }

          bestPurchase = purchase;
          console.log('IAP: Assinatura válida mais recente encontrada:', purchase.productId, 'Data:', purchaseDate.toISOString());
          break;
        }
      }

      if (!bestPurchase) {
        console.log('IAP: Nenhuma assinatura encontrada no histórico');
      }

      return { success: true, purchases: restoredPurchases, bestPurchase };
    } else {
      console.error('IAP: Erro ao restaurar compras, responseCode:', responseCode);
      return {
        success: false,
        error: `Erro ao restaurar compras: ${responseCode}`
      };
    }
  } catch (error) {
    console.error('Erro ao restaurar compras:', error);
    return { success: false, error };
  }
}

/**
 * Finaliza uma transação
 * IMPORTANTE: Sempre chamar após processar a compra, senão a Apple reenviará o evento
 */
async function finishTransaction(transaction) {
  if (!InAppPurchases) {
    console.warn('IAP: Módulo não disponível para finalizar transação');
    return { success: false, error: 'Módulo não disponível' };
  }

  // Verifica se a transação tem dados válidos antes de tentar finalizar
  // O erro "key cannot be nil" ocorre quando a transação não tem transactionId
  if (!transaction) {
    console.warn('IAP: Transação inválida (null/undefined)');
    return { success: false, error: 'Transação inválida' };
  }

  // Verifica se existe um identificador de transação válido
  const transactionId = transaction.transactionId || transaction.transactionIdentifier;
  if (!transactionId) {
    console.warn('IAP: Transação sem identificador válido, ignorando finishTransaction:', transaction);
    // Retorna sucesso pois a transação já pode ter sido finalizada ou não precisa ser
    return { success: true, warning: 'Transação sem identificador' };
  }

  try {
    // Para assinaturas auto-renováveis, não precisamos consumir o item
    // O segundo parâmetro (consumeItem) deve ser false para assinaturas
    await InAppPurchases.finishTransactionAsync(transaction, false);
    console.log('IAP: Transação finalizada:', transactionId);
    return { success: true };
  } catch (error) {
    console.error('Erro ao finalizar transação:', error);
    // Não propagar o erro, apenas logar - a transação pode já ter sido finalizada
    return { success: false, error };
  }
}

/**
 * Limpa transações travadas na fila
 * Útil quando o sistema de compras para de responder (System UI timeout)
 */
export async function cleanUpStuckTransactions() {
  if (!InAppPurchases) return;
  console.log('IAP: Iniciando limpeza de transações travadas...');
  try {
    const { results } = await InAppPurchases.getPurchaseHistoryAsync();
    if (results && results.length > 0) {
      console.log(`IAP: Encontradas ${results.length} transações no histórico para verificar.`);
      await Promise.all(results.map(async (purchase) => {
        // Finaliza transações antigas para destravar a fila
        // Ignoramos erros individuais para tentar limpar o máximo possível
        await InAppPurchases.finishTransactionAsync(purchase, false).catch(() => { });
      }));
      console.log('IAP: Limpeza concluída.');
    } else {
      console.log('IAP: Histórico limpo, nenhuma transação travada aparente.');
    }
  } catch (error) {
    console.warn('IAP: Erro ao tentar limpar transações:', error);
  }
}

/**
 * Valida recibo com servidor (opcional, via Supabase Edge Function)
 * 
 * NOTA: O expo-in-app-purchases já valida receipts com a Apple, mas esta validação
 * adicional no servidor é recomendada para segurança adicional.
 * 
 * Para usar esta função, você precisa obter o receipt data. No iOS, você pode usar
 * InAppPurchases.getReceiptAsync() para obter o receipt, mas isso pode não estar
 * disponível em todas as versões do expo-in-app-purchases.
 * 
 * @param {string} receiptData - Receipt data em base64 (opcional)
 * @param {string} productId - Product ID para validar (opcional)
 * @param {string} userId - User ID para log (opcional)
 */
export async function validateReceipt(receiptData, productId = null, userId = null) {
  try {
    if (!receiptData) {
      console.warn('IAP: Receipt data não fornecido. Validação ignorada.');
      return { success: false, error: 'Receipt data é obrigatório para validação' };
    }

    // Envia receipt para Supabase Edge Function para validação
    const { data, error } = await supabase.functions.invoke('validate-iap-receipt', {
      body: {
        receipt: receiptData,
        productId,
        userId,
        isProduction: __DEV__ ? false : true // Usa sandbox em desenvolvimento
      }
    });

    if (error) {
      console.error('Erro ao validar receipt:', error);
      return { success: false, error };
    }

    if (data.error) {
      console.error('IAP: Receipt inválido:', data.error);
      return { success: false, error: data.error, status: data.status };
    }

    console.log('IAP: Receipt validado:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Erro ao validar recibo:', error);
    return { success: false, error };
  }
}

/**
 * Processa compra bem-sucedida
 * Atualiza assinatura no banco de dados e finaliza a transação
 */
export async function handlePurchaseSuccess(transaction, userId) {
  try {
    // Determina o plano baseado no productId
    let plan = 'free';
    if (transaction.productId === PRODUCT_IDS.basic) {
      plan = 'basic';
    } else if (transaction.productId === PRODUCT_IDS.premium) {
      plan = 'premium';
    }

    // Agora que toLocalISOString usa o padrão UTC, podemos usar de forma segura o purchaseTime
    // real da transação (fallback para Date.now() se ausente), em vez de zerar o timer.
    const purchaseTime = new Date(transaction.purchaseTime || Date.now());

    const expiresAt = new Date(purchaseTime.getTime());

    console.log('IAP: ========================================');
    console.log('IAP: Configurando expiração da assinatura');
    console.log('IAP: Compra em (BRT):', purchaseTime.toLocaleString('pt-BR'));

    // CORREÇÃO Bug #1: Usa APENAS __DEV__ para sandbox durations
    // Em produção (TestFlight / App Store), sempre usa 30 dias reais
    if (__DEV__) {
      // Sandbox: Durações curtas (5 min correspondendo a 1 mês no sandbox)
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);
      console.log('IAP: ⏰ [SANDBOX/__DEV__] Expirando em 5 MINUTOS');
    } else {
      // Produção: 30 dias (assinatura mensal)
      expiresAt.setDate(expiresAt.getDate() + 30);
      console.log('IAP: ⏰ [PRODUÇÃO] Expirando em 30 DIAS');
    }
    console.log('IAP: Expira em (BRT):', expiresAt.toLocaleString('pt-BR'));
    console.log('IAP: ========================================');

    // Atualiza perfil do usuário
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_plan: plan,
        subscription_status: 'active',
        subscription_started_at: toLocalISOString(purchaseTime),
        subscription_expires_at: toLocalISOString(expiresAt),
        subscription_iap_transaction_id: transaction.transactionId || transaction.transactionIdentifier,
        // Remove período de teste e graça ao fazer upgrade para aplicar novas regras imediatamente
        subscription_trial_ends_at: null,
        subscription_grace_period_ends_at: null,
      })
      .eq('id', userId);

    if (error) {
      console.error('Erro ao atualizar assinatura:', error);
      return { success: false, error };
    }

    // IMPORTANTE: Finaliza a transação para evitar que a Apple reenvie o evento
    await finishTransaction(transaction);

    console.log('IAP: Assinatura atualizada com sucesso para usuário:', userId);
    return { success: true };
  } catch (error) {
    console.error('Erro ao processar compra:', error);
    return { success: false, error };
  }
}

/**
 * Trata erros de compra usando IAPResponseCode
 */
export function handlePurchaseError(error, responseCode) {
  console.error('Erro na compra IAP:', { error, responseCode });

  // Se o módulo não estiver disponível, retorna erro genérico
  if (!InAppPurchases || !InAppPurchases.IAPResponseCode) {
    return {
      success: false,
      message: 'Módulo nativo não disponível',
      error,
      responseCode,
    };
  }

  // Mapeia códigos de resposta do expo-in-app-purchases
  const errorMessages = {
    [InAppPurchases.IAPResponseCode.USER_CANCELLED]: 'Compra cancelada pelo usuário',
    [InAppPurchases.IAPResponseCode.ERROR]: 'Erro ao processar compra. Tente novamente.',
    [InAppPurchases.IAPResponseCode.UNAVAILABLE]: 'Produto não disponível no momento',
    [InAppPurchases.IAPResponseCode.INVALID_RECEIPT]: 'Receipt inválido',
    [InAppPurchases.IAPResponseCode.DEFERRED]: 'Compra aguardando aprovação',
  };

  const message = errorMessages[responseCode] || 'Erro ao processar compra';

  return {
    success: false,
    message,
    error,
    responseCode,
  };
}

/**
 * Retorna Product ID baseado no plano
 */
export function getProductIdForPlan(plan) {
  if (plan === 'basic') {
    return PRODUCT_IDS.basic;
  } else if (plan === 'premium') {
    return PRODUCT_IDS.premium;
  }
  return null;
}

/**
 * Processa evento de compra do listener
 * Esta função é chamada pelo listener quando uma compra é confirmada
 * 
 * NOTA: A validação de receipt no servidor é opcional mas recomendada.
 * O expo-in-app-purchases já valida com a Apple, mas para segurança adicional
 * você pode habilitar a validação no servidor descomentando o código abaixo.
 */
export async function processPurchaseEvent(purchase, userId) {
  try {
    // Validação opcional no servidor (descomente para habilitar)
    // Para usar, você precisaria obter o receipt data primeiro
    // const receiptData = await InAppPurchases.getReceiptAsync(); // Pode não estar disponível
    // if (receiptData) {
    //   const validationResult = await validateReceipt(receiptData, purchase.productId, userId);
    //   if (!validationResult.success) {
    //     console.warn('IAP: Validação de receipt falhou, mas processando mesmo assim');
    //     // Você pode decidir se quer continuar ou não baseado na validação
    //   }
    // }

    // Processa a compra
    const result = await handlePurchaseSuccess(purchase, userId);

    if (result.success) {
      console.log('IAP: Compra processada com sucesso');
      return { success: true, purchase };
    } else {
      console.error('IAP: Erro ao processar compra:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Erro ao processar evento de compra:', error);
    return { success: false, error };
  }
}

/**
 * Verifica e sincroniza status da assinatura com a Apple
 * Compara o que está no histórico de compras com o banco de dados
 * 
 * IMPORTANTE: Esta função verifica se há compras no histórico.
 * Se não houver compras ou se a assinatura expirou, atualiza para free.
 * 
 * @param {string} userId
 * @param {boolean} forceAppleCheck - Se true, força consulta à Apple mesmo se expirado localmente
 */
export async function checkAndSyncSubscriptionStatus(userId, forceAppleCheck = false) {
  if (Platform.OS !== 'ios') {
    return { success: false, synced: false, reason: 'IAP disponível apenas para iOS' };
  }

  // Verifica se o módulo está disponível
  const moduleAvailable = await ensureModuleAvailable();
  if (!moduleAvailable || !InAppPurchases) {
    return { success: false, synced: false, reason: 'Módulo nativo não disponível' };
  }

  if (!iapInitialized) {
    const initResult = await initializeIAP();
    if (!initResult.success) {
      return { success: false, synced: false, reason: 'Não foi possível inicializar IAP' };
    }
  }

  try {
    // Busca dados atuais do banco de dados
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_expires_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('IAP: Erro ao buscar perfil:', profileError);
      return { success: false, synced: false, reason: 'Erro ao buscar perfil' };
    }

    const currentPlan = profile.subscription_plan || 'free';
    // Se já está no plano free, verifica se o status está correto (active)
    if (currentPlan === 'free' && !forceAppleCheck) {
      if (profile.subscription_status !== 'active') {
        console.log('IAP: Plano free com status "inativo" detectado, corrigindo para "active"...');
        await updateToFreePlan(userId);
        return { success: true, synced: true, newPlan: 'free', reason: 'Correção de status inativo' };
      }

      console.log('IAP: Já está no plano free e ativo, nada a sincronizar');
      return { success: true, synced: false, reason: 'Já está no plano free' };
    }

    const expiresAt = profile.subscription_expires_at ? parseSupabaseDate(profile.subscription_expires_at) : null;
    const now = new Date();

    // 1. O plano expirou localmente?
    if (currentPlan !== 'free' && expiresAt && now >= expiresAt) {
      console.log('IAP: Assinatura expirou localmente em:', expiresAt.toISOString());
      
      // Se NÃO forçarmos a checagem na Apple, apenas fazemos downgrade direto.
      // Se forçarmos a checagem (como acontece no background depois que expira),
      // ignoramos o downgrade automático aqui e consultamos a Apple primeiro!
      if (!forceAppleCheck) {
        console.log('IAP: Atualizando para plano free (Local Check)...');
        await updateToFreePlan(userId);
        return {
          success: true,
          synced: true,
          newPlan: 'free',
          reason: `Assinatura ${currentPlan} expirou localmente`
        };
      } else {
        console.log('IAP: Expirada localmente. Consultando Apple para verificar auto-renovação...');
      }
    } else {
      // Se não expirou e não forçamos checagem na Apple, está tudo OK localmente
      if (!forceAppleCheck) {
        return { success: true, synced: false, reason: 'Verificação local OK' };
      }
    }

    // A partir daqui, verifica a Apple de fato
    console.log('IAP: Verificando histórico de compras na Apple (FORCE CHECK)...');
    let responseCode, results;
    try {
      const historyPromise = InAppPurchases.getPurchaseHistoryAsync();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getPurchaseHistoryAsync timeout')), 15000)
      );
      const output = await Promise.race([historyPromise, timeoutPromise]);
      responseCode = output.responseCode;
      results = output.results;
    } catch (error) {
       console.error('IAP: Erro ou timeout ao buscar histórico:', error);
       return { success: false, synced: false, reason: 'Erro ao buscar histórico de compras' };
    }

    if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
      console.error('IAP: Erro da API ao buscar histórico:', responseCode);
      return { success: false, synced: false, reason: 'Erro ao buscar histórico de compras' };
    }

    // Se não há compras no histórico, usuário está no free
    if (!results || results.length === 0) {
      console.log('IAP: Nenhuma compra encontrada no histórico, atualizando para free');
      await updateToFreePlan(userId);
      return { success: true, synced: true, newPlan: 'free', reason: 'Sem compras no histórico' };
    }

    // Ordena por data de compra (mais recente primeiro)
    const sortedResults = [...results].sort((a, b) => {
      const timeA = a.purchaseTime || 0;
      const timeB = b.purchaseTime || 0;
      return timeB - timeA;
    });

    // Identifica a assinatura MAIS RECENTE (não a "melhor")
    // Quando o usuário faz downgrade, queremos respeitar essa decisão
    let bestPurchase = null;
    for (const purchase of sortedResults) {
      if (purchase.productId === PRODUCT_IDS.premium || purchase.productId === PRODUCT_IDS.basic) {
        // Verifica se a compra expirou antes de considerar como válida
        const purchaseTime = new Date(purchase.purchaseTime || Date.now());
        const expiresAt = new Date(purchaseTime.getTime());
        
        // CORREÇÃO Bug #1: usa APENAS __DEV__ para sandbox durations
        if (__DEV__) {
          expiresAt.setMinutes(expiresAt.getMinutes() + 5);
        } else {
          expiresAt.setDate(expiresAt.getDate() + 30);
        }

        if (new Date() > expiresAt) {
          console.log('IAP Sync: Assinatura encontrada, mas já expirada:', purchase.productId, 'Expirou em:', expiresAt.toISOString());
          // Como as compras estão ordenadas da mais recente para a mais antiga,
          // se a mais recente está expirada, não temos assinatura válida
          break;
        }

        bestPurchase = purchase;
        console.log('IAP Sync: Assinatura mais recente válida:', purchase.productId, 'Data:', purchaseTime.toISOString());
        break;
      }
    }

    if (!bestPurchase) {
      console.log('IAP: Nenhuma assinatura válida encontrada, atualizando para free');
      await updateToFreePlan(userId);
      return { success: true, synced: true, newPlan: 'free', reason: 'Sem assinatura válida' };
    }

    // Determina o plano baseado na melhor compra
    let newPlan = 'free';
    if (bestPurchase.productId === PRODUCT_IDS.premium) {
      newPlan = 'premium';
    } else if (bestPurchase.productId === PRODUCT_IDS.basic) {
      newPlan = 'basic';
    }

    // SEMPRE ATUALIZA A DATA DE EXPIRAÇÃO SE A CONSULTA FOI FORÇADA E A COMPRA É VÁLIDA
    // Isso é crucial para o Sandbox, pois a assinatura se renova sem enviar webhook,
    // e precisamos atualizar o `expiresAt` localmente mesmo que a pessoa continue no Premium!
    console.log(`IAP: Banco local atualizado para transação ativa mais recente (${newPlan}).`);
    await handlePurchaseSuccess(bestPurchase, userId);

    if (currentPlan !== newPlan) {
      console.log(`IAP: Plano mudou de ${currentPlan} para ${newPlan}`);
      return { success: true, synced: true, newPlan, reason: `Plano atualizado de ${currentPlan} para ${newPlan}` };
    }

    console.log('IAP: Planos sincronizados (Plano mantido e tempo renovado)');
    // Mesma lógica se atualizou renovação, Dashboard deve buscar a nova data
    return { success: true, synced: true, currentPlan, reason: 'Assinatura auto-renovada identificada' };

  } catch (error) {
    console.error('Erro ao sincronizar assinatura:', error);
    return { success: false, synced: false, reason: error.message || 'Erro desconhecido' };
  }
}

/**
 * Atualiza o perfil do usuário para o plano free
 */
async function updateToFreePlan(userId) {
  const { error } = await supabase
    .from('profiles')
    .update({
      subscription_plan: 'free',
      subscription_status: 'active',
      subscription_expires_at: null,
      subscription_iap_transaction_id: null,
      subscription_trial_ends_at: null,
      subscription_grace_period_ends_at: null,
    })
    .eq('id', userId);

  if (error) {
    console.error('IAP: Erro ao atualizar para plano free:', error);
    throw error;
  }

  console.log('IAP: Atualizado para plano free');
}
