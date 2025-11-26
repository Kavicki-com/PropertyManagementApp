// screens/DashboardScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { fetchActiveContractsByTenants } from '../lib/contractsService';
import { useIsFocused } from '@react-navigation/native';
import { startOfMonth, endOfMonth, format, differenceInDays, setDate } from 'date-fns';

const DashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState({
    rentCollected: 0,
    activeTenants: 0,
    propertyCount: 0,
    occupancyRate: 0,
  });
  const [upcomingRents, setUpcomingRents] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const isFocused = useIsFocused();

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

  const computeUpcomingRents = (tenants, contractsMap) => {
    const today = new Date();
    const items = [];

    tenants.forEach(tenant => {
      const contract = contractsMap[tenant.id];
      if (!contract || !contract.due_day || !contract.rent_amount) return;

      let dueDateThisMonth = setDate(today, contract.due_day);

      if (differenceInDays(dueDateThisMonth, today) < 0) {
        dueDateThisMonth.setMonth(dueDateThisMonth.getMonth() + 1);
      }

      const daysDiff = differenceInDays(dueDateThisMonth, today);
      items.push({
        id: tenant.id || `${tenant.full_name}-${tenant.due_date}-${tenant.property_id || 'no-property'}`,
        name: tenant.full_name,
        days: daysDiff,
        date: dueDateThisMonth,
        propertyAddress: tenant.properties?.address,
        amount: contract.rent_amount,
      });
    });

    const sorted = items
      .filter(item => item.days >= 0 && item.days <= 7)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5);

    setUpcomingRents(sorted);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    const today = new Date();
    const startDate = format(startOfMonth(today), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(today), 'yyyy-MM-dd');

    // --- All data fetching promises ---
    const financePromise = supabase
      .from('finances')
      .select('amount')
      .eq('type', 'income')
      .gte('date', startDate)
      .lte('date', endDate);

    const tenantsPromise = supabase
      .from('tenants')
      .select('id, full_name, due_date, property_id, properties (address)');
    
    const recentTransactionsPromise = supabase
        .from('finances')
        .select('*, properties (address)')
        .order('date', { ascending: false })
        .limit(5);

    const propertyCountPromise = supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null);

    // --- Execute all promises concurrently ---
    const [
      { data: financeData, error: financeError },
      { data: tenantsData, error: tenantsError },
      { data: recentTransactionsData, error: recentTransactionsError },
      { count: propertyCount, error: propertyError },
    ] = await Promise.all([
      financePromise,
      tenantsPromise,
      recentTransactionsPromise,
      propertyCountPromise,
    ]);


    if (financeError || tenantsError || propertyError || recentTransactionsError) {
      console.error(
        'Error fetching dashboard data:',
        financeError || tenantsError || propertyError || recentTransactionsError
      );
      setError('Não foi possível carregar os dados do início. Tente novamente.');
      setStats({
        rentCollected: 0,
        activeTenants: 0,
        propertyCount: 0,
        occupancyRate: 0,
      });
      setUpcomingRents([]);
      setRecentTransactions([]);
    } else {
      // Buscar contratos ativos para calcular próximos vencimentos com valor
      const tenantIds = (tenantsData || []).map(t => t.id);
      const { data: contractsMap } = await fetchActiveContractsByTenants(tenantIds);

      const totalIncome = (financeData || []).reduce(
        (sum, transaction) => sum + (transaction.amount || 0),
        0
      );
      const activeTenants = tenantsData ? tenantsData.length : 0;
      const occupiedProperties = tenantsData ? tenantsData.filter(t => t.property_id).length : 0;
      const occupancyRate = propertyCount > 0 ? (occupiedProperties / propertyCount) * 100 : 0;

      setStats({
        rentCollected: totalIncome,
        activeTenants: activeTenants,
        propertyCount: propertyCount || 0,
        occupancyRate: occupancyRate,
      });

      if (tenantsData) {
        computeUpcomingRents(tenantsData, contractsMap || {});
      } else {
        setUpcomingRents([]);
      }

      if (recentTransactionsData) {
        setRecentTransactions(recentTransactionsData);
      } else {
        setRecentTransactions([]);
      }
    }

    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchDashboardData();
    }
  }, [isFocused]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.loadingSkeletonContainer}>
          <View style={styles.loadingSkeletonHeader} />
          <View style={styles.loadingSkeletonCard} />
          <View style={styles.loadingSkeletonCard} />
          <View style={styles.loadingSkeletonCard} />
          <ActivityIndicator size="large" style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Início</Text>
      </View>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity style={styles.errorBannerButton} onPress={fetchDashboardData}>
            <Text style={styles.errorBannerButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4a86e8']} />
        }
      >
        {/* Bloco 1 – KPIs principais */}
        <View style={styles.sectionPlain}>
          <Text style={styles.sectionTitle}>Visão geral</Text>
          <View style={styles.kpiRow}>
            <TouchableOpacity
              style={styles.kpiCard}
              onPress={() => navigation.navigate('Finanças')}
            >
              <View style={[styles.kpiIconContainer, { backgroundColor: '#4a86e8' }]}>
                <MaterialIcons name="attach-money" size={22} color="#fff" />
              </View>
              <Text style={styles.kpiLabel}>Recebido no mês</Text>
              <Text style={styles.kpiValue}>{formatCurrency(stats.rentCollected)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.kpiCard}
              onPress={() => navigation.navigate('Imóveis')}
            >
              <View style={[styles.kpiIconContainer, { backgroundColor: '#4CAF50' }]}>
                <MaterialIcons name="home" size={22} color="#fff" />
              </View>
              <Text style={styles.kpiLabel}>Ocupação</Text>
              <Text style={styles.kpiValue}>
                {Number.isFinite(stats.occupancyRate)
                  ? `${stats.occupancyRate.toFixed(1)}%`
                  : '0%'}
              </Text>
              <Text style={styles.kpiSubLabel}>
                {stats.propertyCount > 0
                  ? `${Math.round((stats.occupancyRate / 100) * stats.propertyCount)} de ${
                      stats.propertyCount
                    } imóveis`
                  : 'Nenhum imóvel cadastrado'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.kpiCard}
              onPress={() => navigation.navigate('Inquilinos')}
            >
              <View style={[styles.kpiIconContainer, { backgroundColor: '#FF9800' }]}>
                <MaterialIcons name="people" size={22} color="#fff" />
              </View>
              <Text style={styles.kpiLabel}>Inquilinos ativos</Text>
              <Text style={styles.kpiValue}>{stats.activeTenants}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bloco 2 – Próximos vencimentos */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Próximos vencimentos</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Finanças')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.sectionLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {upcomingRents.length === 0 ? (
            <Text style={styles.emptyText}>
              Nenhum vencimento de aluguel em breve. Adicione inquilinos e contratos para ver aqui.
            </Text>
          ) : (
            upcomingRents.map((item) => (
              <View key={item.id} style={styles.upcomingItem}>
                <View style={styles.upcomingInfo}>
                  <Text style={styles.upcomingName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.upcomingMeta} numberOfLines={1}>
                    {item.propertyAddress || 'Sem imóvel vinculado'} • {formatDate(item.date)}
                  </Text>
                </View>
                <View style={styles.upcomingBadge}>
                  <Text style={styles.upcomingBadgeText}>
                    {item.days === 0 ? 'Hoje' : `${item.days}d`}
                  </Text>
                </View>
                <Text style={styles.upcomingAmount}>
                  {formatCurrency(item.amount || 0)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Bloco 3 – Atalhos rápidos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações rápidas</Text>
          <View style={styles.shortcutsGrid}>
            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={() => navigation.navigate('AddTransaction')}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: '#4CAF50' }]}>
                <MaterialIcons name="playlist-add" size={22} color="#fff" />
              </View>
              <Text style={styles.shortcutLabel}>Registrar recebimento</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={() => navigation.navigate('AddProperty')}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: '#4a86e8' }]}>
                <MaterialIcons name="home" size={22} color="#fff" />
              </View>
              <Text style={styles.shortcutLabel}>Adicionar imóvel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={() => navigation.navigate('AddTenant')}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: '#FF9800' }]}>
                <MaterialIcons name="person-add" size={22} color="#fff" />
              </View>
              <Text style={styles.shortcutLabel}>Adicionar inquilino</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={() => navigation.navigate('Finanças')}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: '#9C27B0' }]}>
                <MaterialIcons name="insert-chart" size={22} color="#fff" />
              </View>
              <Text style={styles.shortcutLabel}>Ver finanças</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bloco 4 – Imóveis e ocupação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Imóveis e ocupação</Text>
          <View style={styles.occupancyCard}>
            <Text style={styles.occupancyTitle}>Imóveis ocupados</Text>
            <Text style={styles.occupancyRate}>
              {Number.isFinite(stats.occupancyRate)
                ? `${stats.occupancyRate.toFixed(1)}%`
                : '0%'}
            </Text>
            <View style={styles.occupancyBar}>
              <View
                style={[
                  styles.occupancyFill,
                  { width: `${Math.min(Math.max(stats.occupancyRate, 0), 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.occupancySub}>
              {stats.propertyCount > 0
                ? `De ${stats.propertyCount} imóveis cadastrados`
                : 'Cadastre seus imóveis para acompanhar a ocupação.'}
            </Text>
          </View>
        </View>

        {/* Bloco 5 – Atividade recente */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Atividade recente</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Finanças')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.sectionLink}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>
              Nenhuma movimentação recente. Registre um recebimento ou despesa em Finanças.
            </Text>
          ) : (
            recentTransactions.slice(0, 5).map(transaction => (
              <View key={transaction.id} style={styles.transactionCard}>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionDesc} numberOfLines={1}>
                    {transaction.description || 'Lançamento financeiro'}
                  </Text>
                  <Text style={styles.transactionProperty} numberOfLines={1}>
                    {transaction.properties?.address || 'Sem imóvel vinculado'} •{' '}
                    {formatDate(transaction.date)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    transaction.type === 'income' ? styles.income : styles.expense,
                  ]}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    padding: 15,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  scrollContainer: {
    flex: 1,
    padding: 15,
  },
  sectionPlain: {
    marginBottom: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLink: {
    fontSize: 13,
    color: '#4a86e8',
    fontWeight: '500',
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kpiCard: {
    flex: 1,
    marginRight: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  kpiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 13,
    color: '#666',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
    color: '#111827',
  },
  kpiSubLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shortcutButton: {
    width: '48%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
  },
  shortcutIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shortcutLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  occupancyCard: {
    marginTop: 4,
  },
  occupancyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  occupancyRate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4a86e8',
    marginBottom: 10,
  },
  occupancyBar: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  occupancyFill: {
    height: '100%',
    backgroundColor: '#4a86e8',
    borderRadius: 5,
  },
  occupancySub: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  upcomingInfo: {
    flex: 1,
    marginRight: 10,
  },
  upcomingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  upcomingMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  upcomingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fff3cd',
  },
  upcomingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  upcomingAmount: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    marginBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  transactionDetails: {
    flex: 1,
    marginRight: 10,
  },
  transactionDesc: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  transactionProperty: {
    color: '#666',
    fontSize: 14,
  },
  transactionAmount: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  income: {
    color: '#4CAF50',
  },
  expense: {
    color: '#F44336',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: '#c62828',
    fontSize: 13,
    marginBottom: 6,
  },
  errorBannerButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#c62828',
  },
  errorBannerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingSkeletonContainer: {
    width: '90%',
  },
  loadingSkeletonHeader: {
    height: 24,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    marginBottom: 16,
  },
  loadingSkeletonCard: {
    height: 70,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    marginBottom: 10,
  },
});

export default DashboardScreen;