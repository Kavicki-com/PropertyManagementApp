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

/**
 * Converte uma data para string no formato ISO mas com timezone local (BRT)
 * Isso garante que as datas no banco apareçam no horário do Brasil, não UTC
 */
function toLocalISOString(date) {
  const offset = date.getTimezoneOffset(); // offset em minutos
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().replace('Z', ''); // Remove o 'Z' pois não é UTC
}

/**
 * Verifica se o módulo nativo está disponível
 * Importa dinamicamente para evitar crash se não estiver disponível
 */
async function ensureModuleAvailable() {
  if (isModuleAvailable && InAppPurchases) {
    return true;
  }

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

  try {
    await InAppPurchases.connectAsync();
    iapInitialized = true;
    console.log('IAP: Conexão estabelecida com App Store');

    // Configura listener único para eventos de compra
    ensurePurchaseListener();

    return { success: true };
  } catch (error) {
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

  // Se já existe um listener, não precisa reconfigurar
  if (listenerConfigured) {
    console.log('IAP: Listener já configurado anteriormente');
    return;
  }

  console.log('IAP: Configurando purchase listener...');

  // setPurchaseListener retorna void, então usamos um flag separado
  InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }) => {
    console.log('IAP: ======= EVENTO DE COMPRA RECEBIDO =======');
    console.log('IAP: responseCode:', responseCode);
    console.log('IAP: results:', JSON.stringify(results, null, 2));
    console.log('IAP: errorCode:', errorCode);
    console.log('IAP: pendingPurchases size:', pendingPurchases.size);
    console.log('IAP: pendingPurchases keys:', Array.from(pendingPurchases.keys()));

    if (responseCode === InAppPurchases.IAPResponseCode.OK && results && results.length > 0) {
      // Processa cada compra bem-sucedida
      results.forEach((purchase) => {
        console.log('IAP: Compra confirmada:', purchase.productId);

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
          console.warn('IAP: Nenhuma promise pendente encontrada para:', purchase.productId);
        }
      });
    } else if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELLED) {
      console.log('IAP: Usuário cancelou a compra');
      // Rejeita todas as promises pendentes
      pendingPurchases.forEach((pending, productId) => {
        pending.reject({
          success: false,
          error: handlePurchaseError(null, InAppPurchases.IAPResponseCode.USER_CANCELLED)
        });
        pendingPurchases.delete(productId);
      });
    } else if (responseCode === InAppPurchases.IAPResponseCode.ERROR) {
      console.error('IAP: Erro na compra', errorCode);
      // Rejeita todas as promises pendentes
      pendingPurchases.forEach((pending, productId) => {
        pending.reject({
          success: false,
          error: handlePurchaseError(null, InAppPurchases.IAPResponseCode.ERROR)
        });
        pendingPurchases.delete(productId);
      });
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
  } else {
    // Garante que o listener está configurado mesmo se já inicializado
    ensurePurchaseListener();
  }

  try {
    // Verifica se o productId é válido
    if (!Object.values(PRODUCT_IDS).includes(productId)) {
      return { success: false, error: 'Product ID inválido' };
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
    return new Promise((resolve, reject) => {
      let purchaseCompleted = false;
      let pollingAttempts = 0;
      const maxPollingAttempts = 10; // 10 tentativas x 2s = 20s
      let pollingInterval = null;

      // CRÍTICO: Registra a promise pendente ANTES de iniciar a compra
      // Isso permite que o listener resolva a promise quando o evento chegar
      pendingPurchases.set(productId, { resolve, reject });
      console.log('IAP: Promise pendente registrada para:', productId);

      // Função de polling para verificar histórico
      const purchaseStartTime = Date.now(); // Marca quando iniciou a compra

      const pollPurchaseHistory = async () => {
        pollingAttempts++;
        console.log(`IAP: Polling tentativa ${pollingAttempts}/${maxPollingAttempts}...`);

        try {
          const { responseCode: historyCode, results: historyResults } = await InAppPurchases.getPurchaseHistoryAsync();

          if (historyCode === InAppPurchases.IAPResponseCode.OK && historyResults && historyResults.length > 0) {
            const purchase = historyResults.find(p => p.productId === productId);

            if (purchase && !purchaseCompleted) {
              // IMPORTANTE: Verifica se a compra é RECENTE (feita nos últimos 2 minutos)
              // Isso evita pegar compras antigas/expiradas do histórico
              const purchaseTime = purchase.purchaseTime || 0;
              const timeSincePurchase = Date.now() - purchaseTime;
              const twoMinutesInMs = 2 * 60 * 1000;

              if (timeSincePurchase > twoMinutesInMs) {
                console.log(`IAP: Compra muito antiga (${Math.floor(timeSincePurchase / 1000)}s atrás), ignorando...`);
                return; // Ignora e continua polling
              }

              console.log('IAP: Compra RECENTE confirmada via polling:', purchase.productId);
              console.log('IAP: Tempo desde compra:', Math.floor(timeSincePurchase / 1000), 'segundos');
              purchaseCompleted = true;

              // Para o polling
              if (pollingInterval) {
                clearInterval(pollingInterval);
              }

              // Remove da lista de pendentes
              pendingPurchases.delete(productId);

              // Finaliza a transação
              await finishTransaction(purchase);

              // Resolve a promise
              resolve({ success: true, purchase });
            }
          }
        } catch (error) {
          console.error('IAP: Erro no polling:', error);
        }

        // Se atingiu o limite de tentativas sem sucesso
        if (pollingAttempts >= maxPollingAttempts && !purchaseCompleted) {
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }
          pendingPurchases.delete(productId);
          reject({
            success: false,
            error: 'Não foi possível confirmar a compra. Se você completou a compra, use "Restaurar Compras".'
          });
        }
      };

      // Inicia a compra
      InAppPurchases.purchaseItemAsync(productId)
        .then(async () => {
          console.log('IAP: Compra iniciada para produto:', productId);

          // Aguarda 3 segundos antes de iniciar o polling
          // Dá tempo para o listener processar se funcionar
          await new Promise(r => setTimeout(r, 3000));

          // Se ainda não foi completada pelo listener, inicia polling
          if (!purchaseCompleted) {
            console.log('IAP: Listener não confirmou, iniciando polling...');
            pollingInterval = setInterval(pollPurchaseHistory, 2000);
          }
        })
        .catch((error) => {
          console.error('IAP: Erro ao iniciar compra:', error);

          // Para o polling se estiver rodando
          if (pollingInterval) {
            clearInterval(pollingInterval);
          }

          // Remove da lista de pendentes
          pendingPurchases.delete(productId);

          reject({ success: false, error });
        });
    });
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
          bestPurchase = purchase;
          console.log('IAP: Assinatura mais recente encontrada:', purchase.productId, 'Data:', new Date(purchase.purchaseTime).toISOString());
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

    // IMPORTANTE: Usar hora ATUAL LOCAL ao invés de transaction.purchaseTime
    // pois transaction.purchaseTime vem em UTC e causa problemas de timezone (~3h de diferença no BRT)
    const purchaseTime = new Date(); // Sempre usa hora local atual

    const expiresAt = new Date(purchaseTime);

    console.log('IAP: ========================================');
    console.log('IAP: Configurando expiração da assinatura');
    console.log('IAP: Compra em (BRT):', purchaseTime.toLocaleString('pt-BR'));

    // SEMPRE use 5 minutos por enquanto (para testes)
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);
    console.log('IAP: ⏰ Expirando em 5 MINUTOS (forçado para testes)');
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
 */
export async function checkAndSyncSubscriptionStatus(userId) {
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

    // IMPORTANTE: Verifica se a assinatura expirou LOCALMENTE primeiro
    // Isso é crítico no Sandbox onde assinaturas expiram em 5 minutos
    const expiresAt = profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : null;
    const now = new Date();

    if (currentPlan !== 'free' && expiresAt && now >= expiresAt) {
      console.log('IAP: Assinatura expirou localmente em:', expiresAt.toISOString());
      console.log('IAP: Data atual:', now.toISOString());
      console.log('IAP: Atualizando para plano free devido a expiração...');

      await updateToFreePlan(userId);
      return {
        success: true,
        synced: true,
        newPlan: 'free',
        reason: `Assinatura ${currentPlan} expirou em ${expiresAt.toLocaleString('pt-BR')}`
      };
    }

    // Se já está no plano free, não precisa sincronizar
    if (currentPlan === 'free') {
      console.log('IAP: Já está no plano free, nada a sincronizar');
      return { success: true, synced: false, reason: 'Já está no plano free' };
    }

    // Verifica histórico de compras na Apple
    console.log('IAP: Verificando histórico de compras para sincronização...');
    const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

    if (responseCode !== InAppPurchases.IAPResponseCode.OK) {
      console.error('IAP: Erro ao buscar histórico:', responseCode);
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
        bestPurchase = purchase;
        console.log('IAP Sync: Assinatura mais recente:', purchase.productId, 'Data:', new Date(purchase.purchaseTime).toISOString());
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

    // Se o plano no banco é diferente do plano na Apple, atualiza
    if (currentPlan !== newPlan) {
      console.log(`IAP: Plano mudou de ${currentPlan} para ${newPlan}`);

      if (newPlan === 'free') {
        await updateToFreePlan(userId);
      } else {
        await handlePurchaseSuccess(bestPurchase, userId);
      }

      return { success: true, synced: true, newPlan, reason: `Plano atualizado de ${currentPlan} para ${newPlan}` };
    }

    console.log('IAP: Planos sincronizados, nenhuma alteração necessária');
    return { success: true, synced: false, currentPlan, reason: 'Planos já sincronizados' };

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
