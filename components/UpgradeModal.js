import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';

const UpgradeModal = ({ visible, onClose, onUpgrade, currentPlan, propertyCount, requiredPlan, customMessage, subscriptionStatus }) => {
  const { theme } = useAccessibilityTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isExpired = subscriptionStatus === 'expired';

  const planNames = {
    free: 'Gratuito',
    basic: 'Básico',
    premium: 'Premium',
  };

  const planLimits = {
    free: 2,
    basic: 10,
    premium: 'Ilimitado',
  };

  const planPrices = {
    free: 'R$ 0,00',
    basic: 'R$ 19,90/mês',
    premium: 'R$ 39,90/mês',
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{isExpired ? 'Renovação Necessária' : 'Upgrade Necessário'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.message}>
              {customMessage || (isExpired
                ? `Sua assinatura do plano ${planNames[requiredPlan] || 'Premium'} expirou. Para continuar aproveitando todos os benefícios e acessar seus imóveis, faça a renovação.`
                : `Você está usando ${propertyCount} ${propertyCount === 1 ? 'imóvel' : 'imóveis'}. Para ${requiredPlan === 'basic' ? 'adicionar mais imóveis' : 'acessar todos os seus imóveis'}, você precisa fazer upgrade para o plano ${planNames[requiredPlan]}.`
              )}
            </Text>

            <View style={styles.planComparison}>
              <View style={[
                styles.planCard,
                (currentPlan === 'free' || currentPlan === 'basic') && styles.planCardNoBackground
              ]}>
                <Text style={styles.planName}>{planNames[currentPlan]}</Text>
                <Text style={styles.planLimit}>
                  Até {planLimits[currentPlan]} {typeof planLimits[currentPlan] === 'number' ? 'imóveis' : ''}
                </Text>
                <Text style={[
                  styles.planPrice,
                  currentPlan === 'basic' && styles.planPriceDefault
                ]}>
                  {planPrices[currentPlan]}
                </Text>
                <View style={[styles.badge, styles.currentBadge]}>
                  <Text style={styles.badgeText}>Plano Atual</Text>
                </View>
              </View>

              <MaterialIcons name="arrow-forward" size={24} color={theme.colors.primary} style={styles.arrow} />

              <View style={[styles.planCard, styles.recommendedCard]}>
                <Text style={styles.planName}>{planNames[requiredPlan]}</Text>
                <Text style={styles.planLimit}>
                  {typeof planLimits[requiredPlan] === 'number'
                    ? `Até ${planLimits[requiredPlan]} imóveis`
                    : planLimits[requiredPlan]}
                </Text>
                <Text style={[styles.planPrice, (requiredPlan === 'basic' || requiredPlan === 'premium') && styles.planPriceGreen]}>
                  {planPrices[requiredPlan]}
                </Text>
                <View style={[styles.badge, styles.recommendedBadge]}>
                  <Text style={styles.badgeText} numberOfLines={1}>Recomendado</Text>
                </View>
              </View>
            </View>

            <View style={styles.features}>
              <Text style={styles.featuresTitle}>Benefícios do plano {planNames[requiredPlan]}:</Text>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>
                  {typeof planLimits[requiredPlan] === 'number'
                    ? `Até ${planLimits[requiredPlan]} imóveis`
                    : 'Ilimitado imóveis'}
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Acesso completo a todas as funcionalidades</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={20} color={theme.colors.primary} />
                <Text style={styles.featureText}>Suporte prioritário</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
              <Text style={styles.upgradeButtonText}>{isExpired ? 'Renovar Agora' : 'Assinar Agora'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    width: '100%',
    maxWidth: 516, // 500 + 16px (8px de cada lado)
    maxHeight: '80%',
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  title: {
    ...theme.typography.sectionTitle,
    fontSize: 20,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  message: {
    ...theme.typography.body,
    marginBottom: 20,
    textAlign: 'center',
  },
  planComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    flexWrap: 'nowrap',
    gap: 8,
  },
  planCard: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    maxWidth: '48%',
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    }),
  },
  planCardNoBackground: {
    backgroundColor: 'transparent',
  },
  currentBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  recommendedCard: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
    ...(theme.isHighContrast && {
      borderColor: theme.colors.textPrimary,
    }),
  },
  planName: {
    ...theme.typography.bodyStrong,
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  planLimit: {
    ...theme.typography.body,
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  planPrice: {
    ...theme.typography.bodyStrong,
    fontSize: 14,
    color: theme.colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  planPriceDefault: {
    color: theme.colors.textPrimary,
  },
  planPriceGreen: {
    color: '#4CAF50',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
  },
  currentBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  recommendedBadge: {
    backgroundColor: theme.colors.primarySoft,
  },
  badgeText: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  arrow: {
    marginHorizontal: 12,
  },
  features: {
    marginTop: 20,
  },
  featuresTitle: {
    ...theme.typography.bodyStrong,
    marginBottom: 12,
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
  actions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...theme.typography.button,
    color: theme.colors.textPrimary,
  },
  upgradeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  upgradeButtonText: {
    ...theme.typography.button,
    color: '#fff',
  },
});

export default UpgradeModal;

