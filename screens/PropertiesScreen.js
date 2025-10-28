import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert, // Adicionado para melhor feedback de erro
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';

const PropertyItem = ({ item, onPress }) => {
  const hasTenant = item.tenants && item.tenants.length > 0;
  const status = hasTenant ? 'Alugada' : 'Disponível';
  const statusStyle = hasTenant ? styles.rented : styles.available;
  const statusTextStyle = hasTenant ? styles.rentedText : styles.availableText;

  // --- CORREÇÃO APLICADA AQUI ---
  // Define a fonte da imagem: usa a primeira URL da lista se existir,
  // caso contrário, usa a imagem placeholder local.
  const imageSource = (item.image_urls && item.image_urls.length > 0)
    ? { uri: item.image_urls[0] }
    : require('../assets/property-placeholder.jpg');

  return (
    <TouchableOpacity style={styles.propertyCard} onPress={() => onPress(item)}>
      <Image 
        source={imageSource} // A imagem agora é dinâmica
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
// --- FIM DA CORREÇÃO ---

const PropertiesScreen = ({ navigation }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchProperties = async () => {
    setLoading(true);
    // A consulta agora seleciona explicitamente a coluna 'image_urls' para garantir que ela seja retornada
    const { data, error } = await supabase
      .from('properties')
      .select('*, image_urls, tenants(id)');

    if (error) {
      console.error('Error fetching properties:', error);
      Alert.alert("Erro", "Não foi possível carregar as propriedades.");
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

  if (loading && properties.length === 0) {
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
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        onRefresh={fetchProperties} // Permite "puxar para atualizar"
        refreshing={loading}
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
    fontSize: 24,
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
    backgroundColor: '#e0e0e0', // Cor de fundo para o placeholder
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
    backgroundColor: '#e8f5e9',
  },
  available: {
    backgroundColor: '#e3f2fd',
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  rentedText: {
    color: '#2e7d32',
  },
  availableText: {
    color: '#1565c0',
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