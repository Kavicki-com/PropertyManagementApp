import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const FinancesScreen = () => {
  const transactions = [
    { id: 1, description: '123 Main St Rent Payment', amount: 1200, type: 'income' },
    { id: 2, description: '456 Oak Ave Maintenance', amount: 300, type: 'expense' },
    { id: 3, description: '789 Pine Ln Rent Payment', amount: 1500, type: 'income' },
    { id: 4, description: '123 Main St Property Tax', amount: 800, type: 'expense' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Finances</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.overviewCard}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Total Income</Text>
            <Text style={styles.incomeAmount}>$12,500</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Total Expenses</Text>
            <Text style={styles.expenseAmount}>$3,200</Text>
          </View>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewLabel}>Net Profit</Text>
            <Text style={styles.profitAmount}>$9,300</Text>
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
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reports</Text>
        <View style={styles.reportsContainer}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Monthly Income</Text>
          </View>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Expense Breakdown</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

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
  reportsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '48%',
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportTitle: {
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default FinancesScreen;