import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
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
import ScreenHeader from '../components/ScreenHeader';
import { fetchActiveContractsByTenants } from '../lib/contractsService';
import { fetchTenantBillingSummary } from '../lib/financesService';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';
import SearchBar from '../components/SearchBar';
import { getBlockedTenants, getUserSubscription, getActiveTenantsCount, getRequiredPlan, canAddTenant } from '../lib/subscriptionService';
import UpgradeModal from '../components/UpgradeModal';
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '../lib/cacheService';
import { TenantsListSkeleton } from '../components/SkeletonLoader';

// TenantItem atualizado para exibir mais informações
const TenantItem = React.memo(({ item, onPress, onPressPhone, isBlocked, hasActiveContract, styles, theme }) => {
  const imageSource = item.photo_url || require('../assets/avatar-placeholder.png');

  return (
    <TouchableOpacity
      style={[styles.tenantCard, isBlocked && styles.tenantCardBlocked]}
      onPress={() => onPress(item)}
      activeOpacity={isBlocked ? 0.5 : 0.7}
    >
      <Image
        source={imageSource}
        style={styles.avatar}
        contentFit="cover"
        transition={200}
        placeholder={require('../assets/avatar-placeholder.png')}
        priority="low"
        cachePolicy="memory-disk"
      />
      <View style={styles.tenantInfo}>
        <Text style={styles.tenantName}>{item.full_name}</Text>

        <View style={styles.tenantMetaRow}>
          <View style={styles.tenantMeta}>
            <MaterialIcons name="phone" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.tenantMetaText}>{item.phone || 'N/A'}</Text>
          </View>
        </View>

        {item.properties?.address && (
          <View style={styles.tenantMetaRow}>
            <MaterialIcons name="home" size={16} color={theme.colors.textSecondary} />
            <Text
              style={styles.tenantMetaText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.properties.address}
            </Text>
          </View>
        )}

        {hasActiveContract === false && (
          <View style={styles.invoiceBadgeNoContract}>
            <Text style={styles.invoiceBadgeTextNoContract}>
              Sem contrato ativo
            </Text>
          </View>
        )}

        {hasActiveContract !== false && typeof item.overdue_invoices === 'number' && (
          <View style={[
            styles.invoiceBadge,
            item.overdue_invoices === 0 && styles.invoiceBadgeSuccess,
            item.overdue_invoices > 0 && item.overdue_invoices <= 2 && styles.invoiceBadgeWarning,
            item.overdue_invoices > 2 && styles.invoiceBadgeError,
          ]}>
            <Text style={[
              styles.invoiceBadgeText,
              item.overdue_invoices === 0 && styles.invoiceBadgeTextSuccess,
              item.overdue_invoices > 0 && item.overdue_invoices <= 2 && styles.invoiceBadgeTextWarning,
              item.overdue_invoices > 2 && styles.invoiceBadgeTextError,
            ]}>
              {item.overdue_invoices > 0
                ? `${item.overdue_invoices} fatura(s) em atraso`
                : 'Sem faturas em atraso'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.dueDateContainer}>
        <Text style={styles.dueDateLabel}>Vencimento</Text>
        <Text style={styles.dueDateText}>Dia {item.due_date || 'N/A'}</Text>
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison para evitar re-renders desnecessários
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.isBlocked === nextProps.isBlocked &&
    prevProps.item.photo_url === nextProps.item.photo_url &&
    prevProps.item.overdue_invoices === nextProps.item.overdue_invoices &&
    prevProps.hasActiveContract === nextProps.hasActiveContract
  );
});

const TenantsScreen = ({ navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('nameAsc'); // 'nameAsc' | 'recent'
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // 'all' | 'available' | 'occupied' | 'noContract'
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all'); // 'all' | 'paid' | 'overdue'
  const [blockedTenantIds, setBlockedTenantIds] = useState([]);
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

  const fetchTenants = async (options = {}) => {
    const { search = '', useCache = true } = options;
    const trimmedSearch = search.trim();

    try {
      setError(null);
      if (!refreshing) setLoading(true);

      // Tentar buscar do cache se não houver busca ativa
      if (useCache && !trimmedSearch) {
        const cachedData = await getCache(CACHE_KEYS.TENANTS);
        if (cachedData) {
          setTenants(cachedData);
          setLoading(false);

          // Buscar propriedades bloqueadas em background
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const blockedIds = await getBlockedTenants(user.id);
            setBlockedTenantIds(blockedIds);
          }
          return;
        }
      }

      // 1) Buscar inquilinos com propriedade relacionada - query otimizada
      let tenantQuery = supabase
        .from('tenants')
        .select(`id, full_name, phone, email, property_id, photo_url, created_at, due_date, properties ( address, rent )`)
        .order('created_at', { ascending: false });

      if (trimmedSearch.length >= 3) {
        const pattern = `%${trimmedSearch}%`;
        tenantQuery = tenantQuery.or(
          `full_name.ilike.${pattern},phone.ilike.${pattern}`,
        );
      }

      const { data: tenantsData, error: tenantsError } = await tenantQuery;

      if (tenantsError) {
        console.error('Error fetching tenants:', tenantsError);
        setError('Não foi possível carregar os inquilinos.');
        setTenants([]);
        return;
      }

      // 2) Buscar contratos ativos por inquilino para obter dia de vencimento e período
      const tenantIds = (tenantsData || []).map((t) => t.id).filter(Boolean);
      const { data: contractsByTenant } = await fetchActiveContractsByTenants(tenantIds);

      // 3) Calcular status de pagamento para cada inquilino - otimizado com Promise.allSettled e cache
      const billingPromises = (tenantsData || []).map(async (tenant) => {
        const contract = contractsByTenant?.[tenant.id] || null;

        if (!contract || !contract.start_date || !contract.lease_term || !contract.due_day || !tenant.property_id) {
          return {
            tenant,
            overdue_invoices: 0,
            due_date: tenant.due_date || null,
            hasActiveContract: false,
          };
        }

        // Tentar buscar do cache primeiro
        const cacheKey = `billing_${tenant.id}_${contract.property_id}`;
        const cachedBilling = await getCache(cacheKey);

        let overdue_invoices = 0;

        if (cachedBilling !== null) {
          overdue_invoices = cachedBilling.overdue || 0;
        } else {
          // Calcular billing summary
          const source = {
            property_id: contract.property_id,
            tenant_id: contract.tenant_id,
            start_date: contract.start_date,
            due_date: contract.due_day,
            lease_term: contract.lease_term,
          };

          try {
            const { summary } = await fetchTenantBillingSummary(source);
            overdue_invoices = summary.overdue || 0;

            // Cachear resultado com TTL curto (10s) porque é dinâmico
            await setCache(cacheKey, { overdue: overdue_invoices }, CACHE_TTL.SHORT);
          } catch (error) {
            console.error(`Erro ao buscar billing para tenant ${tenant.id}:`, error);
            overdue_invoices = 0;
          }
        }

        return {
          tenant,
          overdue_invoices,
          due_date: contract.due_day != null ? contract.due_day : (tenant.due_date || null),
          hasActiveContract: true,
        };
      });

      // Usar Promise.allSettled para não bloquear se uma falhar
      const billingResults = await Promise.allSettled(billingPromises);

      const tenantsWithInvoices = billingResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          const { tenant, overdue_invoices, due_date, hasActiveContract } = result.value;
          return {
            ...tenant,
            overdue_invoices,
            due_date,
            hasActiveContract,
          };
        } else {
          // Em caso de erro, retornar dados básicos
          const tenant = tenantsData[index];
          const contract = contractsByTenant?.[tenant.id] || null;
          return {
            ...tenant,
            overdue_invoices: 0,
            due_date: tenant.due_date || null,
            hasActiveContract: !!contract,
          };
        }
      });

      setTenants(tenantsWithInvoices);

      // Salvar no cache se não houver busca ativa
      if (!trimmedSearch) {
        await setCache(CACHE_KEYS.TENANTS, tenantsWithInvoices, CACHE_TTL.DEFAULT);
      }

      // Buscar inquilinos bloqueados
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const blockedIds = await getBlockedTenants(user.id);
        setBlockedTenantIds(blockedIds);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchTenants({ search: searchQuery, useCache: true });
    }
  }, [isFocused]);

  useEffect(() => {
    // Evita recarregar logo no primeiro render com busca vazia
    // e só executa quando a tela está focada e há texto de busca.
    if (!isFocused) return;

    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const timeout = setTimeout(() => {
      fetchTenants({ search: trimmed, useCache: false }); // Não usar cache em busca
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery, isFocused]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTenants({ search: searchQuery, useCache: false }); // Não usar cache no refresh
  }, [searchQuery]);

  const handleAddTenant = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    // Verificar se pode adicionar mais inquilinos
    const canAdd = await canAddTenant(user.id);
    if (!canAdd) {
      const tenantCount = await getActiveTenantsCount(user.id);
      const subscription = await getUserSubscription(user.id);
      const currentPlan = subscription?.subscription_plan || 'free';
      // Se o plano atual é basic, sempre sugere premium
      const requiredPlan = currentPlan === 'basic' ? 'premium' : getRequiredPlan(tenantCount + 1);

      setSubscriptionInfo({
        currentPlan,
        propertyCount: tenantCount,
        requiredPlan,
        subscriptionStatus: subscription?.subscription_status,
      });
      setShowUpgradeModal(true);
      return;
    }

    // Se pode adicionar, navega normalmente
    navigation.navigate('AddTenant');
  };

  const handleTenantPress = useCallback(async (tenant) => {
    // Verificar se o inquilino está bloqueado
    if (blockedTenantIds.includes(tenant.id)) {
      // Buscar informações de assinatura para o modal
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const tenantCount = await getActiveTenantsCount(user.id);
        const subscription = await getUserSubscription(user.id);
        const currentPlan = subscription?.subscription_plan || 'free';
        // Se o plano atual é basic, sempre sugere premium
        const requiredPlan = currentPlan === 'basic' ? 'premium' : getRequiredPlan(tenantCount);

        setSubscriptionInfo({
          currentPlan,
          propertyCount: tenantCount,
          requiredPlan,
          subscriptionStatus: subscription?.subscription_status,
        });
        setShowUpgradeModal(true);
      }
    } else {
      navigation.navigate('TenantDetails', { tenant });
    }
  }, [blockedTenantIds, navigation]);

  const filteredTenants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let result = [...tenants];

    // Filtro por texto (nome ou telefone)
    if (query) {
      result = result.filter((tenant) => {
        const name = (tenant.full_name || '').toLowerCase();
        const phone = (tenant.phone || '').toLowerCase();
        return name.includes(query) || phone.includes(query);
      });
    }

    // Filtro por disponibilidade
    if (availabilityFilter !== 'all') {
      result = result.filter((tenant) => {
        if (availabilityFilter === 'occupied') {
          return tenant.hasActiveContract === true;
        } else if (availabilityFilter === 'noContract') {
          // Sem contrato = sem contrato ativo
          return tenant.hasActiveContract === false;
        }
        return true;
      });
    }

    // Filtro por status de pagamento
    if (paymentStatusFilter !== 'all') {
      result = result.filter((tenant) => {
        // Só aplicar filtro de pagamento se tiver contrato ativo
        if (tenant.hasActiveContract !== true) {
          return false; // Sem contrato não tem status de pagamento
        }

        if (paymentStatusFilter === 'paid') {
          return typeof tenant.overdue_invoices === 'number' && tenant.overdue_invoices === 0;
        } else if (paymentStatusFilter === 'overdue') {
          return typeof tenant.overdue_invoices === 'number' && tenant.overdue_invoices > 0;
        }
        return true;
      });
    }

    // Ordenação
    result.sort((a, b) => {
      if (sortBy === 'nameAsc') {
        const nameA = (a.full_name || '').toLowerCase();
        const nameB = (b.full_name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      } else if (sortBy === 'recent') {
        // Ordenar por data de criação (mais recente primeiro)
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
      }
      return 0;
    });

    // Separar inquilinos bloqueados e não bloqueados
    const nonBlocked = result.filter((t) => !blockedTenantIds.includes(t.id));
    const blocked = result.filter((t) => blockedTenantIds.includes(t.id));

    // Ordenar: não bloqueados primeiro, bloqueados no final
    return [...nonBlocked, ...blocked];
  }, [tenants, searchQuery, sortBy, availabilityFilter, paymentStatusFilter, blockedTenantIds]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <ScreenHeader title="Inquilinos" />

        <View style={styles.searchContainer}>
          <View style={styles.searchBarContainer}>
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar por nome ou telefone"
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

        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.listContent}>
              <TenantsListSkeleton count={5} />
            </View>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchTenants}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredTenants}
            renderItem={({ item }) => (
              <TenantItem
                item={item}
                onPress={handleTenantPress}
                isBlocked={blockedTenantIds.includes(item.id)}
                hasActiveContract={item.hasActiveContract}
                styles={styles}
                theme={theme}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Nenhum inquilino encontrado</Text>
                <Text style={styles.emptySubtitle}>
                  Use a busca ou adicione um novo inquilino.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleAddTenant}
                >
                  <Text style={styles.emptyButtonText}>Adicionar inquilino</Text>
                </TouchableOpacity>
              </View>
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={10}
            windowSize={10}
          />
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddTenant}
        >
          <MaterialIcons name="add" size={30} color="white" />
        </TouchableOpacity>

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
                    <Text style={styles.filterLabel}>Ordenar por</Text>
                    <View style={styles.filterChipsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          sortBy === 'nameAsc' && styles.chipActive,
                        ]}
                        onPress={() => setSortBy('nameAsc')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            sortBy === 'nameAsc' && styles.chipTextActive,
                          ]}
                        >
                          A-Z
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          sortBy === 'recent' && styles.chipActive,
                        ]}
                        onPress={() => setSortBy('recent')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            sortBy === 'recent' && styles.chipTextActive,
                          ]}
                        >
                          Recentes
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Disponibilidade</Text>
                    <View style={styles.filterChipsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          availabilityFilter === 'all' && styles.chipActive,
                        ]}
                        onPress={() => setAvailabilityFilter('all')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            availabilityFilter === 'all' && styles.chipTextActive,
                          ]}
                        >
                          Todos
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          availabilityFilter === 'occupied' && styles.chipActive,
                        ]}
                        onPress={() => setAvailabilityFilter('occupied')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            availabilityFilter === 'occupied' && styles.chipTextActive,
                          ]}
                        >
                          Ocupado
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          availabilityFilter === 'noContract' && styles.chipActive,
                        ]}
                        onPress={() => setAvailabilityFilter('noContract')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            availabilityFilter === 'noContract' && styles.chipTextActive,
                          ]}
                        >
                          Sem contrato
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Status de pagamento</Text>
                    <View style={styles.filterChipsContainer}>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          paymentStatusFilter === 'all' && styles.chipActive,
                        ]}
                        onPress={() => setPaymentStatusFilter('all')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            paymentStatusFilter === 'all' && styles.chipTextActive,
                          ]}
                        >
                          Todos
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          paymentStatusFilter === 'paid' && styles.chipActive,
                        ]}
                        onPress={() => setPaymentStatusFilter('paid')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            paymentStatusFilter === 'paid' && styles.chipTextActive,
                          ]}
                        >
                          Em dia
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          paymentStatusFilter === 'overdue' && styles.chipActive,
                        ]}
                        onPress={() => setPaymentStatusFilter('overdue')}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            paymentStatusFilter === 'overdue' && styles.chipTextActive,
                          ]}
                        >
                          Em atraso
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
  listContent: {
    padding: 15,
    paddingBottom: 80,
  },
  tenantCardBlocked: {
    opacity: 0.5,
  },
  tenantCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    ...(theme.isHighContrast ? {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
      shadowOpacity: 0,
      elevation: 0,
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tenantName: {
    ...theme.typography.bodyStrong,
    marginBottom: 5,
    color: theme.colors.textPrimary,
  },
  tenantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenantMetaText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: 5,
  },
  dueDateContainer: {
    alignItems: 'center',
    paddingLeft: 10,
  },
  dueDateLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  dueDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
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
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
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
    borderBottomColor: theme.colors.borderSubtle || '#e0e0e0',
  },
  bottomSheetTitle: {
    ...theme.typography.sectionTitle,
    fontSize: 20,
    color: theme.colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  bottomSheetContent: {
    padding: 20,
  },
  filterGroup: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
  },
  chipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 8,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: theme.colors.expense,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  emptyTitle: {
    ...theme.typography.bodyStrong,
    marginBottom: 4,
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    ...theme.typography.body,
    marginBottom: 12,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  emptyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  invoiceBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: '#eef7ff', // Could be dynamic
  },
  invoiceBadgeSuccess: {
    backgroundColor: '#e8f5e9',
  },
  invoiceBadgeWarning: {
    backgroundColor: '#fff3cd',
  },
  invoiceBadgeError: {
    backgroundColor: '#ffebee',
  },
  invoiceBadgeText: {
    fontSize: 11,
    color: '#1e88e5',
  },
  invoiceBadgeTextSuccess: {
    color: '#2e7d32',
  },
  invoiceBadgeTextWarning: {
    color: '#f57c00',
  },
  invoiceBadgeTextError: {
    color: '#c62828',
  },
  invoiceBadgeNoContract: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: '#e3f2fd',
  },
  invoiceBadgeTextNoContract: {
    fontSize: 11,
    color: '#1976d2',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});

export default TenantsScreen;

