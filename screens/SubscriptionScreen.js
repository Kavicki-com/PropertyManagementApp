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

      // Confere com o servidor, que revalida o recibo junto à Apple.
      // Roda ANTES de ler o perfil para que a tela já mostre o resultado.
      const syncResult = await checkAndSyncSubscriptionStatus(user.id);

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

      // Só avisamos de expiração quando o servidor CONFIRMOU o fim da
      // assinatura. Antes, qualquer falha de verificação disparava este alerta
      // e rebaixava o usuário — inclusive quem tinha acabado de renovar.
      if (syncResult.success && syncResult.synced && syncResult.newPlan === 'free') {
        Alert.alert(
          'Assinatura encerrada',
          'Sua assinatura não está mais ativa e você voltou ao plano gratuito. '
          + 'Para retomar os benefícios, escolha um plano abaixo.'
        );
      } else if (syncResult.needsRestore) {
        // O servidor não tem recibo guardado para este usuário, mas o perfil diz
        // que ele é assinante. É o caso de quem assinou antes desta versão.
        // Restaurar compras entrega o recibo e regulariza a conta.
        Alert.alert(
          'Confirme sua assinatura',
          'Precisamos reconfirmar sua assinatura com a App Store. '
          + 'Toque em "Restaurar compras" para manter seus benefícios.'
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
        // Cancelamento não é erro: não mostra nada, só libera o botão.
        console.log('SubscriptionScreen: Compra cancelada pelo usuário');
      } else if (result.deferred) {
        // "Ask to Buy": precisa da aprovação de um responsável. A compra pode
        // ser aprovada depois e chega pelo listener.
        Alert.alert(
          'Aguardando aprovação',
          'Sua compra precisa ser aprovada pelo responsável pela conta. '
          + 'Assim que for aprovada, seu plano será ativado automaticamente.'
        );
      } else {
        const errorMessage = result.error?.message || result.error || 'Erro ao processar compra';
        console.error('SubscriptionScreen: Erro ao processar compra:', result.error);
        Alert.alert('Erro na Compra', errorMessage);
      }
    } catch (error) {
      // purchaseSubscription rejeita com { success, error, cancelled } — um
      // cancelamento chega por aqui quando o listener rejeita a promise.
      if (error?.cancelled) {
        console.log('SubscriptionScreen: Compra cancelada pelo usuário');
      } else {
        console.error('SubscriptionScreen: Exceção ao processar compra:', error);
        Alert.alert('Erro', error?.error || 'Não foi possível processar a compra.');
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

    message += '📱 O cancelamento é feito nas configurações da Apple. Vamos te levar até lá.\n\n';
    message += 'Você continua com acesso ao plano atual até o fim do período já pago.';

    Alert.alert(
      'Cancelar assinatura',
      message,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Abrir configurações',
          style: 'destructive',
          onPress: openSubscriptionSettings,
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
      // restorePurchases lê o histórico da App Store (pode pedir a senha do
      // Apple ID — aceitável porque o usuário pediu) e manda o recibo ao
      // servidor, que decide o plano.
      console.log('SubscriptionScreen: Restaurando compras...');
      const result = await restorePurchases();

      if (!result.success) {
        Alert.alert('Erro', result.error || 'Não foi possível restaurar as compras.');
        return;
      }

      if (result.restored) {
        const planName = result.plan === 'basic' ? 'Básico' : 'Premium';
        Alert.alert('Sucesso', `Compras restauradas! Seu plano ${planName} está ativo.`);
        await setCache(CACHE_KEYS.DASHBOARD, null, 0);
        await loadSubscriptionData();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else {
        Alert.alert(
          'Nenhuma assinatura encontrada',
          result.message
          || 'Não encontramos uma assinatura ativa nesta conta da App Store. '
             + 'Verifique se está usando o mesmo Apple ID da compra.'
        );
        await loadSubscriptionData();
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

