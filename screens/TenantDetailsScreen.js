import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';

const TenantDetailsScreen = ({ route }) => {
  const tenant = route.params?.tenant || {
    name: 'Sophia Carter',
    id: '12345',
    phone: '(555) 123-4567',
    email: 'sophia.carter@email.com',
    property: '123 Main St, Apt 2B',
    startDate: '01/15/2023',
    endDate: '01/14/2024',
    rent: 1500,
    deposit: 1500,
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={require('../assets/avatar-placeholder.png')} 
          style={styles.avatar} 
        />
        <Text style={styles.tenantName}>{tenant.name}</Text>
        <Text style={styles.tenantId}>Identificação do Inquilino: {tenant.id}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações de Contato</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Telefone</Text>
          <Text style={styles.infoValue}>{tenant.phone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{tenant.email}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes do Contrato</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Propriedade</Text>
          <Text style={styles.infoValue}>{tenant.property}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Início do Contrato</Text>
          <Text style={styles.infoValue}>{tenant.startDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Término do Contrato</Text>
          <Text style={styles.infoValue}>{tenant.endDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Valor do Aluguel</Text>
          <Text style={styles.infoValue}>${tenant.rent}/month</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Financeiro</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Depósito Caução</Text>
          <Text style={styles.infoValue}>${tenant.deposit}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Histórico de Pagamentos</Text>
          <Text style={[styles.infoValue, styles.link]}>Ver Histórico</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notas & Documentos</Text>
        <Text style={styles.noNotes}>Nenhuma nota ou documento adicionado ainda.</Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.buttonText}>Editar Inquilino</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.manageButton}>
          <Text style={styles.buttonText}>Gerenciar Contrato</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4a86e8',
    padding: 30,
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  tenantName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  tenantId: {
    color: '#fff',
    fontSize: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    marginHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    color: '#666',
  },
  infoValue: {
    fontWeight: '500',
  },
  link: {
    color: '#4a86e8',
  },
  noNotes: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: '#4a86e8',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  manageButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default TenantDetailsScreen;