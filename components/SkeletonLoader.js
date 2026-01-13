import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { colors, radii } from '../theme';

/**
 * Componente de Skeleton Loader para exibir placeholders durante carregamento
 */
const SkeletonLoader = ({ width, height, borderRadius = 8, style }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width || '100%',
          height: height || 20,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton para card de propriedade
 */
export const PropertyCardSkeleton = () => (
  <View style={styles.cardSkeleton}>
    <SkeletonLoader width="100%" height={150} borderRadius={12} />
    <View style={styles.cardContentSkeleton}>
      <SkeletonLoader width="80%" height={20} style={styles.marginBottom} />
      <SkeletonLoader width="60%" height={16} style={styles.marginBottom} />
      <View style={styles.cardFooterSkeleton}>
        <SkeletonLoader width={80} height={16} />
        <SkeletonLoader width={100} height={24} borderRadius={12} />
      </View>
    </View>
  </View>
);

/**
 * Skeleton para card de inquilino
 */
export const TenantCardSkeleton = () => (
  <View style={styles.tenantCardSkeleton}>
    <SkeletonLoader width={50} height={50} borderRadius={25} style={styles.tenantAvatarSkeleton} />
    <View style={styles.tenantContentSkeleton}>
      <SkeletonLoader width="70%" height={18} style={styles.marginBottom} />
      <View style={styles.tenantMetaSkeleton}>
        <SkeletonLoader width={16} height={16} borderRadius={8} />
        <SkeletonLoader width="60%" height={14} style={{ marginLeft: 5 }} />
      </View>
      <View style={[styles.tenantMetaSkeleton, { marginTop: 4 }]}>
        <SkeletonLoader width={16} height={16} borderRadius={8} />
        <SkeletonLoader width="80%" height={14} style={{ marginLeft: 5 }} />
      </View>
      <SkeletonLoader width={120} height={22} borderRadius={12} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
    </View>
    <View style={styles.tenantDueDateSkeleton}>
      <SkeletonLoader width={70} height={12} style={styles.marginBottom} />
      <SkeletonLoader width={60} height={16} />
    </View>
  </View>
);

/**
 * Skeleton para lista de propriedades
 */
export const PropertiesListSkeleton = ({ count = 3 }) => (
  <View>
    {Array.from({ length: count }).map((_, index) => (
      <PropertyCardSkeleton key={index} />
    ))}
  </View>
);

/**
 * Skeleton para lista de inquilinos
 */
export const TenantsListSkeleton = ({ count = 5 }) => (
  <View style={styles.tenantsListContainer}>
    {Array.from({ length: count }).map((_, index) => (
      <TenantCardSkeleton key={index} />
    ))}
  </View>
);

/**
 * Skeleton para cards de visão geral de finanças (Entradas, Despesas, Lucro)
 */
export const OverviewSkeleton = () => (
  <View style={styles.overviewRowSkeleton}>
    <View style={[styles.overviewCardSkeleton, styles.overviewCardSkeletonFirst]}>
      <SkeletonLoader width="60%" height={14} style={styles.marginBottom} />
      <SkeletonLoader width="80%" height={18} />
    </View>
    <View style={styles.overviewCardSkeleton}>
      <SkeletonLoader width="60%" height={14} style={styles.marginBottom} />
      <SkeletonLoader width="80%" height={18} />
    </View>
    <View style={[styles.overviewCardSkeleton, styles.overviewCardSkeletonLast]}>
      <SkeletonLoader width="60%" height={14} style={styles.marginBottom} />
      <SkeletonLoader width="80%" height={18} />
    </View>
  </View>
);

/**
 * Skeleton para card de transação financeira
 */
export const TransactionCardSkeleton = () => (
  <View style={styles.transactionCardSkeleton}>
    <View style={styles.transactionDetailsSkeleton}>
      <SkeletonLoader width="75%" height={16} />
      <SkeletonLoader width="90%" height={13} style={{ marginTop: 4 }} />
      <View style={styles.transactionActionsSkeleton}>
        <SkeletonLoader width={85} height={26} borderRadius={12} />
        <SkeletonLoader width={95} height={26} borderRadius={12} />
        <SkeletonLoader width={65} height={26} borderRadius={12} />
      </View>
    </View>
    <SkeletonLoader width={85} height={18} />
  </View>
);

/**
 * Skeleton para lista de transações financeiras
 */
export const FinancesListSkeleton = ({ count = 5 }) => (
  <View style={styles.financesListContainer}>
    {Array.from({ length: count }).map((_, index) => (
      <TransactionCardSkeleton key={index} />
    ))}
  </View>
);

/**
 * Skeleton para detalhes da propriedade
 */
export const PropertyDetailsSkeleton = () => (
  <View style={styles.detailsContainer}>
    {/* Galeria de imagens */}
    <View style={styles.section}>
      <SkeletonLoader width="40%" height={20} style={styles.marginBottom} />
      <View style={{ flexDirection: 'row', overflow: 'hidden' }}>
        <SkeletonLoader width={200} height={150} borderRadius={8} style={{ marginRight: 10 }} />
        <SkeletonLoader width={100} height={150} borderRadius={8} />
      </View>
    </View>

    {/* Endereço */}
    <View style={styles.section}>
      <SkeletonLoader width="30%" height={20} style={styles.marginBottom} />
      <SkeletonLoader width="80%" height={16} style={styles.marginBottom} />
      <SkeletonLoader width="60%" height={16} style={styles.marginBottom} />
      <SkeletonLoader width="40%" height={16} />
    </View>

    {/* Detalhes */}
    <View style={styles.section}>
      <SkeletonLoader width="50%" height={20} style={styles.marginBottom} />
      <View style={styles.rowSkeleton}>
        <SkeletonLoader width="30%" height={16} />
        <SkeletonLoader width="20%" height={16} />
      </View>
      <View style={[styles.rowSkeleton, { marginTop: 10 }]}>
        <SkeletonLoader width="30%" height={16} />
        <SkeletonLoader width="20%" height={16} />
      </View>
      <View style={[styles.rowSkeleton, { marginTop: 10 }]}>
        <SkeletonLoader width="30%" height={16} />
        <SkeletonLoader width="20%" height={16} />
      </View>
    </View>

    {/* Resumo Financeiro */}
    <View style={styles.section}>
      <SkeletonLoader width="50%" height={20} style={styles.marginBottom} />
      <View style={styles.rowSkeleton}>
        <SkeletonLoader width="30%" height={60} borderRadius={8} />
        <SkeletonLoader width="30%" height={60} borderRadius={8} />
        <SkeletonLoader width="30%" height={60} borderRadius={8} />
      </View>
    </View>
  </View>
);

/**
 * Skeleton para detalhes do inquilino
 */
export const TenantDetailsSkeleton = () => (
  <View style={styles.detailsContainer}>
    {/* Avatar e Nome */}
    <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 10 }}>
      <SkeletonLoader width={100} height={100} borderRadius={50} style={styles.marginBottom} />
      <SkeletonLoader width="60%" height={24} style={styles.marginBottom} />
      <SkeletonLoader width="40%" height={16} />
    </View>

    {/* Informações Pessoais */}
    <View style={styles.section}>
      <SkeletonLoader width="40%" height={20} style={styles.marginBottom} />
      <SkeletonLoader width="90%" height={16} style={styles.marginBottom} />
      <SkeletonLoader width="70%" height={16} style={styles.marginBottom} />
      <SkeletonLoader width="50%" height={16} />
    </View>

    {/* Contrato */}
    <View style={styles.section}>
      <SkeletonLoader width="50%" height={20} style={styles.marginBottom} />
      <SkeletonLoader width="100%" height={80} borderRadius={8} />
    </View>

    {/* Billing Summary */}
    <View style={styles.section}>
      <View style={styles.rowSkeleton}>
        <SkeletonLoader width="30%" height={60} borderRadius={8} />
        <SkeletonLoader width="30%" height={60} borderRadius={8} />
        <SkeletonLoader width="30%" height={60} borderRadius={8} />
      </View>
    </View>
  </View>
);

/**
 * Skeleton para cartão de usuário (Settings)
 */
export const UserCardSkeleton = () => (
  <View style={styles.userCardSkeleton}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <SkeletonLoader width={56} height={56} borderRadius={28} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <SkeletonLoader width="60%" height={18} style={{ marginBottom: 6 }} />
        <SkeletonLoader width="80%" height={14} />
      </View>
    </View>
    <SkeletonLoader width={100} height={30} borderRadius={16} style={{ marginTop: 16, alignSelf: 'center' }} />
  </View>
);

/**
 * Skeleton para edição de perfil
 */
export const EditProfileSkeleton = () => (
  <View style={styles.detailsContainer}>
    {/* Avatar */}
    <View style={styles.section}>
      <SkeletonLoader width="40%" height={24} style={styles.marginBottom} />
      <View style={{ alignItems: 'center', marginVertical: 10 }}>
        <SkeletonLoader width={120} height={120} borderRadius={60} />
        <SkeletonLoader width={150} height={16} style={{ marginTop: 12 }} />
      </View>
    </View>

    {/* Informações Pessoais */}
    <View style={styles.section}>
      <SkeletonLoader width="50%" height={24} style={styles.marginBottom} />

      {/* Inputs simulados */}
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={index} style={{ marginBottom: 15 }}>
          <SkeletonLoader width="30%" height={16} style={{ marginBottom: 8 }} />
          <SkeletonLoader width="100%" height={50} borderRadius={8} />
        </View>
      ))}
    </View>

    {/* Senha */}
    <View style={styles.section}>
      <SkeletonLoader width="40%" height={24} style={styles.marginBottom} />
      <SkeletonLoader width="100%" height={50} borderRadius={8} style={{ marginBottom: 15 }} />
      <SkeletonLoader width="100%" height={50} borderRadius={8} />
    </View>
  </View>
);

/**
 * Skeleton para a tela de assinaturas
 */
export const SubscriptionSkeleton = () => (
  <View style={styles.detailsContainer}>
    {/* Plano Atual */}
    <View style={styles.marginBottom}>
      <SkeletonLoader width="40%" height={24} style={styles.marginBottom} />
      <View style={[styles.cardSkeleton, { borderWidth: 2, borderColor: colors.borderSubtle || '#e0e0e0' }]}>
        <View style={styles.rowSkeleton}>
          <SkeletonLoader width="30%" height={24} />
          <SkeletonLoader width={60} height={24} borderRadius={12} />
        </View>
        <SkeletonLoader width="60%" height={16} style={{ marginTop: 15, marginBottom: 8 }} />
        <SkeletonLoader width="100%" height={8} borderRadius={4} style={{ marginBottom: 15 }} />
        <SkeletonLoader width="40%" height={14} />
      </View>
    </View>

    {/* Planos Disponíveis */}
    <View>
      <SkeletonLoader width="50%" height={24} style={styles.marginBottom} />

      {/* Cards de planos repetidos */}
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={index} style={styles.cardSkeleton}>
          <View style={styles.rowSkeleton}>
            <SkeletonLoader width="30%" height={20} />
            <SkeletonLoader width="30%" height={20} />
          </View>
          <SkeletonLoader width="50%" height={14} style={{ marginTop: 8, marginBottom: 15 }} />

          {/* Features */}
          {Array.from({ length: 4 }).map((_, fIndex) => (
            <View key={fIndex} style={[styles.rowSkeleton, { justifyContent: 'flex-start', marginBottom: 8 }]}>
              <SkeletonLoader width={20} height={20} borderRadius={10} style={{ marginRight: 10 }} />
              <SkeletonLoader width="70%" height={14} />
            </View>
          ))}

          <SkeletonLoader width="100%" height={45} borderRadius={25} style={{ marginTop: 15 }} />
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.borderSubtle || '#e0e0e0',
  },
  cardSkeleton: {
    backgroundColor: colors.surface || '#fff',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContentSkeleton: {
    padding: 15,
  },
  marginBottom: {
    marginBottom: 8,
  },
  cardFooterSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  tenantCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface || '#fff',
    borderRadius: radii.md || 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    width: '100%',
  },
  tenantAvatarSkeleton: {
    marginRight: 15,
  },
  tenantContentSkeleton: {
    flex: 1,
  },
  tenantMetaSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tenantDueDateSkeleton: {
    alignItems: 'center',
    paddingLeft: 10,
  },
  tenantsListContainer: {
    width: '100%',
  },
  overviewRowSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  overviewCardSkeleton: {
    flex: 1,
    backgroundColor: colors.surface || '#fff',
    borderRadius: radii.md || 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginRight: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  overviewCardSkeletonFirst: {
    // Primeiro card mantém marginRight
  },
  overviewCardSkeletonLast: {
    marginRight: 0,
  },
  transactionCardSkeleton: {
    backgroundColor: colors.surface || '#fff',
    borderRadius: radii.md || 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  transactionDetailsSkeleton: {
    flex: 1,
    marginRight: 10,
  },
  transactionActionsSkeleton: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  financesListContainer: {
    width: '100%',
  },
  detailsContainer: {
    padding: 15,
  },
  section: {
    backgroundColor: colors.surface || '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rowSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCardSkeleton: {
    backgroundColor: colors.surface || '#fff',
    borderRadius: radii.lg || 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default SkeletonLoader;