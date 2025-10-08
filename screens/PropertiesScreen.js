// screens/PropertiesScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase'; // Make sure you have created this file
import { useIsFocused } from '@react-navigation/native';

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
        {/* You can add a status field to your database later if you want */}
        {/* <View style={[styles.statusBadge, item.status === 'Ocupado' ? styles.occupied : styles.vacant]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View> */}
      </View>
    </View>
  </TouchableOpacity>
);

const PropertiesScreen = ({ navigation }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchProperties = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('properties').select('*');

    if (error) {
      console.error('Error fetching properties:', error);
    } else {
      setProperties(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isFocused) {
      fetchProperties();
    }
  }, [isFocused]);

  const handlePropertyPress = (property) => {
    navigation.navigate('PropertyDetails', { property });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Propriedades</Text>
      <FlatList
        data={properties}
        renderItem={({ item }) => <PropertyItem item={item} onPress={handlePropertyPress} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddProperty')}
      >
        <MaterialIcons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
};

// ... (styles remain the same)
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