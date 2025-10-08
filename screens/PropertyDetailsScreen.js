import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

const PropertyDetailsScreen = ({ route }) => {
  const property = route.params?.property || {
    address: '123 Main St, Anytown, USA',
    type: 'Single-Family Home',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1500,
    lotSize: '0.25 acres',
    rent: 1800,
    leaseTerm: 12,
    startDate: '01/01/2023',
    endDate: '12/31/2023',
    tenant: 'Ethan Carter',
    phone: '555-123-4567',
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Detalhes da Propriedade</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Endereço</Text>
        <Text style={styles.infoText}>{property.address}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo de Propriedade</Text>
        <Text style={styles.infoText}>{property.type}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Características</Text>
        <View style={styles.featuresRow}>
          <View style={styles.featureItem}>
            <Text style={styles.featureLabel}>Quartos</Text>
            <Text style={styles.featureValue}>{property.bedrooms}</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureLabel}>Banheiros</Text>
            <Text style={styles.featureValue}>{property.bathrooms}</Text>
          </View>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureLabel}>Área Construída</Text>
          <Text style={styles.featureValue}>{property.sqft} sq ft</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureLabel}>Tamanho do Lote</Text>
          <Text style={styles.featureValue}>{property.lotSize}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aluguel & Contrato</Text>
        <View style={styles.featuresRow}>
          <View style={styles.featureItem}>
            <Text style={styles.featureLabel}>Aluguel</Text>
            <Text style={styles.featureValue}>${property.rent}/month</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureLabel}>Prazo do Contrato</Text>
            <Text style={styles.featureValue}>{property.leaseTerm} months</Text>
          </View>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureLabel}>Início do Contrato</Text>
          <Text style={styles.featureValue}>{property.startDate}</Text>
        </View>
        <View style={styles.featureItem}>
          <Text style={styles.featureLabel}>Término do Contrato</Text>
          <Text style={styles.featureValue}>{property.endDate}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inquilino(s)</Text>
        <View style={styles.tenantCard}>
          <Text style={styles.tenantName}>{property.tenant}</Text>
          <Text style={styles.tenantPhone}>{property.phone}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Histórico de Pagamentos</Text>
        <View style={styles.paymentItem}>
          <Text style={styles.paymentMonth}>Novembro 2023</Text>
          <Text style={styles.paymentStatus}>Pago</Text>
          <Text style={styles.paymentAmount}>${property.rent}</Text>
        </View>
        <View style={styles.paymentItem}>
          <Text style={styles.paymentMonth}>Outubro 2023</Text>
          <Text style={styles.paymentStatus}>Pago</Text>
          <Text style={styles.paymentAmount}>${property.rent}</Text>
        </View>
        <View style={styles.paymentItem}>
          <Text style={styles.paymentMonth}>Setembro 2023</Text>
          <Text style={styles.paymentStatus}>Pago</Text>
          <Text style={styles.paymentAmount}>${property.rent}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documentos & Notas</Text>
        <View style={styles.documentItem}>
          <Text style={styles.documentText}>[ ] Contrato de Aluguel</Text>
        </View>
        <View style={styles.documentItem}>
          <Text style={styles.documentText}>[ ] Relatório de inspeção</Text>
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.buttonText}>Editar Propriedade</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.manageButton}>
          <Text style={styles.buttonText}>Gerenciar Inquilino</Text>
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
    padding: 20,
    marginBottom: 15,
    marginTop:24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
  infoText: {
    fontSize: 16,
    marginBottom: 5,
  },
  featuresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  featureItem: {
    marginBottom: 10,
  },
  featureLabel: {
    color: '#666',
    fontSize: 14,
  },
  featureValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  tenantCard: {
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 15,
  },
  tenantName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  tenantPhone: {
    color: '#666',
  },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  paymentMonth: {
    flex: 2,
  },
  paymentStatus: {
    flex: 1,
    color: '#4CAF50',
    fontWeight: '500',
  },
  paymentAmount: {
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  documentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  documentText: {
    fontSize: 16,
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

export default PropertyDetailsScreen;