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
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { fetchActiveContractsByTenants } from '../lib/contractsService';
import { useIsFocused } from '@react-navigation/native';
import { startOfMonth, endOfMonth, format, differenceInDays, setDate, addMonths } from 'date-fns';
import { colors, radii, typography } from '../theme';
import { getUserSubscription, getActivePropertiesCount, getSubscriptionLimits, checkSubscriptionStatus, getBlockedProperties } from '../lib/subscriptionService';

// Componente de gráfico de donut com cores por tipo de imóvel
const DonutChart = ({ occupancyByType, size = 160, strokeWidth = 30 }) => {
  const totalResidencial = occupancyByType.Residencial?.total || 0;
  const occupiedResidencial = occupancyByType.Residencial?.occupied || 0;
  const totalComercial = occupancyByType.Comercial?.total || 0;
  const occupiedComercial = occupancyByType.Comercial?.occupied || 0;
  
  const totalProperties = totalResidencial + totalComercial;
  const totalOccupied = occupiedResidencial + occupiedComercial;
  const occupancyRate = totalProperties > 0 ? (totalOccupied / totalProperties) * 100 : 0;

  // Calcular porcentagens de ocupação por tipo
  const residencialRate = totalResidencial > 0 ? (occupiedResidencial / totalResidencial) * 100 : 0;
  const comercialRate = totalComercial > 0 ? (occupiedComercial / totalComercial) * 100 : 0;

  // Calcular proporção de cada tipo no total de imóveis
  const residencialProportion = totalProperties > 0 ? (totalResidencial / totalProperties) * 100 : 0;
  const comercialProportion = totalProperties > 0 ? (totalComercial / totalProperties) * 100 : 0;

  // Calcular ângulos para cada segmento
  const residencialAngle = (residencialProportion / 100) * 360;
  const comercialAngle = (comercialProportion / 100) * 360;

  // Calcular ocupação dentro de cada segmento
  const residencialOccupiedAngle = (residencialProportion / 100) * (residencialRate / 100) * 360;
  const comercialOccupiedAngle = (comercialProportion / 100) * (comercialRate / 100) * 360;

  if (totalProperties === 0) {
    return (
      <View style={[styles.donutContainer, { width: size, height: size }]}>
        <View style={styles.donutEmpty}>
          <Text style={styles.donutEmptyText}>Sem dados</Text>
        </View>
      </View>
    );
  }

  const radius = size / 2;
  const innerSize = size - (strokeWidth * 2);

  return (
    <View style={[styles.donutContainer, { width: size, height: size }]}>
      {/* Círculo de fundo (disponível) - cinza */}
      <View
        style={[
          styles.donutCircle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: '#e5e7eb',
            position: 'absolute',
          },
        ]}
      />
      {/* Círculo interno branco para criar o efeito donut */}
      <View
        style={[
          styles.donutCircle,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: colors.surface,
            position: 'absolute',
            top: strokeWidth,
            left: strokeWidth,
          },
        ]}
      />
      
      {/* Segmento Residencial ocupado - azul */}
      {residencialOccupiedAngle > 0 && (
        <View
          style={[
            styles.donutCircle,
            {
              width: size,
              height: size,
              borderRadius: radius,
              borderWidth: strokeWidth,
              borderColor: colors.primary,
              borderRightColor: residencialOccupiedAngle < 90 ? 'transparent' : colors.primary,
              borderBottomColor: residencialOccupiedAngle < 180 ? 'transparent' : colors.primary,
              borderLeftColor: residencialOccupiedAngle < 270 ? 'transparent' : colors.primary,
              position: 'absolute',
              transform: [{ rotate: '-90deg' }],
            },
          ]}
        />
      )}
      
      {/* Segmento Comercial ocupado - cinza (começa após o residencial) */}
      {comercialOccupiedAngle > 0 && (
        <View
          style={[
            styles.donutCircle,
            {
              width: size,
              height: size,
              borderRadius: radius,
              borderWidth: strokeWidth,
              borderColor: '#9ca3af',
              borderRightColor: (residencialAngle + comercialOccupiedAngle) < (residencialAngle + 90) ? 'transparent' : '#9ca3af',
              borderBottomColor: (residencialAngle + comercialOccupiedAngle) < (residencialAngle + 180) ? 'transparent' : '#9ca3af',
              borderLeftColor: (residencialAngle + comercialOccupiedAngle) < (residencialAngle + 270) ? 'transparent' : '#9ca3af',
              position: 'absolute',
              transform: [{ rotate: `${-90 + residencialAngle}deg` }],
            },
          ]}
        />
      )}
      
      {/* Centro do donut */}
      <View style={styles.donutCenter}>
        <Text style={styles.donutCenterText}>
          {occupancyRate.toFixed(0)}%
        </Text>
        <Text style={styles.donutCenterLabel}>Ocupado</Text>
      </View>
    </View>
  );
};

const DashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState({
    rentCollected: 0,
    activeTenants: 0,
    propertyCount: 0,
    occupancyRate: 0,
  });
  const [occupancyByType, setOccupancyByType] = useState({
    Residencial: { total: 0, occupied: 0 },
    Comercial: { total: 0, occupied: 0 },
  });
  const [upcomingRents, setUpcomingRents] = useState([]);
  const [allUpcomingRents, setAllUpcomingRents] = useState([]);
  const [nextMonthRents, setNextMonthRents] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showAllRentsModal, setShowAllRentsModal] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [blockedPropertiesCount, setBlockedPropertiesCount] = useState(0);
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
        tenant: tenant, // Armazenar o objeto tenant completo para navegação
      });
    });

    // Lista completa de todos os vencimentos (ordenada por data)
    const allSorted = items
      .filter(item => item.days >= 0)
      .sort((a, b) => a.days - b.days);
    setAllUpcomingRents(allSorted);

    // Lista resumida para o dashboard (próximos 7 dias, máximo 5 itens)
    const sorted = items
      .filter(item => item.days >= 0 && item.days <= 7)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5);

    setUpcomingRents(sorted);
  };

  const computeNextMonthRents = (tenants, contractsMap) => {
    const today = new Date();
    const nextMonth = addMonths(today, 1);
    const nextMonthStart = startOfMonth(nextMonth);
    const nextMonthEnd = endOfMonth(nextMonth);
    const items = [];

    tenants.forEach(tenant => {
      const contract = contractsMap[tenant.id];
      if (!contract || !contract.due_day || !contract.rent_amount) return;

      // Calcular data de vencimento no próximo mês
      let dueDateNextMonth = setDate(nextMonth, contract.due_day);

      // Verificar se a data está dentro do próximo mês
      if (dueDateNextMonth >= nextMonthStart && dueDateNextMonth <= nextMonthEnd) {
        const daysDiff = differenceInDays(dueDateNextMonth, today);
        items.push({
          id: tenant.id || `${tenant.full_name}-${contract.due_day}-${tenant.property_id || 'no-property'}`,
          name: tenant.full_name,
          days: daysDiff,
          date: dueDateNextMonth,
          propertyAddress: tenant.properties?.address,
          amount: contract.rent_amount,
          tenant: tenant,
        });
      }
    });

    // Ordenar por data
    const sorted = items.sort((a, b) => a.days - b.days);
    setNextMonthRents(sorted);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    const today = new Date();
    const startDate = format(startOfMonth(today), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(today), 'yyyy-MM-dd');

    // --- Promessas de busca de dados ---
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

    const propertiesPromise = supabase
      .from('properties')
      .select('id, type')
      .is('archived_at', null);

    // --- Executar todas as promessas simultaneamente ---
    const [
      { data: financeData, error: financeError },
      { data: tenantsData, error: tenantsError },
      { data: recentTransactionsData, error: recentTransactionsError },
      { count: propertyCount, error: propertyError },
      { data: propertiesData, error: propertiesError },
    ] = await Promise.all([
      financePromise,
      tenantsPromise,
      recentTransactionsPromise,
      propertyCountPromise,
      propertiesPromise,
    ]);


    if (financeError || tenantsError || propertyError || recentTransactionsError || propertiesError) {
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

      // Calcular ocupação por tipo de imóvel
      const occupiedPropertyIds = new Set(
        (tenantsData || []).filter(t => t.property_id).map(t => t.property_id)
      );
      
      const occupancyByTypeData = {
        Residencial: { total: 0, occupied: 0 },
        Comercial: { total: 0, occupied: 0 },
      };

      (propertiesData || []).forEach(property => {
        const type = property.type || 'Residencial';
        if (occupancyByTypeData[type]) {
          occupancyByTypeData[type].total++;
          if (occupiedPropertyIds.has(property.id)) {
            occupancyByTypeData[type].occupied++;
          }
        }
      });

      setOccupancyByType(occupancyByTypeData);

      setStats({
        rentCollected: totalIncome,
        activeTenants: activeTenants,
        propertyCount: propertyCount || 0,
        occupancyRate: occupancyRate,
      });

      if (tenantsData) {
        computeUpcomingRents(tenantsData, contractsMap || {});
        computeNextMonthRents(tenantsData, contractsMap || {});
      } else {
        setUpcomingRents([]);
        setNextMonthRents([]);
      }

      if (recentTransactionsData) {
        setRecentTransactions(recentTransactionsData);
      } else {
        setRecentTransactions([]);
      }

      // Carregar dados de assinatura
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [subscriptionData, status, blockedProperties] = await Promise.all([
          getUserSubscription(user.id),
          checkSubscriptionStatus(user.id),
          getBlockedProperties(user.id),
        ]);
        setSubscription(subscriptionData);
        setSubscriptionStatus(status);
        setBlockedPropertiesCount(blockedProperties.length);
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
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
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
          
          {/* Card de Assinatura */}
          {subscription && (
            <TouchableOpacity
              style={styles.subscriptionCard}
              onPress={() => navigation.navigate('Subscription')}
            >
              <View style={styles.subscriptionHeader}>
                <MaterialIcons name="card-membership" size={20} color={colors.primary} />
                <Text style={styles.subscriptionTitle}>Assinatura</Text>
                {subscriptionStatus?.active && (
                  <View style={[styles.subscriptionBadge, { backgroundColor: `${colors.primary}20` }]}>
                    <Text style={[styles.subscriptionBadgeText, { color: colors.primary }]}>Ativo</Text>
                  </View>
                )}
                {!subscriptionStatus?.active && subscriptionStatus?.reason && (
                  <View style={[styles.subscriptionBadge, { backgroundColor: `${colors.expense}20` }]}>
                    <Text style={[styles.subscriptionBadgeText, { color: colors.expense }]}>
                      {subscriptionStatus.reason === 'Assinatura expirada' ? 'Expirado' : 'Inativo'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.subscriptionPlan}>
                {subscription.subscription_plan === 'free' ? 'Gratuito' : 
                 subscription.subscription_plan === 'basic' ? 'Básico' : 'Premium'}
              </Text>
              {subscription.subscription_expires_at && subscriptionStatus?.active && (
                <Text style={styles.subscriptionExpires}>
                  Expira em {new Date(subscription.subscription_expires_at).toLocaleDateString('pt-BR')}
                </Text>
              )}
              {blockedPropertiesCount > 0 && (
                <Text style={styles.subscriptionWarning}>
                  {blockedPropertiesCount} {blockedPropertiesCount === 1 ? 'imóvel bloqueado' : 'imóveis bloqueados'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.kpiRow}>
            <TouchableOpacity
              style={styles.kpiCard}
              onPress={() => navigation.navigate('Finanças')}
            >
              <MaterialIcons name="attach-money" size={22} color={colors.primary} style={styles.kpiIcon} />
              <Text style={styles.kpiLabel}>Recebido no mês</Text>
              <Text style={styles.kpiValue}>{formatCurrency(stats.rentCollected)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.kpiCard}
              onPress={() => navigation.navigate('Imóveis')}
            >
              <MaterialIcons name="home" size={22} color={colors.primary} style={styles.kpiIcon} />
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
              <MaterialIcons name="people" size={22} color={colors.primary} style={styles.kpiIcon} />
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
              onPress={() => setShowAllRentsModal(true)}
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
              <TouchableOpacity
                key={item.id}
                style={styles.upcomingItem}
                onPress={() => navigation.navigate('TenantDetails', { tenant: item.tenant })}
              >
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
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Bloco 3 – Atalhos rápidos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações rápidas</Text>
          <View style={styles.shortcutsGrid}>
            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={() => navigation.navigate('SelectPropertyForContract')}
            >
              <MaterialIcons name="description" size={22} color={colors.primary} style={styles.shortcutIcon} />
              <Text style={styles.shortcutLabel}>Novo Contrato</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={() => navigation.navigate('AddProperty')}
            >
              <MaterialIcons name="home" size={22} color={colors.primary} style={styles.shortcutIcon} />
              <Text style={styles.shortcutLabel}>Adicionar imóvel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={() => navigation.navigate('AddTenant')}
            >
              <MaterialIcons name="person-add" size={22} color={colors.primary} style={styles.shortcutIcon} />
              <Text style={styles.shortcutLabel}>Adicionar inquilino</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={() => navigation.navigate('Finanças')}
            >
              <MaterialIcons name="insert-chart" size={22} color={colors.primary} style={styles.shortcutIcon} />
              <Text style={styles.shortcutLabel}>Ver finanças</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bloco 2.5 – Previsão de recebimentos do próximo mês */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Previsão de recebimentos</Text>
            <Text style={styles.sectionTitleDate}>{format(addMonths(new Date(), 1), 'MMMM yyyy')}</Text>
          </View>
          {nextMonthRents.length === 0 ? (
            <Text style={styles.emptyText}>
              Nenhum recebimento previsto para o próximo mês.
            </Text>
          ) : (
            <>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total previsto:</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(nextMonthRents.reduce((sum, item) => sum + (item.amount || 0), 0))}
                </Text>
              </View>
              {nextMonthRents.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.upcomingItem}
                  onPress={() => navigation.navigate('TenantDetails', { tenant: item.tenant })}
                >
                  <View style={styles.upcomingInfo}>
                    <Text style={styles.upcomingName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.upcomingMeta} numberOfLines={1}>
                      {item.propertyAddress || 'Sem imóvel vinculado'} • Dia {format(item.date, 'dd')}
                    </Text>
                  </View>
                  <Text style={styles.upcomingAmount}>
                    {formatCurrency(item.amount || 0)}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        {/* Bloco 4 – Imóveis e ocupação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Imóveis e ocupação</Text>
          <View style={styles.occupancyCard}>
            <View style={styles.occupancyChartContainer}>
              <DonutChart occupancyByType={occupancyByType} />
              <View style={styles.occupancyLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: colors.primary }]} />
                  <View style={styles.legendText}>
                    <Text style={styles.legendLabel}>Residencial</Text>
                    <Text style={styles.legendValue}>
                      {occupancyByType.Residencial?.occupied || 0} / {occupancyByType.Residencial?.total || 0}
                    </Text>
                    <Text style={styles.legendPercentage}>
                      {occupancyByType.Residencial?.total > 0
                        ? `${((occupancyByType.Residencial.occupied / occupancyByType.Residencial.total) * 100).toFixed(0)}%`
                        : '0%'}
                    </Text>
                  </View>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#9ca3af' }]} />
                  <View style={styles.legendText}>
                    <Text style={styles.legendLabel}>Comercial</Text>
                    <Text style={styles.legendValue}>
                      {occupancyByType.Comercial?.occupied || 0} / {occupancyByType.Comercial?.total || 0}
                    </Text>
                    <Text style={styles.legendPercentage}>
                      {occupancyByType.Comercial?.total > 0
                        ? `${((occupancyByType.Comercial.occupied / occupancyByType.Comercial.total) * 100).toFixed(0)}%`
                        : '0%'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <Text style={styles.occupancySub}>
              {stats.propertyCount > 0
                ? `Total: ${stats.propertyCount} imóveis cadastrados`
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

      {/* Bottom Sheet - Lista completa de vencimentos */}
      <Modal
        visible={showAllRentsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAllRentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAllRentsModal(false)}
          />
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Todos os vencimentos</Text>
              <TouchableOpacity
                onPress={() => setShowAllRentsModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {allUpcomingRents.length === 0 ? (
              <View style={styles.bottomSheetEmpty}>
                <Text style={styles.emptyText}>
                  Nenhum vencimento disponível. Adicione inquilinos e contratos para ver aqui.
                </Text>
              </View>
            ) : (
              <FlatList
                data={allUpcomingRents}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.bottomSheetItem}
                    onPress={() => {
                      setShowAllRentsModal(false);
                      navigation.navigate('TenantDetails', { tenant: item.tenant });
                    }}
                  >
                    <View style={styles.bottomSheetItemContent}>
                      <View style={styles.bottomSheetItemInfo}>
                        <Text style={styles.bottomSheetItemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.bottomSheetItemProperty} numberOfLines={1}>
                          {item.propertyAddress || 'Sem imóvel vinculado'}
                        </Text>
                        <Text style={styles.bottomSheetItemDate}>
                          Vencimento: {formatDate(item.date)}
                        </Text>
                      </View>
                      <View style={styles.bottomSheetItemRight}>
                        <View style={styles.bottomSheetBadge}>
                          <Text style={styles.bottomSheetBadgeText}>
                            {item.days === 0 ? 'Hoje' : `${item.days}d`}
                          </Text>
                        </View>
                        <Text style={styles.bottomSheetItemAmount}>
                          {formatCurrency(item.amount || 0)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.bottomSheetList}
                showsVerticalScrollIndicator={true}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    padding: 15,
    paddingTop: 50,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  header: {
    ...typography.screenTitle,
  },
  scrollContainer: {
    flex: 1,
    padding: 15,
  },
  sectionPlain: {
    marginBottom: 16,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 15,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleDate: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
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
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 12,
  },
  kpiIcon: {
    marginBottom: 6,
  },
  kpiLabel: {
    ...typography.caption,
  },
  kpiValue: {
    ...typography.bodyStrong,
    marginTop: 4,
  },
  kpiSubLabel: {
    ...typography.caption,
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
    borderRadius: radii.md,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  shortcutIcon: {
    marginBottom: 6,
  },
  shortcutLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  occupancyCard: {
    marginTop: 4,
    alignItems: 'center',
  },
  occupancyChartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  donutContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  donutChart: {
    position: 'relative',
  },
  donutCircle: {
    position: 'absolute',
  },
  donutSegment: {
    position: 'absolute',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  donutCenterLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  donutEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  donutEmptyText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  occupancyLegend: {
    flex: 1,
    minWidth: 150,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  legendText: {
    flex: 1,
  },
  legendLabel: {
    ...typography.bodyStrong,
    fontSize: 14,
    marginBottom: 2,
  },
  legendValue: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  legendPercentage: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.primary,
  },
  occupancySub: {
    ...typography.caption,
    marginTop: 8,
    textAlign: 'center',
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
    color: colors.textPrimary,
  },
  upcomingMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  upcomingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
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
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  summaryLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
    color: colors.textPrimary,
  },
  summaryValue: {
    ...typography.bodyStrong,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '700',
  },
  transactionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
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
    ...typography.bodyStrong,
  },
  transactionProperty: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  transactionAmount: {
    ...typography.bodyStrong,
  },
  income: {
    color: colors.income,
  },
  expense: {
    color: colors.expense,
  },
  emptyText: {
    ...typography.caption,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: colors.danger,
    fontSize: 13,
    marginBottom: 6,
  },
  errorBannerButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.danger,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.85,
    paddingBottom: 20,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  bottomSheetTitle: {
    ...typography.sectionTitle,
    fontSize: 18,
  },
  bottomSheetList: {
    padding: 15,
  },
  bottomSheetItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  bottomSheetItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomSheetItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  bottomSheetItemName: {
    ...typography.bodyStrong,
    fontSize: 16,
    marginBottom: 4,
  },
  bottomSheetItemProperty: {
    ...typography.caption,
    fontSize: 14,
    marginBottom: 4,
    color: colors.textSecondary,
  },
  bottomSheetItemDate: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  bottomSheetItemRight: {
    alignItems: 'flex-end',
  },
  bottomSheetBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: '#fff3cd',
    marginBottom: 8,
  },
  bottomSheetBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  bottomSheetItemAmount: {
    ...typography.bodyStrong,
    fontSize: 16,
    color: colors.textPrimary,
  },
  bottomSheetEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  subscriptionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionTitle: {
    ...typography.bodyStrong,
    marginLeft: 8,
    flex: 1,
  },
  subscriptionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  subscriptionBadgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  subscriptionPlan: {
    ...typography.bodyStrong,
    fontSize: 18,
    marginBottom: 4,
  },
  subscriptionExpires: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  subscriptionWarning: {
    ...typography.caption,
    color: colors.expense,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default DashboardScreen;