import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert, // Adicionado para melhor feedback de erro
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { fetchAllProperties } from '../lib/propertiesService';
import { useIsFocused } from '@react-navigation/native';
import SearchBar from '../components/SearchBar';

// Função para formatar endereço na listagem
const formatPropertyAddress = (item) => {
  if (item.street) {
    let address = item.street;
    if (item.number) address += `, ${item.number}`;
    if (item.neighborhood) address += ` - ${item.neighborhood}`;
    return address;
  }
  return item.address || 'Endereço não informado';
};

const PropertyItem = ({ item, onPress }) => {
  const hasTenant = item.tenants && item.tenants.length > 0;
  const status = hasTenant ? 'Alugada' : 'Disponível';
  const statusStyle = hasTenant ? styles.rented : styles.available;
  const statusTextStyle = hasTenant ? styles.rentedText : styles.availableText;

  const imageSource = (item.image_urls && item.image_urls.length > 0)
    ? { uri: item.image_urls[0] }
    : require('../assets/property-placeholder.jpg');

  return (
    <TouchableOpacity style={styles.propertyCard} onPress={() => onPress(item)}>
      <Image 
        source={imageSource}
        style={styles.propertyImage} 
      />
      <View style={styles.propertyInfo}>
        <Text style={styles.propertyAddress} numberOfLines={2}>{formatPropertyAddress(item)}</Text>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Residencial' | 'Comercial'
  const [sortBy, setSortBy] = useState('addressAsc'); // 'rentAsc' | 'rentDesc' | 'addressAsc'
  const [showArchived, setShowArchived] = useState(false);
  const isFocused = useIsFocused();

  const fetchProperties = async () => {
    setLoading(true);
    // Busca todas as propriedades; o filtro de status é aplicado em memória
    const { data, error } = await fetchAllProperties();

    if (error) {
      console.error('Error fetching properties:', error);
      Alert.alert("Erro", "Não foi possível carregar as propriedades.");
    } else {
      setProperties(data || []);
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

  const { activeProperties, archivedProperties } = useMemo(() => {
    let result = [...properties];

    // Filtro por texto (endereço - busca em todos os campos)
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((p) => {
        const searchableFields = [
          p.address,
          p.street,
          p.neighborhood,
          p.city,
          p.cep,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableFields.includes(query);
      });
    }

    // Filtro por tipo
    if (typeFilter !== 'all') {
      result = result.filter((p) => p.type === typeFilter);
    }

    // Ordenação
    result.sort((a, b) => {
      if (sortBy === 'addressAsc') {
        const addrA = (a.address || '').toLowerCase();
        const addrB = (b.address || '').toLowerCase();
        return addrA.localeCompare(addrB);
      }

      const rentA = a.rent || 0;
      const rentB = b.rent || 0;

      if (sortBy === 'rentAsc') {
        return rentA - rentB;
      }

      // rentDesc
      return rentB - rentA;
    });

    const active = result.filter((p) => !p.archived_at);
    const archived = result.filter((p) => !!p.archived_at);

    return { activeProperties: active, archivedProperties: archived };
  }, [properties, searchQuery, typeFilter, sortBy]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {loading && properties.length === 0 ? (
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.header}>Propriedades</Text>
            </View>

            {/* Barra de busca e filtros */}
            <View style={styles.filtersContainer}>
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por endereço"
              />
        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Tipo</Text>
            <View style={styles.filterChipsContainer}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  typeFilter === 'all' && styles.chipActive,
                ]}
                onPress={() => setTypeFilter('all')}
              >
                <Text
                  style={[
                    styles.chipText,
                    typeFilter === 'all' && styles.chipTextActive,
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chip,
                  typeFilter === 'Residencial' && styles.chipActive,
                ]}
                onPress={() => setTypeFilter('Residencial')}
              >
                <Text
                  style={[
                    styles.chipText,
                    typeFilter === 'Residencial' && styles.chipTextActive,
                  ]}
                >
                  Residencial
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chip,
                  typeFilter === 'Comercial' && styles.chipActive,
                ]}
                onPress={() => setTypeFilter('Comercial')}
              >
                <Text
                  style={[
                    styles.chipText,
                    typeFilter === 'Comercial' && styles.chipTextActive,
                  ]}
                >
                  Comercial
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Ordenar por</Text>
            <View style={styles.filterChipsContainer}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  sortBy === 'rentAsc' && styles.chipActive,
                ]}
                onPress={() => setSortBy('rentAsc')}
              >
                <Text
                  style={[
                    styles.chipText,
                    sortBy === 'rentAsc' && styles.chipTextActive,
                  ]}
                >
                  Aluguel ↑
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chip,
                  sortBy === 'rentDesc' && styles.chipActive,
                ]}
                onPress={() => setSortBy('rentDesc')}
              >
                <Text
                  style={[
                    styles.chipText,
                    sortBy === 'rentDesc' && styles.chipTextActive,
                  ]}
                >
                  Aluguel ↓
                </Text>
              </TouchableOpacity>
            </View>
          </View>

              </View>
            </View>
            <FlatList
              data={activeProperties}
              renderItem={({ item }) => (
                <PropertyItem item={item} onPress={handlePropertyPress} />
              )}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.listContent}
              onRefresh={fetchProperties} // Permite "puxar para atualizar"
              refreshing={loading}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={
                archivedProperties.length > 0 ? (
                  <View style={styles.archivedSection}>
                    <TouchableOpacity
                      style={styles.archivedToggleButton}
                      onPress={() => setShowArchived(!showArchived)}
                    >
                      <Text style={styles.archivedToggleText}>
                        {showArchived
                          ? 'Ocultar imóveis arquivados'
                          : `Ver imóveis arquivados (${archivedProperties.length})`}
                      </Text>
                    </TouchableOpacity>

                    {showArchived && (
                      <View style={styles.archivedList}>
                        {archivedProperties.map((item) => (
                          <PropertyItem
                            key={item.id}
                            item={item}
                            onPress={handlePropertyPress}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                ) : null
              }
            />
            
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={() => navigation.navigate('AddProperty')}
            >
              <MaterialIcons name="add" size={30} color="white" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </TouchableWithoutFeedback>
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
  filtersContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 5,
  },
  filterGroup: {
    marginBottom: 6,
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#4a86e8',
    borderColor: '#4a86e8',
  },
  chipText: {
    fontSize: 12,
    color: '#555',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
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
  archivedSection: {
    marginTop: 10,
  },
  archivedToggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 0,
    borderWidth: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  archivedToggleText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  archivedList: {
    marginTop: 10,
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