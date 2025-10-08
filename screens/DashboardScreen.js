import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const DashboardScreen = ({ navigation }) => {
  const stats = {
    rentCollected: 2450,
    activeTenants: 3,
    upcomingRent: 1,
  };

  const recentActivity = [
    { id: 1, tenant: 'Inquilino A', amount: 800, type: 'Pagamento Recebido' },
    { id: 2, tenant: 'Inquilino B', amount: 750, type: 'Pagamento Recebido' },
    { id: 3, tenant: 'Inquilino C', amount: 900, type: 'Pagamento Recebido' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Início</Text>
      
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <MaterialIcons name="attach-money" size={24} color="#fff" />
          </View>
          <Text style={styles.statAmount}>R${stats.rentCollected}</Text>
          <Text style={styles.statLabel}>Aluguel Coletado</Text>
          <Text style={styles.statSubLabel}>Este Mês</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: '#4CAF50' }]}>
            <MaterialIcons name="people" size={24} color="#fff" />
          </View>
          <Text style={styles.statAmount}>{stats.activeTenants}</Text>
          <Text style={styles.statLabel}>Inquilinos Ativos</Text>
          <Text style={styles.statSubLabel}>Em 2 Propriedades</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: '#FF9800' }]}>
            <MaterialIcons name="event" size={24} color="#fff" />
          </View>
          <Text style={styles.statAmount}>{stats.upcomingRent}</Text>
          <Text style={styles.statLabel}>Próximo Aluguel</Text>
          <Text style={styles.statSubLabel}>Vence em 5 Dias</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Atividade Recente</Text>
        {recentActivity.map(activity => (
          <View key={activity.id} style={styles.activityCard}>
            <View style={styles.activityIcon}>
              <MaterialIcons name="account-circle" size={40} color="#4a86e8" />
            </View>
            <View style={styles.activityDetails}>
              <Text style={styles.activityTenant}>{activity.tenant}</Text>
              <Text style={styles.activityType}>{activity.type}</Text>
            </View>
            <Text style={styles.activityAmount}>R${activity.amount}</Text>
          </View>
        ))}
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
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  activityIcon: {
    marginRight: 15,
  },
  activityDetails: {
    flex: 1,
  },
  activityTenant: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  activityType: {
    color: '#666',
    fontSize: 14,
  },
  activityAmount: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#4CAF50',
  },
});

export default DashboardScreen;