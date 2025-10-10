// screens/DashboardScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { startOfMonth, endOfMonth, format, differenceInDays, setDate } from 'date-fns';

const DashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState({
    rentCollected: 0,
    activeTenants: 0,
    propertyCount: 0,
    occupancyRate: 0,
  });
  const [nextRentDue, setNextRentDue] = useState({ days: null, name: null });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const findNextRentDue = (tenants) => {
    const today = new Date();
    let closest = null;

    tenants.forEach(tenant => {
      if (!tenant.due_date) return;

      let dueDateThisMonth = setDate(today, tenant.due_date);

      if (differenceInDays(dueDateThisMonth, today) < 0) {
        dueDateThisMonth.setMonth(dueDateThisMonth.getMonth() + 1);
      }

      if (!closest || differenceInDays(dueDateThisMonth, today) < differenceInDays(closest.date, today)) {
        closest = { date: dueDateThisMonth, name: tenant.full_name };
      }
    });

    if (closest) {
      setNextRentDue({
        days: differenceInDays(closest.date, today),
        name: closest.name,
      });
    } else {
      setNextRentDue({ days: null, name: null });
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);

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

    const tenantsPromise = supabase.from('tenants').select('full_name, due_date, property_id');
    
    const recentTransactionsPromise = supabase
        .from('finances')
        .select('*, properties (address)')
        .order('date', { ascending: false })
        .limit(5);

    const propertyCountPromise = supabase
      .from('properties')
      .select('*', { count: 'exact', head: true });

    // --- Execute all promises concurrently ---
    const [
        { data: financeData, error: financeError },
        { data: tenantsData, error: tenantsError },
        { data: recentTransactionsData, error: recentTransactionsError },
        { count: propertyCount, error: propertyError }
    ] = await Promise.all([financePromise, tenantsPromise, recentTransactionsPromise, propertyCountPromise]);


    if (financeError || tenantsError || propertyError || recentTransactionsError) {
      console.error('Error fetching dashboard data:', financeError || tenantsError || propertyError || recentTransactionsError);
    } else {
      const totalIncome = financeData.reduce((sum, transaction) => sum + transaction.amount, 0);
      const activeTenants = tenantsData.length;
      const occupiedProperties = tenantsData.filter(t => t.property_id).length;
      const occupancyRate = propertyCount > 0 ? (occupiedProperties / propertyCount) * 100 : 0;

      setStats({
        rentCollected: totalIncome,
        activeTenants: activeTenants,
        propertyCount: propertyCount,
        occupancyRate: occupancyRate,
      });
      
      if (tenantsData) {
        findNextRentDue(tenantsData);
      }
      if (recentTransactionsData) {
        setRecentTransactions(recentTransactionsData);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isFocused) {
      fetchDashboardData();
    }
  }, [isFocused]);

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
            <Text style={styles.header}>Início</Text>
        </View>
        <ScrollView style={styles.scrollContainer}>
      
        <View style={styles.statsContainer}>
            <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                <MaterialIcons name="attach-money" size={24} color="#fff" />
                </View>
                <Text style={styles.statAmount}>R${stats.rentCollected.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Aluguel Coletado</Text>
                <Text style={styles.statSubLabel}>Este Mês</Text>
            </View>
            
            <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#4CAF50' }]}>
                <MaterialIcons name="people" size={24} color="#fff" />
                </View>
                <Text style={styles.statAmount}>{stats.activeTenants}</Text>
                <Text style={styles.statLabel}>Inquilinos Ativos</Text>
                <Text style={styles.statSubLabel}>Em {stats.propertyCount} Propriedades</Text>
            </View>
            
            <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#FF9800' }]}>
                    <MaterialIcons name="event" size={24} color="#fff" />
                </View>
                {nextRentDue.days !== null ? (
                    <>
                    <Text style={styles.statAmount}>{nextRentDue.days}</Text>
                    <Text style={styles.statLabel}>Próximo Aluguel</Text>
                    <Text style={styles.statSubLabel}>Vence em {nextRentDue.days} Dias</Text>
                    </>
                ) : (
                    <>
                    <Text style={styles.statAmount}>N/A</Text>
                    <Text style={styles.statLabel}>Próximo Aluguel</Text>
                    <Text style={styles.statSubLabel}>Sem inquilinos</Text>
                    </>
                )}
            </View>
        </View>

        <View style={styles.occupancyCard}>
            <Text style={styles.occupancyTitle}>Imóveis ocupados</Text>
            <Text style={styles.occupancyRate}>{stats.occupancyRate.toFixed(1)}%</Text>
            <View style={styles.occupancyBar}>
                <View style={[styles.occupancyFill, { width: `${stats.occupancyRate}%` }]} />
            </View>
        </View>
        
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Atividade Recente</Text>
            {recentTransactions.map(transaction => (
              <View key={transaction.id} style={styles.transactionCard}>
                  <View style={styles.transactionDetails}>
                      <Text style={styles.transactionDesc}>{transaction.description}</Text>
                      <Text style={styles.transactionProperty}>{transaction.properties?.address || 'N/A'}</Text>
                  </View>
                  <Text style={[
                  styles.transactionAmount,
                  transaction.type === 'income' ? styles.income : styles.expense
                  ]}>
                  {transaction.type === 'income' ? '+' : '-'}R${transaction.amount}
                  </Text>
              </View>
            ))}
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    width: '100%',
    maxWidth: '32%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 10,
  },
  statIconContainer: {
    backgroundColor: '#4a86e8',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  statSubLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  occupancyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
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
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
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
});

export default DashboardScreen;