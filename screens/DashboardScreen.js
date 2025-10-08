// screens/DashboardScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { startOfMonth, endOfMonth, format } from 'date-fns';

const DashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState({
    rentCollected: 0,
    activeTenants: 0,
    occupiedProperties: 0,
  });
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchDashboardData = async () => {
    setLoading(true);

    // Get the start and end of the current month
    const today = new Date();
    const startDate = format(startOfMonth(today), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(today), 'yyyy-MM-dd');

    // Fetch total income for the current month
    const { data: financeData, error: financeError } = await supabase
      .from('finances')
      .select('amount')
      .eq('type', 'income')
      .gte('date', startDate)
      .lte('date', endDate);

    // Fetch counts for tenants and properties
    const { count: tenantCount, error: tenantError } = await supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true });
    
    const { count: propertyCount, error: propertyError } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true });

    if (financeError || tenantError || propertyError) {
      console.error('Error fetching dashboard data:', financeError || tenantError || propertyError);
    } else {
      const totalIncome = financeData.reduce((sum, transaction) => sum + transaction.amount, 0);
      setStats({
        rentCollected: totalIncome,
        activeTenants: tenantCount,
        propertyCount: propertyCount,
      });
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
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Início</Text>
      
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
        
        {/* This card can be implemented as a more advanced feature later */}
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: '#FF9800' }]}>
            <MaterialIcons name="event" size={24} color="#fff" />
          </View>
          <Text style={styles.statAmount}>1</Text>
          <Text style={styles.statLabel}>Próximo Aluguel</Text>
          <Text style={styles.statSubLabel}>Vence em 5 Dias</Text>
        </View>
      </View>
      
      {/* We can make "Recent Activity" dynamic in a future step */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Atividade Recente</Text>
        {/* Placeholder for recent activity */}
      </View>
    </ScrollView>
  );
};

// ... (Your styles remain the same)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
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
});


export default DashboardScreen;