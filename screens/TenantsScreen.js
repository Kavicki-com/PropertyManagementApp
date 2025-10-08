import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const tenants = [
  { id: '1', name: 'Ethan Harper', address: '123 Main St, Apt 1' },
  { id: '2', name: 'Sophia Bennett', address: '456 Oak Ave, Unit 2' },
  { id: '3', name: 'Liam Carter', address: '789 Pine Ln, House' },
  { id: '4', name: 'Olivia Davis', address: '101 Elm Rd, Apt 3' },
  { id: '5', name: 'Noah Evans', address: '222 Maple Dr, Unit 4' },
];

const TenantItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.tenantCard} onPress={() => onPress(item)}>
    <Image 
      source={require('../assets/avatar-placeholder.png')} 
      style={styles.avatar} 
    />
    <View style={styles.tenantInfo}>
      <Text style={styles.tenantName}>{item.name}</Text>
      <Text style={styles.tenantAddress}>{item.address}</Text>
    </View>
    <View style={styles.tenantStatus}>
      <Text style={styles.statusActive}>Ativo</Text>
    </View>
  </TouchableOpacity>
);

const TenantsScreen = ({ navigation }) => {
  const handleTenantPress = (tenant) => {
    navigation.navigate('TenantDetails', { tenant });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Inquilinos</Text>
      <FlatList
        data={tenants}
        renderItem={({ item }) => (
          <TenantItem item={item} onPress={handleTenantPress} />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />
      
      {/* Botão flutuante - CORREÇÃO: estilo addButton definido abaixo */}
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => navigation.navigate('AddTenant')}
      >
        <MaterialIcons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
    position: 'relative', // Importante para posicionar o botão flutuante
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  listContent: {
    paddingBottom: 80, // Espaço extra para o botão flutuante
  },
  tenantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  tenantAddress: {
    color: '#666',
    fontSize: 14,
  },
  tenantStatus: {
    backgroundColor: '#e8f5e9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusActive: {
    color: '#4CAF50',
    fontWeight: '500',
    fontSize: 12,
  },
  // ESTILO ADDBUTTON ADICIONADO AQUI
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#4a86e8',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default TenantsScreen;