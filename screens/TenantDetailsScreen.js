import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const TenantDetailsScreen = ({ route, navigation }) => {
  const { tenant: initialTenant } = route.params;
  
  const [tenant, setTenant] = useState(initialTenant);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    const fetchDetails = async () => {
      if (!initialTenant?.id) return;

      setLoading(true);
      
      // This query fetches the latest tenant info AND the address of their linked property
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select(`
          *,
          properties (
            address
          )
        `)
        .eq('id', initialTenant.id)
        .single();

      if (tenantError) {
        setLoading(false);
        Alert.alert('Error', 'Could not fetch tenant details.');
        console.error('Error fetching details:', tenantError);
        return;
      }
      
      setTenant(tenantData);
      setLoading(false);
    };

    // Re-fetch data every time the screen comes into focus
    if (isFocused) {
      fetchDetails();
    }
  }, [isFocused, initialTenant?.id]);

  const handleDeleteTenant = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Você tem certeza que quer deletar este inquilino?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Deletar", 
          onPress: async () => {
            const { error } = await supabase.from('tenants').delete().eq('id', tenant.id);
            if (error) {
              Alert.alert('Erro', 'Não foi possível deletar o inquilino.');
            } else {
              Alert.alert('Sucesso', 'Inquilino deletado.');
              navigation.goBack();
            }
          },
          style: 'destructive' 
        }
      ]
    );
  };

  if (loading || !tenant) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={require('../assets/avatar-placeholder.png')} 
          style={styles.avatar} 
        />
        <Text style={styles.tenantName}>{tenant.full_name}</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações de Contato</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Telefone</Text>
          <Text style={styles.infoValue}>{tenant.phone || 'N/A'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{tenant.email || 'N/A'}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalhes do Contrato</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Propriedade</Text>
          <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode='tail'>{tenant.properties?.address || 'Nenhuma'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Valor do Aluguel</Text>
          <Text style={styles.infoValue}>${tenant.rent_amount || 0}/mês</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Vencimento</Text>
          <Text style={styles.infoValue}>{tenant.due_date ? `Todo dia ${tenant.due_date}` : 'N/A'}</Text>
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => navigation.navigate('EditTenant', { tenant: tenant })}
        >
          <Text style={styles.buttonText}>Editar Inquilino</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTenant}>
          <Text style={styles.buttonText}>Deletar Inquilino</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
    header: { backgroundColor: '#4a86e8', padding: 30, paddingTop: 50, alignItems: 'center', marginBottom: 15 },
    avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 15 },
    tenantName: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
    section: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, marginHorizontal: 15 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
    infoLabel: { color: '#666' },
    infoValue: { fontWeight: '500', flex: 1, textAlign: 'right' },
    buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, marginBottom: 20 },
    editButton: { backgroundColor: '#FF9800', padding: 15, borderRadius: 8, flex: 1, marginRight: 10, alignItems: 'center' },
    deleteButton: { backgroundColor: '#F44336', padding: 15, borderRadius: 8, flex: 1, marginLeft: 10, alignItems: 'center' },
    buttonText: { color: '#fff', fontWeight: 'bold' },
});

export default TenantDetailsScreen;

