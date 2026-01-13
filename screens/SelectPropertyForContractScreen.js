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
import { PropertiesListSkeleton } from '../components/SkeletonLoader';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';
import { fetchActiveContractByProperty } from '../lib/contractsService';

// Função para formatar valor monetário
const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00';
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
};

const PropertyItem = ({ item, onPress, styles, theme }) => {
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
      <MaterialIcons name="chevron-right" size={24} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
};

const SelectPropertyForContractScreen = ({ navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
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
      <View style={styles.container}>
        <ScreenHeader
          title="Selecionar Imóvel"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.listContent}>
          <PropertiesListSkeleton />
        </View>
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
            <PropertyItem item={item} onPress={handleSelectProperty} styles={styles} theme={theme} />
          )}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          windowSize={10}
        />
      )}
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
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
    ...theme.typography.bodyStrong,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  propertyMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  propertyType: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    ...theme.typography.caption,
  },
  propertyRent: {
    fontSize: 14,
    ...theme.typography.bodyStrong,
    color: theme.colors.primary,
    marginTop: 4,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radii.pill,
  },
  rented: {
    backgroundColor: theme.colors.successSoft || '#e8f5e9',
  },
  available: {
    backgroundColor: theme.colors.primarySoft || '#e3f2fd',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    ...theme.typography.caption,
  },
  rentedText: {
    color: theme.colors.success || '#2e7d32',
  },
  availableText: {
    color: theme.colors.primaryDark || '#1565c0',
  },
  emptyText: {
    ...theme.typography.body,
    marginBottom: 20,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radii.pill,
    marginTop: 20, // Added to separate from text
  },
  addButtonText: {
    ...theme.typography.button,
    fontSize: 16,
    color: theme.colors.surface,
  },
});

export default SelectPropertyForContractScreen;


