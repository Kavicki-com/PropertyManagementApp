import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import ScreenHeader from '../components/ScreenHeader';
import { fetchActiveContractsByTenants } from '../lib/contractsService';
import { colors, radii, typography } from '../theme';
import SearchBar from '../components/SearchBar';

// Updated TenantItem to display mais informações
const TenantItem = ({ item, onPress, onPressPhone }) => (
  <TouchableOpacity style={styles.tenantCard} onPress={() => onPress(item)}>
    <Image
      source={require('../assets/avatar-placeholder.png')}
      style={styles.avatar}
    />
    <View style={styles.tenantInfo}>
      <Text style={styles.tenantName}>{item.full_name}</Text>

      <View style={styles.tenantMetaRow}>
        <View style={styles.tenantMeta}>
          <MaterialIcons name="phone" size={16} color="#666" />
          <Text style={styles.tenantMetaText}>{item.phone || 'N/A'}</Text>
        </View>
      </View>

      {item.properties?.address && (
        <View style={styles.tenantMetaRow}>
          <MaterialIcons name="home" size={16} color="#666" />
          <Text
            style={styles.tenantMetaText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.properties.address}
          </Text>
        </View>
      )}

      {typeof item.overdue_invoices === 'number' && (
        <View style={styles.invoiceBadge}>
          <Text style={styles.invoiceBadgeText}>
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

const TenantsScreen = ({ navigation }) => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'due_date'
  const isFocused = useIsFocused();

  const fetchTenants = async (options = {}) => {
    const { search = '' } = options;
    const trimmedSearch = search.trim();

    try {
      setError(null);
      if (!refreshing) setLoading(true);

      // 1) Buscar inquilinos com propriedade relacionada
      let tenantQuery = supabase
        .from('tenants')
        .select(`*, properties ( address, rent )`);

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

      // 2) Descobrir propriedades ligadas a esses inquilinos
      const propertyIds = Array.from(
        new Set(
          (tenantsData || [])
            .map((t) => t.property_id)
            .filter(Boolean),
        ),
      );

      let financesByProperty = {};

      // 2b) Buscar contratos ativos por inquilino para obter dia de vencimento e período
      const tenantIds = (tenantsData || []).map((t) => t.id).filter(Boolean);
      const { data: contractsByTenant } = await fetchActiveContractsByTenants(tenantIds);

      if (propertyIds.length > 0) {
        // 3) Buscar transações financeiras dessas propriedades
        const { data: financesData, error: financesError } = await supabase
          .from('finances')
          .select('id, type, date, property_id')
          .in('property_id', propertyIds);

        if (financesError) {
          console.error('Error fetching finances for tenants:', financesError);
        } else {
          financesByProperty = (financesData || []).reduce((acc, f) => {
            if (!acc[f.property_id]) acc[f.property_id] = [];
            acc[f.property_id].push(f);
            return acc;
          }, {});
        }
      }

      // 4) Calcular indicador de faturas (esperadas x registradas) por inquilino
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalizar para início do dia

      // Função auxiliar para calcular a data de vencimento de uma mensalidade
      const calculateDueDate = (startDate, dueDay, monthIndex) => {
        const dueDate = new Date(startDate);
        dueDate.setMonth(startDate.getMonth() + (monthIndex - 1));
        
        // Ajustar para o dia de vencimento correto
        const lastDayOfMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
        const dayToSet = Math.min(dueDay, lastDayOfMonth);
        dueDate.setDate(dayToSet);
        dueDate.setHours(0, 0, 0, 0);
        
        return dueDate;
      };

      const tenantsWithInvoices = (tenantsData || []).map((tenant) => {
        const contract = contractsByTenant?.[tenant.id] || null;
        let overdue_invoices = 0;
        let due_date_display = tenant.due_date || null;

        if (contract && contract.start_date && contract.lease_term && contract.due_day && tenant.property_id) {
          const start = new Date(contract.start_date);
          start.setHours(0, 0, 0, 0);
          
          const contractTotal = contract.lease_term || 0;
          const dueDay = contract.due_day;

          if (contractTotal > 0 && dueDay) {
            const propertyFinances = (financesByProperty[tenant.property_id] || [])
              .filter((f) => f.type === 'income')
              .map((f) => {
                const paymentDate = new Date(f.date);
                paymentDate.setHours(0, 0, 0, 0);
                return { ...f, paymentDate };
              });

            // Rastrear quais pagamentos já foram associados a uma mensalidade
            const usedPayments = new Set();

            // Função para verificar se há pagamento para uma mensalidade
            const hasPaymentForMonth = (dueDate) => {
              if (propertyFinances.length === 0) return false;
              
              // Janela de pagamento: de 10 dias antes até 5 dias depois do vencimento
              const paymentWindowStart = new Date(dueDate);
              paymentWindowStart.setDate(paymentWindowStart.getDate() - 10);
              
              const paymentWindowEnd = new Date(dueDate);
              paymentWindowEnd.setDate(paymentWindowEnd.getDate() + 5);
              
              // Encontrar o primeiro pagamento não usado dentro da janela
              const matchingPayment = propertyFinances.find((payment) => {
                if (usedPayments.has(payment.id)) return false;
                return payment.paymentDate >= paymentWindowStart && payment.paymentDate <= paymentWindowEnd;
              });
              
              if (matchingPayment) {
                usedPayments.add(matchingPayment.id);
                return true;
              }
              
              return false;
            };

            // Processar cada mensalidade do contrato
            for (let monthIndex = 1; monthIndex <= contractTotal; monthIndex++) {
              const dueDate = calculateDueDate(start, dueDay, monthIndex);
              
              // Verificar se a mensalidade já venceu
              if (dueDate < today) {
                // Mensalidade vencida - verificar se foi paga
                if (!hasPaymentForMonth(dueDate)) {
                  overdue_invoices++;
                }
              }
            }
          }

          // Atualiza o dia de vencimento exibido a partir do contrato ativo
          if (contract.due_day != null) {
            due_date_display = contract.due_day;
          }
        }

        return {
          ...tenant,
          overdue_invoices,
          due_date: due_date_display,
        };
      });

      setTenants(tenantsWithInvoices);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchTenants({ search: searchQuery });
    }
  }, [isFocused]);

  useEffect(() => {
    // Evita recarregar logo no primeiro render com busca vazia
    // e só executa quando a tela está focada e há texto de busca.
    if (!isFocused) return;

    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const timeout = setTimeout(() => {
      fetchTenants({ search: trimmed });
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchQuery, isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTenants({ search: searchQuery });
  };

  const handleTenantPress = (tenant) => {
    navigation.navigate('TenantDetails', { tenant });
  };

  const filteredTenants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let result = tenants;
    if (query) {
      result = result.filter((tenant) => {
        const name = (tenant.full_name || '').toLowerCase();
        const phone = (tenant.phone || '').toLowerCase();
        return name.includes(query) || phone.includes(query);
      });
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'due_date') {
        const aDue = a.due_date || 0;
        const bDue = b.due_date || 0;
        return aDue - bDue;
      }

      const nameA = (a.full_name || '').toLowerCase();
      const nameB = (b.full_name || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });

    return result;
  }, [tenants, searchQuery, sortBy]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <ScreenHeader title="Inquilinos" />

        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar por nome ou telefone"
          />
        </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Carregando inquilinos...</Text>
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
                  onPress={() => navigation.navigate('AddTenant')}
                >
                  <Text style={styles.emptyButtonText}>Adicionar inquilino</Text>
                </TouchableOpacity>
              </View>
            }
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddTenant')}
        >
          <MaterialIcons name="add" size={30} color="white" />
        </TouchableOpacity>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: 15,
    paddingBottom: 80,
  },
  tenantCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
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
    ...typography.bodyStrong,
    marginBottom: 5,
    color: '#333',
  },
  tenantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenantMetaText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 5,
  },
  dueDateContainer: {
    alignItems: 'center',
    paddingLeft: 10,
  },
  dueDateLabel: {
    fontSize: 12,
    color: '#888',
  },
  dueDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  searchContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 5,
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: colors.expense,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
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
    ...typography.bodyStrong,
    marginBottom: 4,
  },
  emptySubtitle: {
    ...typography.body,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
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
    borderRadius: radii.pill,
    backgroundColor: '#eef7ff',
  },
  invoiceBadgeText: {
    fontSize: 11,
    color: '#1e88e5',
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
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

