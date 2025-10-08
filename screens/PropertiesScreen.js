import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const properties = [
  { id: '1', address: '123 Elm Street', type: 'Apartment', status: 'Ocupado' },
  { id: '2', address: '456 Oak Avenue', type: 'House', status: 'Disponível' },
  { id: '3', address: '789 Pine Lane', type: 'Apartment', status: 'Ocupado' },
  { id: '4', address: '101 Maple Drive', type: 'House', status: 'Disponível' },
  { id: '5', address: '222 Cedar Court', type: 'Apartment', status: 'Ocupado' },
];

const PropertyItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.propertyCard} onPress={() => onPress(item)}>
    <Image 
      source={require('../assets/property-placeholder.jpg')} 
      style={styles.propertyImage} 
    />
    <View style={styles.propertyInfo}>
      <Text style={styles.propertyAddress}>{item.address}</Text>
      <View style={styles.propertyMeta}>
        <Text style={styles.propertyType}>{item.type}</Text>
        <View style={[
          styles.statusBadge, 
          item.status === 'Ocupado' ? styles.occupied : styles.vacant
        ]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
);

const PropertiesScreen = ({ navigation }) => {
  const handlePropertyPress = (property) => {
    navigation.navigate('PropertyDetails', { property });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Propriedades</Text>
      <FlatList
        data={properties}
        renderItem={({ item }) => (
          <PropertyItem item={item} onPress={handlePropertyPress} />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />
      
      {/* Botão flutuante - CORREÇÃO: estilo addButton definido abaixo */}
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={() => navigation.navigate('AddProperty')}
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
  propertyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyImage: {
    width: '100%',
    height: 150,
  },
  propertyInfo: {
    padding: 15,
  },
  propertyAddress: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  propertyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  propertyType: {
    color: '#666',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  occupied: {
    backgroundColor: '#ffebee',
  },
  vacant: {
    backgroundColor: '#e8f5e9',
  },
  statusText: {
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

export default PropertiesScreen;