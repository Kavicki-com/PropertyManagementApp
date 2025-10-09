import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useIsFocused } from '@react-navigation/native'; // 1. Import useIsFocused
import { supabase } from '../lib/supabase';

const PropertyDetailsScreen = ({ route, navigation }) => {
  // Use the initial property ID from route params
  const { property: initialProperty } = route.params;
  const isFocused = useIsFocused(); // 2. Hook to check if the screen is active

  // 3. Create state to hold the dynamic property data
  const [currentProperty, setCurrentProperty] = useState(initialProperty);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  // 4. Create a new useEffect that re-fetches data when the screen is focused
  useEffect(() => {
    const fetchData = async () => {
      if (!initialProperty?.id) return;

      setLoading(true);

      // Fetch the latest property details
      const { data: updatedProperty, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', initialProperty.id)
        .single();
      
      if (propertyError) {
        Alert.alert('Error', 'Could not refresh property details.');
      } else {
        setCurrentProperty(updatedProperty);

        // Now, fetch the tenant associated with the (potentially new) property data
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('full_name, phone')
          .eq('property_id', updatedProperty.id)
          .single();

        if (tenantError && tenantError.code !== 'PGRST116') {
          console.error('Error fetching tenant:', tenantError);
        } else {
          setTenant(tenantData);
        }
      }
      setLoading(false);
    };

    if (isFocused) {
      fetchData();
    }
  }, [isFocused, initialProperty?.id]); // Re-run when the screen is focused

  const handleDeleteProperty = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Você tem certeza que quer deletar esta propriedade?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Deletar", 
          onPress: async () => {
            const { error } = await supabase
              .from('properties')
              .delete()
              .eq('id', currentProperty.id);

            if (error) {
              Alert.alert('Erro', 'Não foi possível deletar a propriedade.');
            } else {
              Alert.alert('Sucesso', 'Propriedade deletada.');
              navigation.goBack();
            }
          },
          style: 'destructive' 
        }
      ]
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" style={{flex: 1, justifyContent: 'center'}} />;
  }

  if (!currentProperty) {
    return (
      <View style={styles.container}><Text>Propriedade não encontrada.</Text></View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* 5. Use 'currentProperty' from state instead of 'property' from route params */}
      <View style={styles.header}>
        <Text style={styles.title}>{currentProperty.address}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes da Propriedade</Text>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Tipo</Text><Text style={styles.infoValue}>{currentProperty.type}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Quartos</Text><Text style={styles.infoValue}>{currentProperty.bedrooms}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Banheiros</Text><Text style={styles.infoValue}>{currentProperty.bathrooms}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Área (m²)</Text><Text style={styles.infoValue}>{currentProperty.sqft}</Text></View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aluguel & Contrato</Text>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Aluguel Mensal</Text><Text style={styles.infoValue}>${currentProperty.rent}/mês</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Prazo do Contrato</Text><Text style={styles.infoValue}>{currentProperty.lease_term} meses</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Início do Contrato</Text><Text style={styles.infoValue}>{new Date(currentProperty.start_date).toLocaleDateString()}</Text></View>
        <View style={styles.infoRow}><Text style={styles.infoLabel}>Término do Contrato</Text><Text style={styles.infoValue}>{new Date(currentProperty.end_date).toLocaleDateString()}</Text></View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inquilino(s)</Text>
        {tenant ? (
            <View style={styles.tenantCard}><Text style={styles.tenantName}>{tenant.full_name}</Text><Text style={styles.tenantPhone}>{tenant.phone}</Text></View>
        ) : (
            <Text style={styles.noTenantText}>Nenhum inquilino associado.</Text>
        )}
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.editButton} onPress={() => navigation.navigate('EditProperty', { property: currentProperty })}>
          <Text style={styles.buttonText}>Editar Propriedade</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteProperty}>
          <Text style={styles.buttonText}>Deletar Propriedade</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { backgroundColor: '#4a86e8', padding: 20, paddingTop: 50, marginBottom: 15 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
    section: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, marginHorizontal: 15 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
    infoLabel: { color: '#666', fontSize: 16 },
    infoValue: { fontSize: 16, fontWeight: '500' },
    tenantCard: { backgroundColor: '#f0f7ff', borderRadius: 8, padding: 15 },
    tenantName: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
    tenantPhone: { color: '#666' },
    noTenantText: { textAlign: 'center', color: '#666', paddingVertical: 10, fontStyle: 'italic' },
    buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, marginBottom: 20 },
    editButton: { backgroundColor: '#FF9800', padding: 15, borderRadius: 8, flex: 1, marginRight: 10, alignItems: 'center' },
    deleteButton: { backgroundColor: '#F44336', padding: 15, borderRadius: 8, flex: 1, marginLeft: 10, alignItems: 'center' },
    buttonText: { color: '#fff', fontWeight: 'bold' },
});

export default PropertyDetailsScreen;
