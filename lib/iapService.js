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
let purchaseListener = null;
// Gerenciamento de promises pendentes para compras
const pendingPurchases = new Map();
let InAppPurchases = null;
let isModuleAvailable = false;

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
    return { success: true };
  }

  try {
    await InAppPurchases.connectAsync();
    iapInitialized = true;
    console.log('IAP: Conexão estabelecida com App Store');
    
    // Configura listener único para eventos de compra
    setupPurchaseListener();
    
    return { success: true };
  } catch (error) {
    console.error('Erro ao inicializar IAP:', error);
    return { success: false, error };
  }
}

/**
 * Configura listener para eventos de compra
 * Este listener será chamado automaticamente quando houver compras
 */
function setupPurchaseListener() {
  if (purchaseListener || !InAppPurchases) {
    return; // Listener já configurado ou módulo não disponível
  }

  purchaseListener = InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }) => {
    console.log('IAP: Evento de compra recebido', { responseCode, results, errorCode });
    
    if (responseCode === InAppPurchases.IAPResponseCode.OK && results && results.length > 0) {
      // Processa cada compra bem-sucedida
      results.forEach((purchase) => {
        console.log('IAP: Compra confirmada:', purchase);
        
        // Resolve promise pendente se existir
        const pendingPurchase = pendingPurchases.get(purchase.productId);
        if (pendingPurchase) {
          pendingPurchase.resolve({ success: true, purchase });
          pendingPurchases.delete(purchase.productId);
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
 */
export async function getAvailableProducts() {
  if (Platform.OS !== 'ios') {
    // Retorna produtos mockados para outras plataformas
    return {
      success: true,
      products: [
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
      ],
    };
  }

  // Verifica se o módulo está disponível, se não, retorna produtos mockados
  const moduleAvailable = await ensureModuleAvailable();
  if (!moduleAvailable) {
    console.warn('IAP: Módulo não disponível, retornando produtos mockados');
    return {
      success: true,
      products: [
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
      ],
    };
  }

  if (!iapInitialized) {
    const initResult = await initializeIAP();
    if (!initResult.success) {
      // Se não conseguiu inicializar, retorna produtos mockados
      return {
        success: true,
        products: [
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
        ],
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
        console.warn('IAP: Nenhum produto encontrado. Retornando produtos mockados.');
        // Retorna produtos mockados se nenhum for encontrado
        return {
          success: true,
          products: [
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
          ],
          warning: 'Produtos não encontrados no App Store. Verifique se estão configurados corretamente.',
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
        errorMessage = 'Produtos não disponíveis. Verifique se os produtos estão configurados e aprovados no App Store Connect.';
      }
      
      // Retorna produtos mockados mesmo com erro, para que a UI continue funcionando
      return { 
        success: true,
        products: [
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
        ],
        warning: errorMessage,
      };
    }
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    // Retorna produtos mockados mesmo com erro
    return { 
      success: true,
      products: [
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
      ],
      warning: 'Erro ao buscar produtos do App Store. Os produtos podem não estar disponíveis para compra.',
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

    // Cria uma Promise que será resolvida pelo listener
    return new Promise((resolve, reject) => {
      // Armazena a promise para ser resolvida pelo listener
      pendingPurchases.set(productId, { resolve, reject });
      
      // Timeout de 5 minutos para evitar promises pendentes indefinidamente
      setTimeout(() => {
        if (pendingPurchases.has(productId)) {
          pendingPurchases.delete(productId);
          reject({ 
            success: false, 
            error: 'Timeout: Compra não foi concluída a tempo' 
          });
        }
      }, 5 * 60 * 1000); // 5 minutos

      // Agora podemos comprar o produto com segurança
      InAppPurchases.purchaseItemAsync(productId)
        .then(() => {
          console.log('IAP: Compra iniciada para produto:', productId);
          // A Promise será resolvida pelo listener quando a compra for confirmada
        })
        .catch((error) => {
          // Remove promise pendente se houver erro imediato
          if (pendingPurchases.has(productId)) {
            pendingPurchases.delete(productId);
          }
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

      return { success: true, purchases: restoredPurchases };
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

  try {
    // Para assinaturas auto-renováveis, não precisamos consumir o item
    // O segundo parâmetro (consumeItem) deve ser false para assinaturas
    await InAppPurchases.finishTransactionAsync(transaction, false);
    console.log('IAP: Transação finalizada:', transaction.transactionId);
    return { success: true };
  } catch (error) {
    console.error('Erro ao finalizar transação:', error);
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

    // Para assinaturas auto-renováveis, a Apple gerencia a data de expiração
    // Calculamos 1 mês a partir da data de compra como fallback
    const purchaseTime = transaction.purchaseTime 
      ? new Date(transaction.purchaseTime) 
      : new Date();
    
    const expiresAt = new Date(purchaseTime);
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    // Atualiza perfil do usuário
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_plan: plan,
        subscription_status: 'active',
        subscription_started_at: purchaseTime.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
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
