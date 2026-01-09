import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../theme';

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
    <SkeletonLoader width={50} height={50} borderRadius={25} />
    <View style={styles.tenantContentSkeleton}>
      <SkeletonLoader width="70%" height={18} style={styles.marginBottom} />
      <SkeletonLoader width="50%" height={14} />
    </View>
    <SkeletonLoader width={80} height={40} borderRadius={8} />
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
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: 'stretch',
  },
  tenantContentSkeleton: {
    flex: 1,
    marginLeft: 15,
  },
  tenantsListContainer: {
    width: '100%',
  },
});

export default SkeletonLoader;