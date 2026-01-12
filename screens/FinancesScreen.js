// screens/FinancesScreen.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchAllFinances, calculateOverview } from '../lib/financesService';
import { supabase } from '../lib/supabase';
import RangeDatePicker from '../components/RangeDatePicker';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';
import SearchBar from '../components/SearchBar';
import { canAddFinancialTransaction, getUserSubscription, getActivePropertiesCount } from '../lib/subscriptionService';
import UpgradeModal from '../components/UpgradeModal';
import { removeCache, CACHE_KEYS } from '../lib/cacheService';
import SkeletonLoader, { OverviewSkeleton, FinancesListSkeleton } from '../components/SkeletonLoader';

const FinancesScreen = ({ navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState({ totalIncome: 0, totalExpenses: 0, netProfit: 0 });
  const [filterType, setFilterType] = useState('all'); // all | income | expense
  const [searchQuery, setSearchQuery] = useState('');
  const [customStartDate, setCustomStartDate] = useState(null); // Date | null
  const [customEndDate, setCustomEndDate] = useState(null); // Date | null
  const isFocused = useIsFocused();
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);

  const getDateRangeFromPeriod = () => {
    if (!customStartDate && !customEndDate) {
      // Sem datas definidas: não aplica filtro de período
      return { startDate: undefined, endDate: undefined };
    }

    const toISODate = (date) => {
      if (!date) return undefined;
      if (typeof date === 'string') return date;
      return date.toISOString().split('T')[0];
    };

    return {
      startDate: toISODate(customStartDate),
      endDate: toISODate(customEndDate),
    };
  };

  const fetchFinances = async () => {
    setLoading(true);
    setError(null);

    const { startDate, endDate } = getDateRangeFromPeriod();
    const { data, error: fetchError } = await fetchAllFinances({
      type: filterType,
      startDate,
      endDate,
    });

    if (fetchError) {
      console.error('Error fetching finances:', fetchError);
      setError('Não foi possível carregar os lançamentos financeiros.');
      setTransactions([]);
      setOverview({ totalIncome: 0, totalExpenses: 0, netProfit: 0 });
    } else {
      setTransactions(data);
      setOverview(calculateOverview(data));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isFocused) {
      fetchFinances();
    }
  }, [isFocused, filterType, customStartDate, customEndDate]);


  const getFilteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return transactions;

    return transactions.filter((t) => {
      const desc = (t.description || '').toLowerCase();
      const address = (t.properties?.address || '').toLowerCase();
      return desc.includes(query) || address.includes(query);
    });
  }, [transactions, searchQuery]);

  const formatCurrency = (value) => {
    return `R$${Number(value || 0).toFixed(2)}`;
  };

  const formatDate = (raw) => {
    if (!raw) return 'Sem data';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return 'Sem data';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleAddTransaction = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado.');
      return;
    }

    // Validar se pode adicionar lançamento financeiro
    const canAdd = await canAddFinancialTransaction(user.id);
    if (!canAdd) {
      const propertyCount = await getActivePropertiesCount(user.id);
      const subscription = await getUserSubscription(user.id);
      const currentPlan = subscription?.subscription_plan || 'free';
      // Se o plano atual é basic, sempre sugere premium
      const requiredPlan = currentPlan === 'basic' ? 'premium' : 'basic';

      setSubscriptionInfo({
        currentPlan,
        propertyCount,
        requiredPlan,
      });
      setShowUpgradeModal(true);
      return;
    }

    // Se pode adicionar, navega normalmente
    navigation.navigate('AddTransaction');
  };

  const handleDeleteTransaction = (transaction) => {
    Alert.alert(
      'Excluir lançamento',
      'Tem certeza que deseja excluir este lançamento financeiro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('finances')
              .delete()
              .eq('id', transaction.id);

            if (error) {
              console.error('Erro ao excluir lançamento:', error);
              Alert.alert('Erro', 'Não foi possível excluir o lançamento.');
              return;
            }

            // Invalidar cache relacionado
            await Promise.all([
              removeCache(CACHE_KEYS.FINANCES),
              removeCache(CACHE_KEYS.DASHBOARD),
              transaction.property_id ? removeCache(CACHE_KEYS.PROPERTY_DETAILS(transaction.property_id)) : Promise.resolve(),
            ]);

            // Remove da lista atual sem precisar recarregar tudo
            setTransactions((prev) => {
              const filtered = prev.filter((t) => t.id !== transaction.id);
              setOverview(calculateOverview(filtered));
              return filtered;
            });
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Finanças</Text>
      </View>
      <ScrollView style={styles.scrollContainer}>
        {loading ? (
          <>
            <View style={styles.section}>
              <SkeletonLoader width="40%" height={18} style={{ marginBottom: 15 }} />
              <OverviewSkeleton />

              <View style={styles.filtersRow}>
                <SkeletonLoader width={70} height={28} borderRadius={theme.radii.pill} style={{ marginRight: 8 }} />
                <SkeletonLoader width={80} height={28} borderRadius={theme.radii.pill} style={{ marginRight: 8 }} />
                <SkeletonLoader width={90} height={28} borderRadius={theme.radii.pill} />
              </View>

              <View style={styles.dateFilterRow}>
                <SkeletonLoader width={60} height={14} style={{ marginBottom: 4 }} />
                <SkeletonLoader width="100%" height={40} borderRadius={theme.radii.pill} />
              </View>

              <View style={styles.searchAndDateContainer}>
                <SkeletonLoader width="100%" height={50} borderRadius={theme.radii.pill} />
              </View>
            </View>

            <View style={styles.section}>
              <SkeletonLoader width="50%" height={18} style={{ marginBottom: 15 }} />
              <FinancesListSkeleton count={5} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Visão geral</Text>
              <View style={styles.overviewRow}>
                <View style={[styles.overviewCard, styles.overviewCardIncome]}>
                  <Text style={styles.overviewLabel}>Entradas</Text>
                  <Text style={styles.incomeAmount}>{formatCurrency(overview.totalIncome)}</Text>
                </View>
                <View style={[styles.overviewCard, styles.overviewCardExpense]}>
                  <Text style={styles.overviewLabel}>Despesas</Text>
                  <Text style={styles.expenseAmount}>{formatCurrency(overview.totalExpenses)}</Text>
                </View>
                <View style={[styles.overviewCard, styles.overviewCardProfit]}>
                  <Text style={styles.overviewLabel}>Lucro</Text>
                  <Text style={styles.profitAmount}>{formatCurrency(overview.netProfit)}</Text>
                </View>
              </View>

              <View style={styles.filtersRow}>
                <TouchableOpacity
                  style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
                  onPress={() => setFilterType('all')}
                >
                  <Text style={[styles.filterChipText, filterType === 'all' && styles.filterChipTextActive]}>
                    Todos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, filterType === 'income' && styles.filterChipActive]}
                  onPress={() => setFilterType('income')}
                >
                  <Text style={[styles.filterChipText, filterType === 'income' && styles.filterChipTextActive]}>
                    Entradas
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterChip, filterType === 'expense' && styles.filterChipActive]}
                  onPress={() => setFilterType('expense')}
                >
                  <Text style={[styles.filterChipText, filterType === 'expense' && styles.filterChipTextActive]}>
                    Despesas
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateFilterRow}>
                <Text style={styles.dateFilterLabel}>Período</Text>
                <TouchableOpacity
                  style={styles.periodField}
                  onPress={() => setShowRangePicker(true)}
                >
                  <MaterialIcons name="date-range" size={18} color={theme.colors.textSecondary} />
                  <Text style={styles.periodFieldText}>
                    {customStartDate && customEndDate
                      ? `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`
                      : customStartDate
                        ? `${formatDate(customStartDate)} - ...`
                        : 'Selecionar período'}
                  </Text>
                  {(customStartDate || customEndDate) && (
                    <TouchableOpacity
                      style={styles.periodClearButton}
                      onPress={() => {
                        setCustomStartDate(null);
                        setCustomEndDate(null);
                      }}
                    >
                      <MaterialIcons name="close" size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.searchAndDateContainer}>
                <SearchBar
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar por descrição ou imóvel"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lançamentos</Text>
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={fetchFinances}>
                    <Text style={styles.retryButtonText}>Tentar novamente</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!error && getFilteredTransactions.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>Nenhum lançamento neste período</Text>
                  <Text style={styles.emptySubtitle}>
                    Ajuste os filtros ou adicione o primeiro lançamento financeiro.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={handleAddTransaction}
                  >
                    <Text style={styles.emptyButtonText}>Adicionar lançamento</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!error && getFilteredTransactions.length > 0 && getFilteredTransactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDesc}>{transaction.description}</Text>
                    <Text style={styles.transactionMeta}>
                      {transaction.properties?.address || 'Sem imóvel vinculado'}
                      {transaction.tenants?.full_name
                        ? ` • ${transaction.tenants.full_name}`
                        : ' • Sem inquilino'}
                      {' • '}
                      {formatDate(transaction.date)}
                    </Text>
                    <View style={styles.transactionActionsRow}>
                      {transaction.property_id && (
                        <TouchableOpacity
                          style={styles.actionChip}
                          onPress={() => {
                            const minimalProperty = {
                              id: transaction.property_id,
                              address: transaction.properties?.address || 'Imóvel',
                            };
                            navigation.navigate('PropertyDetails', {
                              property: minimalProperty,
                            });
                          }}
                        >
                          <MaterialIcons name="home" size={16} color={theme.colors.primary} />
                          <Text style={styles.actionChipText}>Ver imóvel</Text>
                        </TouchableOpacity>
                      )}
                      {transaction.tenant_id && (
                        <TouchableOpacity
                          style={styles.actionChip}
                          onPress={() => {
                            const minimalTenant = {
                              id: transaction.tenant_id,
                              full_name: transaction.tenants?.full_name || 'Inquilino',
                            };
                            navigation.navigate('TenantDetails', {
                              tenant: minimalTenant,
                            });
                          }}
                        >
                          <MaterialIcons name="person" size={16} color={theme.colors.primary} />
                          <Text style={styles.actionChipText}>Ver inquilino</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.actionChip, styles.actionChipDanger]}
                        onPress={() => handleDeleteTransaction(transaction)}
                      >
                        <MaterialIcons name="delete" size={16} color={theme.colors.error || "#F44336"} />
                        <Text style={[styles.actionChipText, { color: theme.colors.error || '#F44336' }]}>Excluir</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.transactionAmount,
                      transaction.type === 'income' ? styles.income : styles.expense,
                    ]}
                  >
                    {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <RangeDatePicker
        visible={showRangePicker}
        startDate={
          customStartDate
            ? (typeof customStartDate === 'string'
              ? customStartDate
              : customStartDate.toISOString().split('T')[0])
            : null
        }
        endDate={
          customEndDate
            ? (typeof customEndDate === 'string'
              ? customEndDate
              : customEndDate.toISOString().split('T')[0])
            : null
        }
        onConfirm={(start, end) => {
          setCustomStartDate(start);
          setCustomEndDate(end);
        }}
        onClose={() => setShowRangePicker(false)}
      />
      <TouchableOpacity
        style={styles.addButton}
        onPress={handleAddTransaction}
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
        customMessage="O plano Gratuito não permite lançamentos financeiros. Faça upgrade para o plano Básico ou Premium para registrar recebimentos e despesas."
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
    padding: 15,
  },
  headerContainer: {
    padding: 15,
    paddingTop: 50,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  header: {
    ...theme.typography.screenTitle,
    color: theme.colors.textPrimary,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    marginBottom: 15,
    color: theme.colors.textPrimary,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginRight: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
    ...(theme.isHighContrast ? {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
      shadowOpacity: 0,
      elevation: 0,
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    }),
  },
  overviewCardIncome: {
  },
  overviewCardExpense: {
  },
  overviewCardProfit: {
    marginRight: 0,
  },
  overviewLabel: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  },
  incomeAmount: {
    ...theme.typography.bodyStrong,
    color: theme.colors.income,
  },
  expenseAmount: {
    ...theme.typography.bodyStrong,
    color: theme.colors.expense,
  },
  profitAmount: {
    ...theme.typography.bodyStrong,
    color: theme.colors.info || '#2196F3',
  },
  filtersRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle || '#ddd',
    marginRight: 8,
    backgroundColor: theme.colors.surface,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.textMuted || theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  searchAndDateContainer: {
    marginTop: 12,
  },
  dateFilterRow: {
    marginTop: 12,
  },
  dateFilterLabel: {
    ...theme.typography.caption,
    marginBottom: 4,
    color: theme.colors.textSecondary,
  },
  periodField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle || '#ddd',
    borderRadius: theme.radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
  },
  periodFieldText: {
    flex: 1,
    marginLeft: 6,
    ...theme.typography.caption,
    color: theme.colors.textPrimary,
  },
  periodClearButton: {
    width: 24,
    height: 24,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    }),
  },
  transactionDetails: {
    flex: 1,
    marginRight: 10,
  },
  transactionActionsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft || '#e3f2fd',
    marginRight: 8,
    marginBottom: 4,
  },
  actionChipDanger: {
    borderColor: theme.colors.error || '#F44336',
    backgroundColor: theme.colors.dangerSoft || '#ffebee',
  },
  actionChipText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  transactionDesc: {
    ...theme.typography.bodyStrong,
    color: theme.colors.textPrimary,
  },
  transactionMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  transactionAmount: {
    ...theme.typography.bodyStrong,
  },
  income: {
    color: theme.colors.income,
  },
  expense: {
    color: theme.colors.expense,
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
  errorContainer: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.dangerSoft,
    marginBottom: 16,
  },
  errorText: {
    color: theme.colors.danger || theme.colors.expense,
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.danger || theme.colors.expense,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
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
    paddingHorizontal: 20,
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
});

export default FinancesScreen;