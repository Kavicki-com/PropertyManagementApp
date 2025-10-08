// screens/PropertyDetailsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

const PropertyDetailsScreen = ({ route, navigation }) => { // Add navigation prop
  const { property } = route.params;

  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenantForProperty = async () => {
      if (!property?.id) return;

      const { data, error } = await supabase
        .from('tenants')
        .select('full_name, phone')
        .eq('property_id', property.id)
        .single(); 

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching tenant:', error);
      } else {
        setTenant(data);
      }
      setLoading(false);
    };

    fetchTenantForProperty();
  }, [property?.id]);

  const handleDeleteProperty = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Você tem certeza que quer deletar esta propriedade? Esta ação não pode ser desfeita.",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        { 
          text: "Deletar", 
          onPress: async () => {
            const { error } = await supabase
              .from('properties')
              .delete()
              .eq('id', property.id);

            if (error) {
              Alert.alert('Erro', 'Não foi possível deletar a propriedade.');
              console.error('Error deleting property:', error);
            } else {
              Alert.alert('Sucesso', 'Propriedade deletada.');
              navigation.goBack(); // Go back to the properties list
            }
          },
          style: 'destructive' 
        }
      ]
    );
  };


  if (!property) {
    return (
      <View style={styles.container}>
        <Text>Property not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{property.address}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes da Propriedade</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tipo</Text>
          <Text style={styles.infoValue}>{property.type}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Quartos</Text>
          <Text style={styles.infoValue}>{property.bedrooms}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Banheiros</Text>
          <Text style={styles.infoValue}>{property.bathrooms}</Text>
        </View>
         <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Área (m²)</Text>
          <Text style={styles.infoValue}>{property.sqft}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aluguel & Contrato</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Aluguel Mensal</Text>
          <Text style={styles.infoValue}>${property.rent}/mês</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Prazo do Contrato</Text>
          <Text style={styles.infoValue}>{property.lease_term} meses</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Início do Contrato</Text>
          <Text style={styles.infoValue}>{new Date(property.start_date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Término do Contrato</Text>
          <Text style={styles.infoValue}>{new Date(property.end_date).toLocaleDateString()}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inquilino(s)</Text>
        {loading ? <ActivityIndicator /> : (
            tenant ? (
                <View style={styles.tenantCard}>
                    <Text style={styles.tenantName}>{tenant.full_name}</Text>
                    <Text style={styles.tenantPhone}>{tenant.phone}</Text>
                </View>
            ) : (
                <Text style={styles.noTenantText}>Nenhum inquilino associado.</Text>
            )
        )}
      </View>
      
      <View style={styles.buttonContainer}>
        {/* We will change this to an "Edit" button later */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProperty}>
          <Text style={styles.buttonText}>Deletar Propriedade</Text>
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
    paddingTop: 40,
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center'
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
    fontSize: 16,
  },
  infoValue: {
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
  noTenantText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 10,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around', // Changed to space-around
    padding: 15,
    marginBottom: 20,
  },
  deleteButton: { // Changed from editButton
    backgroundColor: '#F44336', // Red color for delete
    padding: 15,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default PropertyDetailsScreen;