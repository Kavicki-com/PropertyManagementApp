// screens/LinkTenantScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';

const TenantItem = ({ item, onPress }) => {
  const isOccupied = !!item.property_id;

  return (
    <TouchableOpacity style={styles.tenantCard} onPress={() => onPress(item)}>
      <Image
        source={require('../assets/avatar-placeholder.png')}
        style={styles.avatar}
      />
      <View style={styles.tenantInfo}>
        <Text style={styles.tenantName}>{item.full_name}</Text>
        <View style={styles.tenantMetaRow}>
          <MaterialIcons name="phone" size={16} color="#666" />
          <Text style={styles.tenantMetaText}>{item.phone || 'Sem telefone'}</Text>
        </View>
      </View>
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
          {isOccupied ? 'Ocupado' : 'Disponível'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const LinkTenantScreen = ({ route, navigation }) => {
  const { propertyId } = route.params;

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching tenants:', error);
      Alert.alert('Erro', 'Não foi possível carregar a lista de inquilinos.');
    } else {
      setTenants(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleSelectTenant = (tenant) => {
    if (tenant.property_id) {
      Alert.alert(
        'Inquilino já vinculado',
        'Este inquilino já está vinculado a um imóvel. Ao continuar, ele será movido para este imóvel e o vínculo anterior será removido, garantindo que o imóvel anterior não fique com dois inquilinos. Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar',
            onPress: () => linkTenant(tenant, { forceMove: true }),
          },
        ]
      );
    } else {
      linkTenant(tenant);
    }
  };

  const linkTenant = async (tenant, options = {}) => {
    const { forceMove = false } = options;
    setLoading(true);

    try {
      // Antes de vincular o novo inquilino a este imóvel,
      // removemos qualquer outro inquilino que esteja usando o mesmo imóvel.
      const { error: clearError } = await supabase
        .from('tenants')
        .update({ property_id: null })
        .eq('property_id', propertyId)
        .neq('id', tenant.id);

      if (clearError) {
        console.error('Error clearing previous tenants for property:', clearError);
        Alert.alert(
          'Erro',
          'Não foi possível atualizar o vínculo atual deste imóvel. Tente novamente.'
        );
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('tenants')
        .update({ property_id: propertyId })
        .eq('id', tenant.id);

      if (error) {
        console.error('Error linking tenant:', error);
        Alert.alert('Erro', 'Não foi possível vincular o inquilino.');
      } else {
        Alert.alert(
          'Sucesso',
          forceMove
            ? 'Inquilino movido para a propriedade selecionada.'
            : 'Inquilino vinculado à propriedade.'
        );
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewTenant = () => {
    navigation.navigate('AddTenant', { preselectedPropertyId: propertyId });
  };

  if (loading && tenants.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Vincular Inquilino"
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={tenants}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TenantItem item={item} onPress={handleSelectTenant} />}
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity style={styles.addButton} onPress={handleCreateNewTenant}>
        <MaterialIcons name="person-add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Cadastrar novo inquilino</Text>
      </TouchableOpacity>
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
  tenantCard: {
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tenantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tenantMetaText: {
    marginLeft: 5,
    fontSize: 13,
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
  addButton: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 20,
    backgroundColor: '#4a86e8',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addButtonText: {
    marginLeft: 8,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});

export default LinkTenantScreen;


