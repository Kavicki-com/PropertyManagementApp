import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, typography, radii } from '../theme';

const UpgradeModal = ({ visible, onClose, onUpgrade, currentPlan, propertyCount, requiredPlan, customMessage }) => {
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
            <Text style={styles.title}>Upgrade Necessário</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.message}>
              {customMessage || `Você está usando ${propertyCount} ${propertyCount === 1 ? 'imóvel' : 'imóveis'}. Para ${requiredPlan === 'basic' ? 'adicionar mais imóveis' : 'acessar todos os seus imóveis'}, você precisa fazer upgrade para o plano ${planNames[requiredPlan]}.`}
            </Text>

            <View style={styles.planComparison}>
              <View style={[styles.planCard, currentPlan === 'free' && styles.planCardNoBackground]}>
                <Text style={styles.planName}>{planNames[currentPlan]}</Text>
                <Text style={styles.planLimit}>
                  Até {planLimits[currentPlan]} {typeof planLimits[currentPlan] === 'number' ? 'imóveis' : ''}
                </Text>
                <Text style={[styles.planPrice, currentPlan === 'basic' && styles.planPriceGreen]}>
                  {planPrices[currentPlan]}
                </Text>
                <View style={[styles.badge, styles.currentBadge]}>
                  <Text style={styles.badgeText}>Plano Atual</Text>
                </View>
              </View>

              <MaterialIcons name="arrow-forward" size={24} color={colors.primary} style={styles.arrow} />

              <View style={[styles.planCard, styles.recommendedCard]}>
                <Text style={styles.planName}>{planNames[requiredPlan]}</Text>
                <Text style={styles.planLimit}>
                  {typeof planLimits[requiredPlan] === 'number' 
                    ? `Até ${planLimits[requiredPlan]} imóveis`
                    : planLimits[requiredPlan]}
                </Text>
                <Text style={[styles.planPrice, requiredPlan === 'basic' && styles.planPriceGreen]}>
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
                <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                <Text style={styles.featureText}>
                  {typeof planLimits[requiredPlan] === 'number' 
                    ? `Até ${planLimits[requiredPlan]} imóveis`
                    : 'Ilimitado imóveis'}
                </Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                <Text style={styles.featureText}>Acesso completo a todas as funcionalidades</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                <Text style={styles.featureText}>Suporte prioritário</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.upgradeButton} onPress={onUpgrade}>
              <Text style={styles.upgradeButtonText}>Assinar Agora</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    width: '100%',
    maxWidth: 516, // 500 + 16px (8px de cada lado)
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  title: {
    ...typography.sectionTitle,
    fontSize: 20,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  message: {
    ...typography.body,
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
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    maxWidth: '48%',
  },
  planCardNoBackground: {
    backgroundColor: 'transparent',
  },
  currentBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  recommendedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  planName: {
    ...typography.bodyStrong,
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'center',
  },
  planLimit: {
    ...typography.body,
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  planPrice: {
    ...typography.bodyStrong,
    fontSize: 14,
    color: colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  planPriceGreen: {
    color: '#4CAF50',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  currentBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  recommendedBadge: {
    backgroundColor: colors.primarySoft,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.primary,
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
    ...typography.bodyStrong,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    ...typography.body,
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.button,
    color: colors.textPrimary,
  },
  upgradeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  upgradeButtonText: {
    ...typography.button,
    color: '#fff',
  },
});

export default UpgradeModal;

