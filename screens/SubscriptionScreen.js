import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import {
  getUserSubscription,
  getActivePropertiesCount,
  getActiveTenantsCount,
  getSubscriptionLimits,
  checkSubscriptionStatus,
  getRequiredPlan,
} from '../lib/subscriptionService';
import {
  getAvailableProducts,
  purchaseSubscription,
  restorePurchases,
  getProductIdForPlan,
  checkAndSyncSubscriptionStatus,
} from '../lib/iapService';
import { setCache, CACHE_KEYS } from '../lib/cacheService';
import ScreenHeader from '../components/ScreenHeader';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';
import { SubscriptionSkeleton } from '../components/SkeletonLoader';
import TermsModal from '../components/TermsModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';

/**
 * Helper para combinar dados do IAP com informações locais
 * Prioriza dados vindos da App Store (preço, título, descrição)
 * e mantém informações locais como fallback
 */
const enrichProductWithIAPData = (planType, iapProducts) => {
  const productId = getProductIdForPlan(planType);
  const iapProduct = iapProducts?.find(p => p.productId === productId);

  // Informações base (fallback se IAP não disponível)
  const baseInfo = {
    free: {
      title: 'Gratuito',
      price: 'R$ 0,00',
      description: 'Ideal para começar',
    },
    basic: {
      title: 'Básico',
      price: 'R$ 19,90/mês',
      description: 'Para pequenos portfólios',
    },
    premium: {
      title: 'Premium',
      price: 'R$ 39,90/mês',
      description: 'Para grandes portfólios',
    }
  };

  const plan = baseInfo[planType];

  // Se temos dados do IAP, usamos eles (prioridade)
  return {
    title: iapProduct?.title || plan.title,
    price: iapProduct?.localizedPrice ? `${iapProduct.localizedPrice}/mês` : plan.price,
    description: iapProduct?.description || plan.description,
  };
};

const SubscriptionScreen = ({ navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [propertyCount, setPropertyCount] = useState(0);
  const [products, setProducts] = useState([]);
  const [purchasing, setPurchasing] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

  // Processa dados dos planos combinando IAP + info local
  const planData = useMemo(() => {
    return {
      free: enrichProductWithIAPData('free', products),
      basic: enrichProductWithIAPData('basic', products),
      premium: enrichProductWithIAPData('premium', products)
    };
  }, [products]);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Erro', 'Usuário não autenticado');
        navigation.goBack();
        return;
      }

      // Sincroniza status da assinatura (apenas local para velocidade)
      // Se tiver expirado, o downgrade acontece aqui instantaneamente
      const syncResult = await checkAndSyncSubscriptionStatus(user.id, false);

      const [subscriptionData, count, productsData] = await Promise.all([
        getUserSubscription(user.id),
        getActivePropertiesCount(user.id),
        getAvailableProducts(),
      ]);

      setSubscription(subscriptionData);
      setPropertyCount(count);

      if (productsData.success) {
        setProducts(productsData.products || []);
      }

      // Feedback visual se houve expiração/downgrade automático
      if (syncResult.synced && syncResult.newPlan === 'free') {
        Alert.alert(
          'Plano Expirado',
          'Sua assinatura expirou e você retornou ao plano gratuito. Para continuar aproveitando os benefícios, faça uma nova assinatura.'
        );
      }
    } catch (error) {
      console.error('Erro ao carregar dados de assinatura:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados de assinatura.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    // Se for downgrade para free, não precisa de IAP
    if (plan === 'free') {
      handleDowngrade();
      return;
    }

    setPurchasing(true);
    try {
      const productId = getProductIdForPlan(plan);
      if (!productId) {
        Alert.alert('Erro', 'Produto não encontrado');
        setPurchasing(false);
        return;
      }

      console.log('SubscriptionScreen: Iniciando compra para productId:', productId);
      const result = await purchaseSubscription(productId);
      console.log('SubscriptionScreen: Resultado da compra:', JSON.stringify(result, null, 2));

      if (result.success && result.purchase) {
        console.log('SubscriptionScreen: Compra bem-sucedida via background listener.');
        Alert.alert(
          'Sucesso',
          'Assinatura ativada com sucesso! Todos os seus imóveis e inquilinos existentes já estão disponíveis no novo limite.'
        );
        // Recarregar dados para aplicar novas regras
        // IMPORTANTE: getBlockedProperties e getBlockedTenants recalcularão automaticamente
        // baseado no novo plano, incluindo TODOS os imóveis/inquilinos existentes na contagem
        console.log('SubscriptionScreen: Recarregando dados...');
        await setCache(CACHE_KEYS.DASHBOARD, null, 0); // Invalida cache do dashboard!
        await loadSubscriptionData();
        // Redireciona para o dashboard
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else if (result.cancelled) {
        // Usuário cancelou a compra - não mostra erro, apenas reseta estado
        console.log('SubscriptionScreen: Compra cancelada pelo usuário');
        // Não faz nada, setPurchasing(false) já reseta o estado no finally
      } else {
        // result.error pode ser um objeto com message ou uma string
        let errorMessage = result.error?.message || result.error || 'Erro ao processar compra';

        // Se for uma string longa (com múltiplas linhas), quebra em múltiplas linhas
        if (typeof errorMessage === 'string' && errorMessage.includes('\n')) {
          // Mantém a mensagem como está (já formatada)
        } else if (typeof errorMessage === 'string') {
          // Adiciona quebras de linha para melhor legibilidade
          errorMessage = errorMessage.replace(/\. /g, '.\n\n');
        }

        // Se for erro de timeout esperado (App vai tratar backgroundly), ignora silenciosamente.
        if (typeof errorMessage === 'string' && errorMessage.includes('System UI timeout')) {
          console.log('SubscriptionScreen: A tela de compra expirou a Promise da UI (System UI Timeout), mas o fluxo background continua ativo.');
        } else {
          console.error('SubscriptionScreen: Erro ao processar compra:', result.error);
          Alert.alert('Erro na Compra', errorMessage);
        }
      }
    } catch (error) {
      if (error && error.message && error.message.includes('System UI timeout')) {
        console.log('SubscriptionScreen: Exceção de timeout de UI esperada ignorada.');
      } else {
        console.error('SubscriptionScreen: Exceção ao processar compra:', error);
        Alert.alert('Erro', 'Não foi possível processar a compra.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  // Abre as configurações de assinatura do iOS
  const openSubscriptionSettings = async () => {
    if (Platform.OS === 'ios') {
      try {
        // URL para gerenciar assinaturas no iOS
        await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
      } catch (error) {
        console.error('Erro ao abrir configurações de assinatura:', error);
        Alert.alert(
          'Erro',
          'Não foi possível abrir as configurações. Por favor, vá em Ajustes > [seu nome] > Assinaturas.'
        );
      }
    } else {
      Alert.alert(
        'Gerenciar Assinatura',
        'Para gerenciar sua assinatura, acesse Ajustes > [seu nome] > Assinaturas no seu dispositivo.'
      );
    }
  };

  const handleDowngrade = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    // Verificar se há mais imóveis/inquilinos do que o plano free permite
    const [propCount, tenantCount] = await Promise.all([
      getActivePropertiesCount(user.id),
      getActiveTenantsCount(user.id),
    ]);

    const freeLimit = 2;
    const willBlockProperties = propCount > freeLimit;
    const willBlockTenants = tenantCount > freeLimit;

    let message = 'Tem certeza que deseja cancelar sua assinatura e fazer downgrade para o plano Gratuito?\n\n';

    if (willBlockProperties || willBlockTenants) {
      message += '⚠️ Atenção:\n';
      if (willBlockProperties) {
        message += `• Você terá acesso apenas aos primeiros ${freeLimit} imóveis (${propCount - freeLimit} serão bloqueados)\n`;
      }
      if (willBlockTenants) {
        message += `• Você terá acesso apenas aos primeiros ${freeLimit} inquilinos (${tenantCount - freeLimit} serão bloqueados)\n`;
      }
      message += '\nOs itens bloqueados ficarão disponíveis novamente quando você fizer upgrade.\n\n';
    }

    message += '📱 Importante: Para evitar cobranças futuras, lembre-se de cancelar também nas configurações do seu dispositivo (Ajustes > [seu nome] > Assinaturas).';

    Alert.alert(
      'Confirmar Cancelamento',
      message,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar Cancelamento',
          style: 'destructive',
          onPress: async () => {
            await performDowngrade(user.id);
          },
        },
      ]
    );
  };

  const performDowngrade = async (userId) => {
    setPurchasing(true);
    try {
      // Buscar dados atuais da assinatura para verificar se há período restante
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('subscription_expires_at, subscription_plan')
        .eq('id', userId)
        .single();

      const hasActiveSubscription = currentProfile?.subscription_expires_at &&
        new Date(currentProfile.subscription_expires_at) > new Date();

      let updateData;
      let successMessage;

      if (hasActiveSubscription) {
        // Mantém o plano atual até expirar, apenas marca como cancelled
        updateData = {
          subscription_status: 'cancelled',
          // Mantém subscription_plan, subscription_expires_at para o usuário continuar com acesso
        };
        const expiresDate = new Date(currentProfile.subscription_expires_at);
        const formattedDate = expiresDate.toLocaleDateString('pt-BR');
        successMessage = `Cancelamento confirmado! Você continuará com acesso ao plano ${currentProfile.subscription_plan === 'basic' ? 'Básico' : 'Premium'} até ${formattedDate}. Após essa data, seu plano será alterado para Gratuito.`;
      } else {
        // Sem período ativo, muda imediatamente para free
        updateData = {
          subscription_plan: 'free',
          subscription_status: 'active',
          subscription_expires_at: null,
          subscription_iap_transaction_id: null,
          subscription_trial_ends_at: null,
          subscription_grace_period_ends_at: null,
        };
        successMessage = 'Downgrade realizado com sucesso! Você agora está no plano Gratuito.';
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('Erro ao fazer downgrade:', error);
        Alert.alert('Erro', 'Não foi possível fazer o downgrade.');
        return;
      }

      Alert.alert('Sucesso', successMessage);
      // Redireciona para o dashboard
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (error) {
      console.error('Erro ao fazer downgrade:', error);
      Alert.alert('Erro', 'Não foi possível fazer o downgrade.');
    } finally {
      setPurchasing(false);
    }
  };

  // Marca a assinatura como cancelada (quando usuário já cancelou na Apple)
  const markAsCancelled = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    Alert.alert(
      'Confirmar',
      'Você já cancelou sua assinatura nas configurações da Apple? Esta ação irá atualizar o status para "Cancelado" no app.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, já cancelei',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ subscription_status: 'cancelled' })
                .eq('id', user.id);

              if (error) {
                Alert.alert('Erro', 'Não foi possível atualizar o status.');
                return;
              }

              Alert.alert(
                'Status Atualizado',
                'Seu status foi atualizado para "Cancelado". Você continuará com acesso até a data de expiração.'
              );
              await loadSubscriptionData();
            } catch (error) {
              console.error('Erro ao marcar como cancelado:', error);
              Alert.alert('Erro', 'Não foi possível atualizar o status.');
            }
          },
        },
      ]
    );
  };

  const handleRestore = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    setPurchasing(true);
    try {
      // Usa checkAndSyncSubscriptionStatus com forceAppleCheck = true
      // Isso força a consulta à Apple para buscar compras perdidas
      console.log('SubscriptionScreen: Iniciando restauração de compras (FORCE CHECK)...');
      const syncResult = await checkAndSyncSubscriptionStatus(user.id, true);

      console.log('SubscriptionScreen: Resultado da sincronização:', syncResult);

      if (syncResult.success && syncResult.synced) {
        // Plano foi atualizado com sucesso
        const planName = syncResult.newPlan === 'basic' ? 'Básico' : syncResult.newPlan === 'premium' ? 'Premium' : 'Gratuito';
        Alert.alert('Sucesso', `Compras restauradas! Plano atualizado para: ${planName}`);
        await setCache(CACHE_KEYS.DASHBOARD, null, 0); // Invalida cache do dashboard!
        await loadSubscriptionData();
        // Redireciona para o dashboard
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else if (syncResult.success && !syncResult.synced) {
        // Não havia mudanças necessárias
        Alert.alert('Info', syncResult.reason || 'Nenhuma alteração necessária. Plano já está sincronizado.');
      } else {
        // Erro ao sincronizar
        const errorMessage = syncResult.reason || 'Não foi possível restaurar as compras';
        Alert.alert('Erro', errorMessage);
      }
    } catch (error) {
      console.error('SubscriptionScreen: Erro ao restaurar compras:', error);
      Alert.alert('Erro', 'Não foi possível restaurar as compras.');
    } finally {
      setPurchasing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    let dateToParse = dateString;
    if (!dateToParse.endsWith('Z') && !dateToParse.includes('+') && dateToParse.length <= 23) {
      dateToParse += 'Z';
    }
    const date = new Date(dateToParse);
    return date.toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: theme.colors.primary, text: 'Ativo' },
      expired: { color: theme.colors.expense, text: 'Expirado' },
      cancelled: { color: theme.colors.textSecondary, text: 'Cancelado' },
      trial: { color: theme.colors.primary, text: 'Teste' },
    };

    const config = statusConfig[status] || statusConfig.active;
    return (
      <View style={[styles.badge, { backgroundColor: `${config.color}20` }]}>
        <Text style={[styles.badgeText, { color: config.color }]}>{config.text}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Assinatura" onBack={() => navigation.goBack()} />
        <ScrollView style={styles.scrollContainer}>
          <SubscriptionSkeleton />
        </ScrollView>
      </View>
    );
  }

  const currentPlan = subscription?.subscription_plan || 'free';
  const limits = getSubscriptionLimits(currentPlan);
  const status = subscription?.subscription_status || 'active';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Assinatura" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scrollContainer}>
        {/* Plano Atual */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Plano Atual</Text>
          <View style={styles.currentPlanCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>
                {currentPlan === 'free' ? 'Gratuito' : currentPlan === 'basic' ? 'Básico' : 'Premium'}
              </Text>
              {getStatusBadge(status)}
            </View>
            <View style={styles.usageContainer}>
              <Text style={styles.usageText}>
                {propertyCount} / {typeof limits.maxProperties === 'number' ? limits.maxProperties : '∞'} imóveis
              </Text>
              {typeof limits.maxProperties === 'number' && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min((propertyCount / limits.maxProperties) * 100, 100)}%` }
                    ]}
                  />
                </View>
              )}
            </View>
            {subscription?.subscription_expires_at && (
              <Text style={styles.expiresText}>
                Expira em: {formatDate(subscription.subscription_expires_at)}
              </Text>
            )}

          </View>
        </View>

        {/* Planos Disponíveis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Planos Disponíveis</Text>

          {/* Plano Gratuito */}
          <View style={[styles.planCard, currentPlan === 'free' && styles.currentPlanCard]}>
            <View style={styles.planCardHeader}>
              <Text style={styles.planCardName}>{planData.free.title}</Text>
              <Text style={styles.planCardPrice}>{planData.free.price}</Text>
            </View>
            <Text style={styles.planCardDescription}>{planData.free.description}</Text>
            <View style={styles.planFeatures}>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Até 2 imóveis</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Até 2 inquilinos</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Gestão de contratos</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>1 documento de inquilino</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.featureText, styles.featureDisabled]}>Lançamentos financeiros</Text>
              </View>
            </View>
            {currentPlan === 'free' ? (
              <View style={styles.currentButton}>
                <Text style={styles.currentButtonText}>Plano Atual</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.downgradeButton}
                onPress={handleDowngrade}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Text style={styles.downgradeButtonText}>Fazer Downgrade</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Plano Básico */}
          <View style={[styles.planCard, currentPlan === 'basic' && styles.currentPlanCard]}>
            <View style={styles.planCardHeader}>
              <Text style={styles.planCardName}>{planData.basic.title}</Text>
              <Text style={styles.planCardPrice}>{planData.basic.price}</Text>
            </View>
            <Text style={styles.planCardDescription}>{planData.basic.description}</Text>
            <View style={styles.planFeatures}>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Até 10 imóveis</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Até 10 inquilinos</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Gestão de contratos</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Documentos dos inquilinos</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Lançamentos financeiros</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Relatórios e dashboard</Text>
              </View>
            </View>
            {currentPlan === 'basic' ? (
              <View style={styles.currentButton}>
                <Text style={styles.currentButtonText}>Plano Atual</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => handlePurchase('basic')}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.upgradeButtonText}>Assinar</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Plano Premium */}
          <View style={[styles.planCard, currentPlan === 'premium' && styles.currentPlanCard]}>
            <View style={styles.planCardHeader}>
              <Text style={styles.planCardName}>{planData.premium.title}</Text>
              <Text style={styles.planCardPrice}>{planData.premium.price}</Text>
            </View>
            <Text style={styles.planCardDescription}>{planData.premium.description}</Text>
            <View style={styles.planFeatures}>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Ilimitado imóveis</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Ilimitado inquilinos</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Gestão de contratos</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Documentos dos inquilinos</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Lançamentos financeiros</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Relatórios e dashboard</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Suporte prioritário</Text>
              </View>
            </View>
            {currentPlan === 'premium' ? (
              <View style={styles.currentButton}>
                <Text style={styles.currentButtonText}>Plano Atual</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => handlePurchase('premium')}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.upgradeButtonText}>Assinar</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Restaurar Compras */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={purchasing}
          >
            <MaterialIcons name="restore" size={20} color={theme.colors.primary} />
            <Text style={styles.restoreButtonText}>Restaurar Compras</Text>
          </TouchableOpacity>
        </View>

        {/* Informações Legais - Obrigatório pela Apple */}
        <View style={styles.legalSection}>
          <Text style={styles.legalText}>
            • O pagamento será cobrado na sua conta Apple ID no momento da confirmação da compra.
          </Text>
          <Text style={styles.legalText}>
            • A assinatura renova automaticamente, a menos que seja cancelada pelo menos 24 horas antes do fim do período atual.
          </Text>
          <Text style={styles.legalText}>
            • A conta será cobrada pela renovação dentro de 24 horas antes do fim do período atual.
          </Text>
          <Text style={styles.legalText}>
            • Você pode gerenciar e cancelar suas assinaturas acessando Ajustes {'>'} [seu nome] {'>'} Assinaturas após a compra.
          </Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => setTermsModalVisible(true)}>
              <Text style={styles.legalLink}>Termos de Uso</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>•</Text>
            <TouchableOpacity onPress={() => setPrivacyModalVisible(true)}>
              <Text style={styles.legalLink}>Política de Privacidade</Text>
            </TouchableOpacity>
          </View>

          {/* Link para gerenciar assinaturas */}
          <TouchableOpacity
            style={styles.manageSubscriptionButton}
            onPress={openSubscriptionSettings}
          >
            <MaterialIcons name="settings" size={18} color={theme.colors.primary} />
            <Text style={styles.manageSubscriptionText}>Gerenciar Assinatura na App Store</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modais de Termos e Privacidade */}
      <TermsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
      />
      <PrivacyPolicyModal
        visible={privacyModalVisible}
        onClose={() => setPrivacyModalVisible(false)}
      />
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    marginBottom: 12,
  },
  currentPlanCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    ...(theme.isHighContrast && {
      borderColor: theme.colors.textPrimary,
      elevation: 0,
      shadowOpacity: 0,
    }),
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    ...theme.typography.sectionTitle,
    fontSize: 20,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
  },
  badgeText: {
    ...theme.typography.caption,
    fontWeight: '600',
  },
  usageContainer: {
    marginBottom: 8,
  },
  usageText: {
    ...theme.typography.body,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  expiresText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  cancelledLink: {
    marginTop: 12,
    paddingVertical: 4,
  },
  cancelledLinkText: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  planCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    }),
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planCardName: {
    ...theme.typography.sectionTitle,
    fontSize: 18,
  },
  planCardPrice: {
    ...theme.typography.bodyStrong,
    fontSize: 18,
    color: theme.colors.primary,
  },
  planCardDescription: {
    ...theme.typography.body,
    marginBottom: 12,
    color: theme.colors.textSecondary,
  },
  planFeatures: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    ...theme.typography.body,
    marginLeft: 8,
  },
  upgradeButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
  },
  upgradeButtonText: {
    ...theme.typography.button,
    color: '#fff',
  },
  currentButton: {
    backgroundColor: theme.colors.background,
    paddingVertical: 12,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  currentButtonText: {
    ...theme.typography.button,
    color: theme.colors.textSecondary,
  },
  downgradeButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
  },
  downgradeButtonText: {
    ...theme.typography.button,
    color: theme.colors.textSecondary,
  },
  featureDisabled: {
    color: theme.colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  restoreButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
    marginLeft: 8,
  },
  legalSection: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  legalText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  legalLink: {
    ...theme.typography.caption,
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginHorizontal: 8,
  },
  manageSubscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: `${theme.colors.primary}10`,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}30`,
  },
  manageSubscriptionText: {
    ...theme.typography.body,
    color: theme.colors.primary,
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default SubscriptionScreen;

