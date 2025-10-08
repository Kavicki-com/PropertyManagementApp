// screens/TenantDetailsScreen.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { supabase } from '../lib/supabase'; // Make sure this path is correct

const TenantDetailsScreen = ({ route, navigation }) => { // Add navigation prop
  const { tenant } = route.params;

  // Note: The logic to fetch the associated property remains the same,
  // but we are removing it for simplicity in this step to focus on deletion.
  // You can add it back in from the previous version if you like.

  const handleDeleteTenant = async () => {
    Alert.alert(
      "Confirmar Exclusão",
      "Você tem certeza que quer deletar este inquilino? Esta ação não pode ser desfeita.",
      [
        {
          text: "Cancelar",
          style: "cancel"
        },
        { 
          text: "Deletar", 
          onPress: async () => {
            const { error } = await supabase
              .from('tenants')
              .delete()
              .eq('id', tenant.id);

            if (error) {
              Alert.alert('Erro', 'Não foi possível deletar o inquilino.');
              console.error('Error deleting tenant:', error);
            } else {
              Alert.alert('Sucesso', 'Inquilino deletado.');
              navigation.goBack(); // Go back to the tenants list
            }
          },
          style: 'destructive' 
        }
      ]
    );
  };

  if (!tenant) {
    return (
      <View style={styles.container}>
        <Text>Tenant not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={require('../assets/avatar-placeholder.png')} 
          style={styles.avatar} 
        />
        <Text style={styles.tenantName}>{tenant.full_name}</Text>
        <Text style={styles.tenantId}>Identificação do Inquilino: {tenant.id_number}</Text>
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
          <Text style={styles.infoLabel}>Início do Contrato</Text>
          <Text style={styles.infoValue}>{new Date(tenant.start_date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Término do Contrato</Text>
          <Text style={styles.infoValue}>{new Date(tenant.end_date).toLocaleDateString()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Valor do Aluguel</Text>
          <Text style={styles.infoValue}>${tenant.rent_amount}/mês</Text>
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTenant}>
          <Text style={styles.buttonText}>Deletar Inquilino</Text>
        </TouchableOpacity>
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
    container: {
      flex: 1,
      backgroundColor: '#f5f5f5',
    },
    header: {
      backgroundColor: '#4a86e8',
      padding: 30,
      paddingTop: 50,
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
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 15,
        marginBottom: 20,
    },
    deleteButton: {
        backgroundColor: '#F44336', // Red color
        padding: 15,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
    },
    buttonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    editButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
    alignItems: 'center',
  },
  });

export default TenantDetailsScreen;