// screens/FinancesScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
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
    const { data, error } = await supabase.from('finances').select('*');

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
        <Text style={styles.header}>Finances</Text>
        <ScrollView>
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.overviewCard}>
            <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>Total Income</Text>
                <Text style={styles.incomeAmount}>${overview.totalIncome.toFixed(2)}</Text>
            </View>
            <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>Total Expenses</Text>
                <Text style={styles.expenseAmount}>${overview.totalExpenses.toFixed(2)}</Text>
            </View>
            <View style={styles.overviewItem}>
                <Text style={styles.overviewLabel}>Net Profit</Text>
                <Text style={styles.profitAmount}>${overview.netProfit.toFixed(2)}</Text>
            </View>
            </View>
        </View>

        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Transactions</Text>
            {transactions.map(transaction => (
            <View key={transaction.id} style={styles.transactionCard}>
                <Text style={styles.transactionDesc}>{transaction.description}</Text>
                <Text style={[
                styles.transactionAmount,
                transaction.type === 'income' ? styles.income : styles.expense
                ]}>
                {transaction.type === 'income' ? '+' : '-'}${transaction.amount}
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

// ... (Your styles remain the same, with the addition of the addButton style)
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
  transactionDesc: {
    flex: 1,
    marginRight: 10,
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