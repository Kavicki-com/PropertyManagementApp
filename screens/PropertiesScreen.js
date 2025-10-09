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
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

const PropertyItem = ({ item, onPress }) => {
  // Check if the property has any tenants associated with it
  const hasTenant = item.tenants && item.tenants.length > 0;
  const status = hasTenant ? 'Alugada' : 'Disponível';
  const statusStyle = hasTenant ? styles.rented : styles.available;
  const statusTextStyle = hasTenant ? styles.rentedText : styles.availableText;

  return (
    <TouchableOpacity style={styles.propertyCard} onPress={() => onPress(item)}>
      <Image 
        source={require('../assets/property-placeholder.jpg')} 
        style={styles.propertyImage} 
      />
      <View style={styles.propertyInfo}>
        <Text style={styles.propertyAddress}>{item.address}</Text>
        <View style={styles.propertyMeta}>
          <Text style={styles.propertyType}>{item.type}</Text>
          <View style={[styles.statusBadge, statusStyle]}>
            <Text style={[styles.statusText, statusTextStyle]}>{status}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const PropertiesScreen = ({ navigation }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchProperties = async () => {
    setLoading(true);
    // Updated query to fetch properties and a count of their tenants
    const { data, error } = await supabase
      .from('properties')
      .select('*, tenants(id)'); // This fetches all properties and checks for linked tenants

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
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Propriedades</Text>
      </View>
      <FlatList
        data={properties}
        renderItem={({ item }) => (
          <PropertyItem item={item} onPress={handlePropertyPress} />
        )}
        keyExtractor={item => item.id}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    padding: 15,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  listContent: {
    padding: 15,
    paddingBottom: 80,
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
    marginBottom: 8,
  },
  propertyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  propertyType: {
    color: '#666',
    fontSize: 14,
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  rented: {
    backgroundColor: '#e8f5e9', // Light green background
  },
  available: {
    backgroundColor: '#e3f2fd', // Light blue background
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  rentedText: {
    color: '#2e7d32', // Dark green text
  },
  availableText: {
    color: '#1565c0', // Dark blue text
  },
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
