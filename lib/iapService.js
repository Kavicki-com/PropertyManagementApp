/**
 * Serviço de In-App Purchase (IAP)
 * Integração com Apple App Store para assinaturas
 * 
 * Nota: Implementação inicial para iOS. Android será adicionado posteriormente.
 */

import { supabase } from './supabase';

// Product IDs devem ser configurados no App Store Connect
// Exemplo: com.yourapp.subscription.basic.monthly
const PRODUCT_IDS = {
  basic: 'com.yourapp.subscription.basic.monthly', // R$ 19,90/mês
  premium: 'com.yourapp.subscription.premium.monthly', // R$ 39,90/mês
};

let iapInitialized = false;

/**
 * Inicializa conexão com App Store
 * Deve ser chamado quando o app inicia
 */
export async function initializeIAP() {
  try {
    // TODO: Implementar inicialização com react-native-iap ou expo-in-app-purchases
    // Exemplo com react-native-iap:
    // import * as RNIap from 'react-native-iap';
    // await RNIap.initConnection();
    // iapInitialized = true;
    
    console.log('IAP: Inicialização (placeholder)');
    iapInitialized = true;
    return { success: true };
  } catch (error) {
    console.error('Erro ao inicializar IAP:', error);
    return { success: false, error };
  }
}

/**
 * Busca produtos disponíveis (planos) no App Store
 */
export async function getAvailableProducts() {
  if (!iapInitialized) {
    await initializeIAP();
  }

  try {
    // TODO: Implementar busca de produtos
    // Exemplo com react-native-iap:
    // import * as RNIap from 'react-native-iap';
    // const products = await RNIap.getProducts(Object.values(PRODUCT_IDS));
    // return { success: true, products };
    
    // Placeholder: retorna produtos mockados
    return {
      success: true,
      products: [
        {
          productId: PRODUCT_IDS.basic,
          title: 'Plano Básico',
          description: 'Até 15 imóveis',
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
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return { success: false, error };
  }
}

/**
 * Inicia compra de assinatura
 */
export async function purchaseSubscription(productId) {
  if (!iapInitialized) {
    await initializeIAP();
  }

  try {
    // TODO: Implementar compra
    // Exemplo com react-native-iap:
    // import * as RNIap from 'react-native-iap';
    // const purchase = await RNIap.requestSubscription(productId);
    // return { success: true, purchase };
    
    console.log('IAP: Compra iniciada (placeholder)', productId);
    return { success: false, error: 'IAP não implementado ainda' };
  } catch (error) {
    console.error('Erro ao comprar assinatura:', error);
    return { success: false, error };
  }
}

/**
 * Restaura compras anteriores
 */
export async function restorePurchases() {
  if (!iapInitialized) {
    await initializeIAP();
  }

  try {
    // TODO: Implementar restauração
    // Exemplo com react-native-iap:
    // import * as RNIap from 'react-native-iap';
    // const purchases = await RNIap.restorePurchases();
    // return { success: true, purchases };
    
    console.log('IAP: Restaurar compras (placeholder)');
    return { success: false, error: 'IAP não implementado ainda' };
  } catch (error) {
    console.error('Erro ao restaurar compras:', error);
    return { success: false, error };
  }
}

/**
 * Valida recibo com servidor (opcional, via Supabase)
 */
export async function validateReceipt(receipt) {
  try {
    // TODO: Implementar validação de recibo no backend
    // Enviar receipt para Supabase Edge Function ou API
    // const { data, error } = await supabase.functions.invoke('validate-iap-receipt', {
    //   body: { receipt }
    // });
    
    console.log('IAP: Validar recibo (placeholder)');
    return { success: false, error: 'Validação não implementada ainda' };
  } catch (error) {
    console.error('Erro ao validar recibo:', error);
    return { success: false, error };
  }
}

/**
 * Processa compra bem-sucedida
 * Atualiza assinatura no banco de dados
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

    // Calcula data de expiração (1 mês a partir de agora)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    // Atualiza perfil do usuário
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_plan: plan,
        subscription_status: 'active',
        subscription_started_at: new Date().toISOString(),
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

    return { success: true };
  } catch (error) {
    console.error('Erro ao processar compra:', error);
    return { success: false, error };
  }
}

/**
 * Trata erros de compra
 */
export function handlePurchaseError(error) {
  console.error('Erro na compra IAP:', error);
  
  // Mapeia códigos de erro comuns
  const errorMessages = {
    'E_USER_CANCELLED': 'Compra cancelada pelo usuário',
    'E_NETWORK_ERROR': 'Erro de conexão. Verifique sua internet.',
    'E_SERVICE_ERROR': 'Erro no serviço. Tente novamente mais tarde.',
  };

  return {
    success: false,
    message: errorMessages[error.code] || 'Erro ao processar compra',
    error,
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

