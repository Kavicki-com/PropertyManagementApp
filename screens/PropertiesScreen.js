import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert, // Adicionado para melhor feedback de erro
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import SearchBar from '../components/SearchBar';
import { getBlockedProperties, getUserSubscription, getActivePropertiesCount, getRequiredPlan, canAddProperty } from '../lib/subscriptionService';
import UpgradeModal from '../components/UpgradeModal';
import { colors, radii, typography } from '../theme'; // Keep for fallbacks in hooks if needed, or remove if unused. Let's remove if unused.
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '../lib/cacheService';
import { PropertiesListSkeleton } from '../components/SkeletonLoader';

// Função para formatar endereço na listagem
const formatPropertyAddress = (item) => {
  if (item.street) {
    let address = item.street;
    if (item.number) address += `, ${item.number}`;
    if (item.neighborhood) address += ` - ${item.neighborhood}`;
    return address;
  }
  return item.address || 'Endereço não informado';
};

// Função para formatar valor monetário
const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00';
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
};

const PropertyItem = React.memo(({ item, onPress, isBlocked, styles, theme }) => {
  const hasTenant = item.tenants && item.tenants.length > 0;
  const status = hasTenant ? 'Alugada' : 'Disponível';
  const statusStyle = hasTenant ? styles.rented : styles.available;
  const statusTextStyle = hasTenant ? styles.rentedText : styles.availableText;

  const imageSource = (item.image_urls && item.image_urls.length > 0)
    ? item.image_urls[0]
    : require('../assets/property-placeholder.jpg');

  return (
    <TouchableOpacity
      style={[styles.propertyCard, isBlocked && styles.propertyCardBlocked]}
      onPress={() => onPress(item)}
      activeOpacity={isBlocked ? 0.5 : 0.7}
    >
      <Image
        source={imageSource}
        style={styles.propertyImage}
        contentFit="cover"
        transition={200}
        placeholder={require('../assets/property-placeholder.jpg')}
        priority="low"
        cachePolicy="memory-disk"
      />
      <View style={styles.propertyInfo}>
        <Text style={styles.propertyAddress} numberOfLines={2} ellipsizeMode="tail">
          {formatPropertyAddress(item)}
        </Text>
        {item.rent && (
          <Text style={styles.propertyRent} numberOfLines={1}>
            {formatCurrency(item.rent)}/mês
          </Text>
        )}
        <View style={styles.propertyMeta}>
          <Text style={styles.propertyType} numberOfLines={1}>
            {item.type}
          </Text>
          <View style={[styles.statusBadge, statusStyle]}>
            <Text style={[styles.statusText, statusTextStyle]} numberOfLines={1}>
              {status}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison para evitar re-renders desnecessários
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.isBlocked === nextProps.isBlocked &&
    prevProps.item.image_urls?.[0] === nextProps.item.image_urls?.[0] &&
    prevProps.item.rent === nextProps.item.rent &&
    prevProps.theme === nextProps.theme
  );
});

const PropertiesScreen = ({ navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Residencial' | 'Comercial'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'rented' | 'available'
  const [sortBy, setSortBy] = useState('addressAsc'); // 'rentAsc' | 'rentDesc' | 'addressAsc'
  const [showArchived, setShowArchived] = useState(false);
  const [blockedPropertyIds, setBlockedPropertyIds] = useState([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const isFocused = useIsFocused();
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  // Animar bottom sheet quando abrir/fechar
  useEffect(() => {
    if (showFiltersModal) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [showFiltersModal]);

  const fetchProperties = async (useCache = true) => {
    setLoading(true);

    // Tentar buscar do cache primeiro
    if (useCache) {
      const cachedData = await getCache(CACHE_KEYS.PROPERTIES);
      if (cachedData) {
        setProperties(cachedData);
        setLoading(false);

        // Buscar propriedades bloqueadas em background
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const blockedIds = await getBlockedProperties(user.id);
          setBlockedPropertyIds(blockedIds);
        }
        return;
      }
    }

    // Busca todas as propriedades; o filtro de status é aplicado em memória
    // Otimizar query para buscar apenas campos necessários
    const { data, error } = await supabase
      .from('properties')
      .select('id, address, street, number, neighborhood, city, state, rent, type, image_urls, tenants(id)')
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching properties:', error);
      Alert.alert("Erro", "Não foi possível carregar as propriedades.");
      setProperties([]);
    } else {
      const propertiesData = data || [];
      setProperties(propertiesData);

      // Salvar no cache
      await setCache(CACHE_KEYS.PROPERTIES, propertiesData, CACHE_TTL.DEFAULT);

      // Buscar propriedades bloqueadas
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const blockedIds = await getBlockedProperties(user.id);
        setBlockedPropertyIds(blockedIds);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isFocused) {
      fetchProperties(true); // Usar cache ao focar
    }
  }, [isFocused]);

  const handlePropertyPress = useCallback(async (property) => {
    // Verificar se a propriedade está bloqueada
    if (blockedPropertyIds.includes(property.id)) {
      // Buscar informações de assinatura para o modal
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const propertyCount = await getActivePropertiesCount(user.id);
        const subscription = await getUserSubscription(user.id);
        const currentPlan = subscription?.subscription_plan || 'free';
        // Se o plano atual é basic, sempre sugere premium
        const requiredPlan = currentPlan === 'basic' ? 'premium' : getRequiredPlan(propertyCount);

        setSubscriptionInfo({
          currentPlan,
          propertyCount,
          requiredPlan,
          subscriptionStatus: subscription?.subscription_status,
        });
        setShowUpgradeModal(true);
      }
    } else {
      navigation.navigate('PropertyDetails', { property });
    }
  }, [blockedPropertyIds, navigation]);

  const handleAddProperty = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    // Verificar se pode adicionar mais imóveis
    const canAdd = await canAddProperty(user.id);
    if (!canAdd) {
      const propertyCount = await getActivePropertiesCount(user.id);
      const subscription = await getUserSubscription(user.id);
      const currentPlan = subscription?.subscription_plan || 'free';
      // Se o plano atual é basic, sempre sugere premium
      const requiredPlan = currentPlan === 'basic' ? 'premium' : getRequiredPlan(propertyCount + 1);

      setSubscriptionInfo({
        currentPlan,
        propertyCount,
        requiredPlan,
        subscriptionStatus: subscription?.subscription_status,
      });
      setShowUpgradeModal(true);
      return;
    }

    // Se pode adicionar, navega normalmente
    navigation.navigate('AddProperty');
  };


  const { activeProperties, archivedProperties } = useMemo(() => {
    let result = [...properties];

    // Filtro por texto (endereço - busca em todos os campos)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((p) => {
        const searchableFields = [
          p.address,
          p.street,
          p.neighborhood,
          p.city,
          p.cep,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableFields.includes(query);
      });
    }

    // Filtro por tipo
    if (typeFilter !== 'all') {
      result = result.filter((p) => p.type === typeFilter);
    }

    // Filtro por status (alugada/disponível)
    if (statusFilter !== 'all') {
      result = result.filter((p) => {
        const hasTenant = p.tenants && p.tenants.length > 0;
        if (statusFilter === 'rented') {
          return hasTenant;
        } else if (statusFilter === 'available') {
          return !hasTenant;
        }
        return true;
      });
    }

    // Ordenação
    result.sort((a, b) => {
      if (sortBy === 'addressAsc') {
        const addrA = (a.address || '').toLowerCase();
        const addrB = (b.address || '').toLowerCase();
        return addrA.localeCompare(addrB);
      }

      const rentA = a.rent || 0;
      const rentB = b.rent || 0;

      if (sortBy === 'rentAsc') {
        return rentA - rentB;
      }

      // rentDesc
      return rentB - rentA;
    });

    const active = result.filter((p) => !p.archived_at);
    const archived = result.filter((p) => !!p.archived_at);

    // Separar propriedades bloqueadas e não bloqueadas
    const nonBlocked = active.filter((p) => !blockedPropertyIds.includes(p.id));
    const blocked = active.filter((p) => blockedPropertyIds.includes(p.id));

    // Ordenar: não bloqueadas primeiro, bloqueadas no final
    const sortedActive = [...nonBlocked, ...blocked];

    return { activeProperties: sortedActive, archivedProperties: archived };
  }, [properties, searchQuery, typeFilter, statusFilter, sortBy, blockedPropertyIds]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Propriedades</Text>
        </View>

        {loading && properties.length === 0 ? (
          <View style={styles.scrollContainer}>
            <PropertiesListSkeleton count={5} />
          </View>
        ) : (
          <>

            {/* Barra de busca e botão de filtros */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBarContainer}>
                <SearchBar
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar por endereço"
                />
              </View>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFiltersModal(true)}
              >
                <MaterialIcons name="tune" size={20} color={theme.colors.primary} />
                <Text style={styles.filterButtonText}>Filtros</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={activeProperties}
              renderItem={({ item }) => (
                <PropertyItem
                  item={item}
                  onPress={handlePropertyPress}
                  isBlocked={blockedPropertyIds.includes(item.id)}
                  styles={styles}
                  theme={theme}
                />
              )}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.listContent}
              onRefresh={() => fetchProperties(false)} // Não usar cache no refresh
              refreshing={loading}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={10}
              ListFooterComponent={
                archivedProperties.length > 0 ? (
                  <View style={styles.archivedSection}>
                    <TouchableOpacity
                      style={styles.archivedToggleButton}
                      onPress={() => setShowArchived(!showArchived)}
                    >
                      <Text style={styles.archivedToggleText}>
                        {showArchived
                          ? 'Ocultar imóveis arquivados'
                          : `Ver imóveis arquivados (${archivedProperties.length})`}
                      </Text>
                    </TouchableOpacity>

                    {showArchived && (
                      <View style={styles.archivedList}>
                        {archivedProperties.map((item) => (
                          <PropertyItem
                            key={item.id}
                            item={item}
                            onPress={handlePropertyPress}
                            styles={styles}
                            theme={theme}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                ) : null
              }
            />

            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddProperty}
            >
              <MaterialIcons name="add" size={30} color="white" />
            </TouchableOpacity>
          </>
        )}

        <UpgradeModal
          visible={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          onUpgrade={() => {
            setShowUpgradeModal(false);
            navigation.navigate('Subscription');
          }}
          currentPlan={subscriptionInfo?.currentPlan || 'free'}
          propertyCount={subscriptionInfo?.propertyCount || 0}
          requiredPlan={subscriptionInfo?.requiredPlan || 'basic'}
          subscriptionStatus={subscriptionInfo?.subscriptionStatus}
        />

        {/* Bottom Sheet de Filtros */}
        <Modal
          visible={showFiltersModal}
          transparent={true}
          animationType="none"
          onRequestClose={() => setShowFiltersModal(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowFiltersModal(false)}
          >
            <Animated.View
              style={[
                styles.bottomSheet,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.bottomSheetHeader}>
                  <Text style={styles.bottomSheetTitle}>Filtros</Text>
                  <TouchableOpacity
                    onPress={() => setShowFiltersModal(false)}
                    style={styles.closeButton}
                  >
                    <MaterialIcons name="close" size={24} color={theme.colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomSheetContent}>
                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Tipo</Text>
                    <View style={styles.filterChipsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          typeFilter === 'all' && styles.chipActive,
                        ]}
                        onPress={() => setTypeFilter('all')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            typeFilter === 'all' && styles.chipTextActive,
                          ]}
                        >
                          Todos
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          typeFilter === 'Residencial' && styles.chipActive,
                        ]}
                        onPress={() => setTypeFilter('Residencial')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            typeFilter === 'Residencial' && styles.chipTextActive,
                          ]}
                        >
                          Residencial
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          typeFilter === 'Comercial' && styles.chipActive,
                        ]}
                        onPress={() => setTypeFilter('Comercial')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            typeFilter === 'Comercial' && styles.chipTextActive,
                          ]}
                        >
                          Comercial
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Status</Text>
                    <View style={styles.filterChipsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          statusFilter === 'all' && styles.chipActive,
                        ]}
                        onPress={() => setStatusFilter('all')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            statusFilter === 'all' && styles.chipTextActive,
                          ]}
                        >
                          Todos
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          statusFilter === 'rented' && styles.chipActive,
                        ]}
                        onPress={() => setStatusFilter('rented')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            statusFilter === 'rented' && styles.chipTextActive,
                          ]}
                        >
                          Alugada
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          statusFilter === 'available' && styles.chipActive,
                        ]}
                        onPress={() => setStatusFilter('available')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            statusFilter === 'available' && styles.chipTextActive,
                          ]}
                        >
                          Disponível
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Ordenar por</Text>
                    <View style={styles.filterChipsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          sortBy === 'addressAsc' && styles.chipActive,
                        ]}
                        onPress={() => setSortBy('addressAsc')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            sortBy === 'addressAsc' && styles.chipTextActive,
                          ]}
                        >
                          Endereço A-Z
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          sortBy === 'rentAsc' && styles.chipActive,
                        ]}
                        onPress={() => setSortBy('rentAsc')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            sortBy === 'rentAsc' && styles.chipTextActive,
                          ]}
                        >
                          Aluguel ↑
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          sortBy === 'rentDesc' && styles.chipActive,
                        ]}
                        onPress={() => setSortBy('rentDesc')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            sortBy === 'rentDesc' && styles.chipTextActive,
                          ]}
                        >
                          Aluguel ↓
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    padding: 15,
    paddingTop: 50,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle || '#ddd',
  },
  header: {
    ...theme.typography.screenTitle,
    color: theme.colors.textPrimary || '#333',
  },
  listContent: {
    padding: 15,
    paddingBottom: 80,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: theme.colors.surface,
    marginTop: 4,
    gap: 10,
    alignItems: 'center',
  },
  searchBarContainer: {
    flex: 0.8,
    minWidth: 0,
  },
  filterButton: {
    flex: 0.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surface,
    gap: 6,
  },
  filterButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  bottomSheetTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  bottomSheetContent: {
    padding: 20,
  },
  filtersContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: theme.colors.surface,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 5,
  },
  filterGroup: {
    marginBottom: 6,
  },
  filterLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle || '#ddd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  propertyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
    ...(theme.isHighContrast ? {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
      shadowOpacity: 0,
      elevation: 0,
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  propertyCardBlocked: {
    opacity: 0.5,
  },
  propertyImage: {
    width: '100%',
    height: 150,
    backgroundColor: theme.colors.borderSubtle || '#e0e0e0',
  },
  propertyInfo: {
    padding: 15,
  },
  propertyAddress: {
    ...theme.typography.sectionTitle,
    marginBottom: 8,
    flexShrink: 1,
    color: theme.colors.textPrimary,
  },
  propertyRent: {
    ...theme.typography.bodyStrong,
    color: theme.colors.primary,
    marginBottom: 8,
    flexShrink: 1,
  },
  propertyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  propertyType: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 15,
    flexShrink: 0,
  },
  rented: {
    backgroundColor: theme.colors.successSoft || '#e8f5e9',
  },
  available: {
    backgroundColor: theme.colors.primarySoft || '#e3f2fd', // Assuming primarySoft is bluish
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: 'bold',
  },
  rentedText: {
    color: theme.colors.success || '#2e7d32',
  },
  availableText: {
    color: theme.colors.primary || '#1565c0',
  },
  archivedSection: {
    marginTop: 10,
  },
  archivedToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: theme.radii.pill,
    borderWidth: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  archivedToggleText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textDecorationLine: 'underline',
  },
  archivedList: {
    marginTop: 10,
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: theme.colors.primary,
    width: 60,
    height: 60,
    borderRadius: theme.radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default PropertiesScreen;