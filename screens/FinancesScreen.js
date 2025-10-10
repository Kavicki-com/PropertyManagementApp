// screens/FinancesScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

const FinancesScreen = ({ navigation }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({ totalIncome: 0, totalExpenses: 0, netProfit: 0 });
  const isFocused = useIsFocused();

  const fetchFinances = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('finances')
      .select('*, properties (address)'); // Updated query to fetch property address

    if (error) {
      console.error('Error fetching finances:', error);
      Alert.alert('Error', 'Could not fetch financial data.');
    } else {
      setTransactions(data);
      calculateOverview(data);
    }
    setLoading(false);
  };

  const calculateOverview = (data) => {
    const totalIncome = data
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = data
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const netProfit = totalIncome - totalExpenses;
    setOverview({ totalIncome, totalExpenses, netProfit });
  };

  useEffect(() => {
    if (isFocused) {
      fetchFinances();
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
            <Text style={styles.header}>Finanças</Text>
        </View>
        <ScrollView style={styles.scrollContainer}>
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Visão geral</Text>
            <View style={styles.overviewCard}>
            <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>Entradas</Text>
                <Text style={styles.incomeAmount}>R${overview.totalIncome.toFixed(2)}</Text>
            </View>
            <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>Despesas</Text>
                <Text style={styles.expenseAmount}>R${overview.totalExpenses.toFixed(2)}</Text>
            </View>
            <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>Lucro</Text>
                <Text style={styles.profitAmount}>R${overview.netProfit.toFixed(2)}</Text>
            </View>
            </View>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lançamentos</Text>
            {transactions.map(transaction => (
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
  overviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
  overviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  overviewLabel: {
    fontSize: 16,
    color: '#666',
  },
  incomeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F44336',
  },
  profitAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
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
});

export default FinancesScreen;