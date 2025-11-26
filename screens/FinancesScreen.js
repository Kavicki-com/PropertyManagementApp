// screens/FinancesScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { fetchAllFinances, calculateOverview } from '../lib/financesService';
import { supabase } from '../lib/supabase';
import RangeDatePicker from '../components/RangeDatePicker';

const FinancesScreen = ({ navigation }) => {
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

  const getFilteredTransactions = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return transactions;

    return transactions.filter((t) => {
      const desc = (t.description || '').toLowerCase();
      const address = (t.properties?.address || '').toLowerCase();
      return desc.includes(query) || address.includes(query);
    });
  };

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

            // Remove da lista atual sem precisar recarregar tudo
            setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));
            setOverview(calculateOverview(getFilteredTransactions().filter((t) => t.id !== transaction.id)));
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
        <View style={styles.headerContainer}>
            <Text style={styles.header}>Finanças</Text>
        </View>
        <ScrollView style={styles.scrollContainer}>
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
                <MaterialIcons name="date-range" size={18} color="#666" />
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
                    <MaterialIcons name="close" size={16} color="#666" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.searchAndDateContainer}>
              <View style={styles.searchWrapper}>
                <MaterialIcons name="search" size={18} color="#888" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por descrição ou imóvel"
                  placeholderTextColor="#888"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
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

            {!error && getFilteredTransactions().length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Nenhum lançamento neste período</Text>
                <Text style={styles.emptySubtitle}>
                  Ajuste os filtros ou adicione o primeiro lançamento financeiro.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => navigation.navigate('AddTransaction')}
                >
                  <Text style={styles.emptyButtonText}>Adicionar lançamento</Text>
                </TouchableOpacity>
              </View>
            )}

            {!error && getFilteredTransactions().length > 0 && getFilteredTransactions().map((transaction) => (
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
                        <MaterialIcons name="home" size={16} color="#4a86e8" />
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
                        <MaterialIcons name="person" size={16} color="#4a86e8" />
                        <Text style={styles.actionChipText}>Ver inquilino</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionChip, styles.actionChipDanger]}
                      onPress={() => handleDeleteTransaction(transaction)}
                    >
                      <MaterialIcons name="delete" size={16} color="#F44336" />
                      <Text style={[styles.actionChipText, { color: '#F44336' }]}>Excluir</Text>
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
            onPress={() => navigation.navigate('AddTransaction')}
        >
            <MaterialIcons name="add" size={30} color="white" />
        </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
      flex: 1,
      padding: 15,
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
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
  overviewCardIncome: {
    // Mantém card branco; cor fica apenas no texto de valor
  },
  overviewCardExpense: {
    // Mantém card branco; cor fica apenas no texto de valor
  },
  overviewCardProfit: {
    marginRight: 0,
  },
  overviewLabel: {
    fontSize: 16,
    color: '#666',
  },
  incomeAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F44336',
  },
  profitAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  filtersRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#4a86e8',
    borderColor: '#4a86e8',
  },
  filterChipText: {
    fontSize: 13,
    color: '#555',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  searchAndDateContainer: {
    marginTop: 12,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fafafa',
  },
  searchInput: {
    flex: 1,
    paddingLeft: 6,
    paddingVertical: 4,
    fontSize: 14,
  },
  dateFilterRow: {
    marginTop: 12,
  },
  dateFilterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  periodField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  periodFieldText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 13,
    color: '#333',
  },
  periodClearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderColor: '#4a86e8',
    backgroundColor: '#e3f2fd',
    marginRight: 8,
    marginBottom: 4,
  },
  actionChipDanger: {
    borderColor: '#F44336',
    backgroundColor: '#ffebee',
  },
  actionChipText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#1e88e5',
    fontWeight: '500',
  },
  transactionDesc: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  transactionMeta: {
    color: '#666',
    fontSize: 13,
    marginTop: 4,
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
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#4a86e8',
    width: 60,
    height: 60,
    borderRadius: 30,
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
    backgroundColor: '#ffebee',
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    marginBottom: 8,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#c62828',
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4a86e8',
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default FinancesScreen;