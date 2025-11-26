import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';

const PropertyItem = ({ item, onPress }) => {
  const isOccupied = item.tenants && item.tenants.length > 0;

  return (
    <TouchableOpacity style={styles.propertyCard} onPress={() => onPress(item)}>
      <View style={styles.propertyInfo}>
        <Text style={styles.propertyAddress} numberOfLines={1} ellipsizeMode="tail">
          {item.address}
        </Text>
        <View style={styles.propertyMetaRow}>
          <Text style={styles.propertyRent}>R${item.rent || 0}/mês</Text>
          <View
            style={[
              styles.statusBadge,
              isOccupied ? styles.statusOccupied : styles.statusAvailable,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isOccupied ? styles.statusOccupiedText : styles.statusAvailableText,
              ]}
            >
              {isOccupied ? 'Com inquilino' : 'Disponível'}
            </Text>
          </View>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#999" />
    </TouchableOpacity>
  );
};

const LinkPropertyScreen = ({ route, navigation }) => {
  const { tenantId } = route.params;

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProperties = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('properties')
      .select('id, address, rent, tenants(id)')
      .is('archived_at', null);

    if (error) {
      console.error('Error fetching properties:', error);
      Alert.alert('Erro', 'Não foi possível carregar a lista de propriedades.');
    } else {
      setProperties(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleSelectProperty = (property) => {
    const isOccupied = property.tenants && property.tenants.length > 0;

    if (isOccupied) {
      Alert.alert(
        'Propriedade ocupada',
        'Este imóvel já possui um inquilino e não pode ser alugado por outro ao mesmo tempo. O inquilino atual será desvinculado e este inquilino será movido para este imóvel. Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar',
            onPress: () => linkProperty(property, { forceMove: true }),
          },
        ],
      );
    } else {
      linkProperty(property);
    }
  };

  const linkProperty = async (property, options = {}) => {
    const { forceMove = false } = options;
    setLoading(true);

    try {
      // Se já existir algum outro inquilino neste imóvel, garantimos que ele seja desvinculado
      // antes de vincular o novo inquilino, mantendo a regra de 1 inquilino por imóvel.
      const { error: clearError } = await supabase
        .from('tenants')
        .update({ property_id: null })
        .eq('property_id', property.id)
        .neq('id', tenantId);

      if (clearError) {
        console.error('Error clearing previous tenants from property:', clearError);
        Alert.alert(
          'Erro',
          'Não foi possível atualizar o vínculo atual deste imóvel. Tente novamente.'
        );
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('tenants')
        .update({ property_id: property.id })
        .eq('id', tenantId);

      if (error) {
        console.error('Error linking property:', error);
        Alert.alert('Erro', 'Não foi possível vincular a propriedade.');
      } else {
        Alert.alert(
          'Sucesso',
          forceMove
            ? 'Inquilino movido para o imóvel selecionado.'
            : 'Propriedade vinculada ao inquilino.'
        );
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
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
      <ScreenHeader
        title="Vincular Propriedade"
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={properties}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <PropertyItem item={item} onPress={handleSelectProperty} />
        )}
        contentContainerStyle={styles.listContent}
        onRefresh={fetchProperties}
        refreshing={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 15,
    paddingBottom: 80,
  },
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyInfo: {
    flex: 1,
    marginRight: 8,
  },
  propertyAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propertyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  propertyRent: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusAvailable: {
    backgroundColor: '#e3f2fd',
    borderColor: '#bbdefb',
  },
  statusOccupied: {
    backgroundColor: '#e8f5e9',
    borderColor: '#c8e6c9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusAvailableText: {
    color: '#1565c0',
  },
  statusOccupiedText: {
    color: '#2e7d32',
  },
});

export default LinkPropertyScreen;


