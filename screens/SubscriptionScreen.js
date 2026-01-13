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
  handlePurchaseSuccess,
  getProductIdForPlan,
} from '../lib/iapService';
import ScreenHeader from '../components/ScreenHeader';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';
import { SubscriptionSkeleton } from '../components/SkeletonLoader';

const SubscriptionScreen = ({ navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [propertyCount, setPropertyCount] = useState(0);
  const [products, setProducts] = useState([]);
  const [purchasing, setPurchasing] = useState(false);

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

      const result = await purchaseSubscription(productId);

      if (result.success && result.purchase) {
        const updateResult = await handlePurchaseSuccess(result.purchase, user.id);
        if (updateResult.success) {
          Alert.alert(
            'Sucesso',
            'Assinatura ativada com sucesso! Todos os seus imóveis e inquilinos existentes já estão disponíveis no novo limite.'
          );
          // Recarregar dados para aplicar novas regras
          // IMPORTANTE: getBlockedProperties e getBlockedTenants recalcularão automaticamente
          // baseado no novo plano, incluindo TODOS os imóveis/inquilinos existentes na contagem
          await loadSubscriptionData();
          // Forçar atualização das telas que podem ter bloqueios
          navigation.goBack();
        } else {
          Alert.alert('Erro', 'Compra realizada mas houve erro ao atualizar assinatura.');
        }
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

        console.error('Erro ao processar compra:', result.error);
        Alert.alert('Erro na Compra', errorMessage);
      }
    } catch (error) {
      console.error('Erro ao processar compra:', error);
      Alert.alert('Erro', 'Não foi possível processar a compra.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleDowngrade = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    // Verificar se há mais imóveis/inquilinos do que o plano free permite
    const [propertyCount, tenantCount] = await Promise.all([
      getActivePropertiesCount(user.id),
      getActiveTenantsCount(user.id),
    ]);

    const freeLimit = 2;
    const willBlockProperties = propertyCount > freeLimit;
    const willBlockTenants = tenantCount > freeLimit;

    if (willBlockProperties || willBlockTenants) {
      let message = 'Ao fazer downgrade para o plano Gratuito:\n\n';
      if (willBlockProperties) {
        message += `• Você terá acesso apenas aos primeiros ${freeLimit} imóveis (${propertyCount - freeLimit} serão bloqueados)\n`;
      }
      if (willBlockTenants) {
        message += `• Você terá acesso apenas aos primeiros ${freeLimit} inquilinos (${tenantCount - freeLimit} serão bloqueados)\n`;
      }
      message += '\nOs itens bloqueados ficarão disponíveis novamente quando você fizer upgrade. Deseja continuar?';

      Alert.alert('Atenção', message, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: async () => {
            await performDowngrade(user.id);
          },
        },
      ]);
    } else {
      Alert.alert(
        'Confirmar Downgrade',
        'Tem certeza que deseja fazer downgrade para o plano Gratuito?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar',
            style: 'destructive',
            onPress: async () => {
              await performDowngrade(user.id);
            },
          },
        ]
      );
    }
  };

  const performDowngrade = async (userId) => {
    setPurchasing(true);
    try {
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
        console.error('Erro ao fazer downgrade:', error);
        Alert.alert('Erro', 'Não foi possível fazer o downgrade.');
        return;
      }

      Alert.alert(
        'Sucesso',
        'Downgrade realizado com sucesso! Você agora está no plano Gratuito.'
      );
      await loadSubscriptionData();
      navigation.goBack();
    } catch (error) {
      console.error('Erro ao fazer downgrade:', error);
      Alert.alert('Erro', 'Não foi possível fazer o downgrade.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    setPurchasing(true);
    try {
      const result = await restorePurchases();
      if (result.success && result.purchases && result.purchases.length > 0) {
        // Processa cada compra restaurada
        let hasUpdates = false;
        for (const purchase of result.purchases) {
          const updateResult = await handlePurchaseSuccess(
            {
              productId: purchase.productId,
              transactionId: purchase.transactionId,
              purchaseTime: purchase.purchaseTime
            },
            user.id
          );
          if (updateResult.success) {
            hasUpdates = true;
          }
        }

        if (hasUpdates) {
          Alert.alert('Sucesso', 'Compras restauradas com sucesso!');
          await loadSubscriptionData();
        } else {
          Alert.alert('Info', 'Nenhuma compra ativa encontrada para restaurar.');
        }
      } else if (result.success) {
        Alert.alert('Info', 'Nenhuma compra encontrada para restaurar.');
      } else {
        const errorMessage = result.error?.message || result.error || 'Não foi possível restaurar as compras';
        Alert.alert('Erro', errorMessage);
      }
    } catch (error) {
      console.error('Erro ao restaurar compras:', error);
      Alert.alert('Erro', 'Não foi possível restaurar as compras.');
    } finally {
      setPurchasing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
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
              <Text style={styles.planCardName}>Gratuito</Text>
              <Text style={styles.planCardPrice}>R$ 0,00</Text>
            </View>
            <Text style={styles.planCardDescription}>Ideal para começar</Text>
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
              <Text style={styles.planCardName}>Básico</Text>
              <Text style={styles.planCardPrice}>R$ 19,90/mês</Text>
            </View>
            <Text style={styles.planCardDescription}>Para pequenos portfólios</Text>
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
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Text style={styles.upgradeButtonText}>Assinar</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Plano Premium */}
          <View style={[styles.planCard, currentPlan === 'premium' && styles.currentPlanCard]}>
            <View style={styles.planCardHeader}>
              <Text style={styles.planCardName}>Premium</Text>
              <Text style={styles.planCardPrice}>R$ 39,90/mês</Text>
            </View>
            <Text style={styles.planCardDescription}>Para grandes portfólios</Text>
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
                  <ActivityIndicator color={theme.colors.primary} />
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
            <TouchableOpacity onPress={() => Linking.openURL('http://llord.kavicki.com/')}>
              <Text style={styles.legalLink}>Termos de Uso</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>•</Text>
            <TouchableOpacity onPress={() => Linking.openURL('http://llord.kavicki.com/')}>
              <Text style={styles.legalLink}>Política de Privacidade</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
});

export default SubscriptionScreen;

