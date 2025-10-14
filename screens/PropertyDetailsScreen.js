// screens/PropertyDetailsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';

const PropertyDetailsScreen = ({ route, navigation }) => {
  const { property } = route.params;

  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    const fetchTenantForProperty = async () => {
      if (!property?.id) return;

      setLoading(true);
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

    if (isFocused) {
        fetchTenantForProperty();
    }
  }, [property?.id, isFocused]);

  const handleDeleteProperty = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Você tem certeza que quer deletar esta propriedade? Todos os inquilinos e registros financeiros associados serão permanentemente removidos.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Deletar", 
          onPress: async () => {
            setIsDeleting(true);

            // Etapa 1: Desvincular inquilinos (opcional, mas boa prática)
            const { error: tenantUpdateError } = await supabase
              .from('tenants')
              .update({ property_id: null })
              .eq('property_id', property.id);

            if (tenantUpdateError) {
              Alert.alert('Erro', 'Não foi possível desvincular o inquilino da propriedade.');
              setIsDeleting(false);
              return;
            }

            // Etapa 2: Deletar registros financeiros associados (CORREÇÃO)
            const { error: financeError } = await supabase
              .from('finances')
              .delete()
              .eq('property_id', property.id);

            if (financeError) {
              Alert.alert('Erro', 'Não foi possível deletar os registros financeiros associados.');
              setIsDeleting(false);
              return;
            }
            
            // Etapa 3: Deletar a propriedade
            const { error: deleteError } = await supabase
              .from('properties')
              .delete()
              .eq('id', property.id);
            
            if (deleteError) {
              Alert.alert('Erro', 'Não foi possível deletar a propriedade.');
            } else {
              Alert.alert('Sucesso', 'Propriedade deletada.');
              navigation.goBack();
            }
            setIsDeleting(false);
          },
          style: 'destructive' 
        }
      ]
    );
  };

  if (!property) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Property not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.header} numberOfLines={1} ellipsizeMode='tail'>{property.address}</Text>
      </View>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalhes da Propriedade</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tipo</Text>
            <Text style={styles.infoValue}>{property.type || 'N/A'}</Text>
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
            <Text style={styles.infoValue}>R${property.rent}/mês</Text>
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
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => navigation.navigate('EditProperty', { property: property })}
          >
            <Text style={styles.buttonText}>Editar Propriedade</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={handleDeleteProperty}
            disabled={isDeleting}
          >
            {isDeleting ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Deletar Propriedade</Text>}
          </TouchableOpacity>
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
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingTop: 50,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    backButton: {
        marginRight: 15,
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        flex: 1,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 15,
        marginHorizontal: 15,
        marginTop: 15,
        marginBottom: 0,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
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
        flexDirection: 'column',
        gap: 8,
        justifyContent: 'center',
        paddingHorizontal: 15,
        paddingVertical: 20,
    },
    editButton: {
        backgroundColor: '#4a86e8',
        padding: 15,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
    },
    deleteButton: {
        backgroundColor: '#F44336',
        padding: 15,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
    },
    buttonText: { 
        color: 'white',
        fontWeight: 'bold',
    },
});

export default PropertyDetailsScreen;