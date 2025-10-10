// screens/TenantDetailsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';

const TenantDetailsScreen = ({ route, navigation }) => {
  const { tenant: initialTenant } = route.params;
  
  const [tenant, setTenant] = useState(initialTenant);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  useEffect(() => {
    const fetchDetails = async () => {
      if (!initialTenant?.id) return;

      setLoading(true);
      
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select(`
          *,
          properties (
            address,
            rent 
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
    <View style={styles.container}>
        <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.header}>{tenant.full_name}</Text>
            <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.scrollContainer}>
            <View style={styles.avatarContainer}>
                <Image 
                source={require('../assets/avatar-placeholder.png')} 
                style={styles.avatar} 
                />
            </View>
            
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Informações de Contato</Text>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>CPF</Text>
                    <Text style={styles.infoValue}>{tenant.cpf || 'N/A'}</Text>
                </View>
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
                <Text style={styles.infoValue}>${tenant.properties?.rent || 0}/mês</Text>
                </View>
                <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Duração do Contrato</Text>
                <Text style={styles.infoValue}>{tenant.lease_term} meses</Text>
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
    loadingContainer: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#f5f5f5',
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        paddingTop: 50,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    backButton: {
        padding: 5,
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'left',
        flex: 1,
    },
    avatarContainer: {
        alignItems: 'center',
        marginTop: 20,
    },
    avatar: { 
        width: 100, 
        height: 100, 
        borderRadius: 50, 
        marginBottom: 15,
    },
    section: { 
        backgroundColor: '#fff', 
        borderRadius: 12, 
        padding: 15, 
        marginHorizontal: 15,
        marginTop: 20
    },
    sectionTitle: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        marginBottom: 15,
    },
    infoRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingVertical: 12, 
        borderBottomWidth: 1, 
        borderBottomColor: '#eee',
    },
    infoLabel: { 
        color: '#666',
    },
    infoValue: { 
        fontWeight: '500', 
        flex: 1, 
        textAlign: 'right',
    },
    buttonContainer: { 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: 15, 
        gap: 8,
        marginBottom: 20,
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
        color: '#fff', 
        fontWeight: 'bold',
    },
});

export default TenantDetailsScreen;