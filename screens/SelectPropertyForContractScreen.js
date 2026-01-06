// screens/SelectPropertyForContractScreen.js
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
import { colors, radii, typography } from '../theme';
import { fetchActiveContractByProperty } from '../lib/contractsService';

// Função para formatar valor monetário
const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00';
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
};

const PropertyItem = ({ item, onPress }) => {
  const hasTenant = item.tenants && item.tenants.length > 0;
  const status = hasTenant ? 'Alugada' : 'Disponível';
  const statusStyle = hasTenant ? styles.rented : styles.available;

  return (
    <TouchableOpacity style={styles.propertyCard} onPress={() => onPress(item)}>
      <View style={styles.propertyInfo}>
        <Text style={styles.propertyAddress}>{item.address || 'Endereço não informado'}</Text>
        <View style={styles.propertyMeta}>
          <Text style={styles.propertyType}>{item.type}</Text>
          <View style={[styles.statusBadge, statusStyle]}>
            <Text style={[styles.statusText, hasTenant ? styles.rentedText : styles.availableText]}>
              {status}
            </Text>
          </View>
        </View>
        {item.rent && (
          <Text style={styles.propertyRent}>
            {formatCurrency(item.rent)}/mês
          </Text>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
    </TouchableOpacity>
  );
};

const SelectPropertyForContractScreen = ({ navigation }) => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado.');
      navigation.goBack();
      return;
    }

    // Buscar todas as propriedades
    const { data: allProperties, error } = await supabase
      .from('properties')
      .select(`
        *,
        tenants (*)
      `)
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('address', { ascending: true });

    if (error) {
      console.error('Error fetching properties:', error);
      Alert.alert('Erro', 'Não foi possível carregar as propriedades.');
      setLoading(false);
      return;
    }

    // Filtrar propriedades que não têm contratos ativos
    const availableProperties = [];
    for (const property of (allProperties || [])) {
      const { data: activeContract } = await fetchActiveContractByProperty(property.id);
      // Incluir apenas propriedades sem contrato ativo
      if (!activeContract) {
        availableProperties.push(property);
      }
    }

    setProperties(availableProperties);
    setLoading(false);
  };

  const handleSelectProperty = (property) => {
    navigation.navigate('SelectTenantForContract', { propertyId: property.id, property });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Selecionar Imóvel"
        onBack={() => navigation.goBack()}
      />
      {properties.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>Nenhum imóvel cadastrado</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('AddProperty')}
          >
            <Text style={styles.addButtonText}>Cadastrar Imóvel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PropertyItem item={item} onPress={handleSelectProperty} />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {
    padding: 15,
  },
  propertyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
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
  },
  propertyAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  propertyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  propertyType: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  propertyRent: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
  },
  rented: {
    backgroundColor: '#e8f5e9',
  },
  available: {
    backgroundColor: '#e3f2fd',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rentedText: {
    color: '#2e7d32',
  },
  availableText: {
    color: '#1565c0',
  },
  emptyText: {
    ...typography.body,
    marginBottom: 20,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  addButtonText: {
    ...typography.button,
    fontSize: 16,
  },
});

export default SelectPropertyForContractScreen;


