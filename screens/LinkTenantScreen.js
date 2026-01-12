// screens/LinkTenantScreen.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { useIsFocused } from '@react-navigation/native';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';

const TenantItem = ({ item, onPress, styles }) => {
  const isOccupied = !!item.property_id;

  return (
    <TouchableOpacity style={styles.tenantCard} onPress={() => onPress(item)}>
      <Image
        source={item.photo_url || require('../assets/avatar-placeholder.png')}
        style={styles.avatar}
        contentFit="cover"
        transition={200}
        placeholder={require('../assets/avatar-placeholder.png')}
        cachePolicy="memory-disk"
      />
      <View style={styles.tenantInfo}>
        <Text style={styles.tenantName}>{item.full_name}</Text>
        <View style={styles.tenantMetaRow}>
          <MaterialIcons name="phone" size={16} color={styles.tenantMetaText.color} />
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
  const isFocused = useIsFocused();
  const { theme } = useAccessibilityTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    // Query otimizada - buscar apenas campos necessários
    const { data, error } = await supabase
      .from('tenants')
      .select('id, full_name, phone, photo_url, property_id')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching tenants:', error);
      Alert.alert('Erro', 'Não foi possível carregar a lista de inquilinos.');
    } else {
      setTenants(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isFocused) {
      fetchTenants();
    }
  }, [isFocused]);

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
            : 'Inquilino vinculado à propriedade.',
          [
            {
              text: 'Criar Contrato',
              onPress: () => {
                // Buscar dados completos do imóvel
                supabase
                  .from('properties')
                  .select('*')
                  .eq('id', propertyId)
                  .single()
                  .then(({ data: propertyData, error: propError }) => {
                    if (propError || !propertyData) {
                      Alert.alert('Aviso', 'Não foi possível carregar os dados do imóvel.');
                      navigation.goBack();
                    } else {
                      navigation.replace('AddContract', {
                        propertyId: propertyId,
                        tenantId: tenant.id,
                        property: propertyData,
                      });
                    }
                  });
              },
            },
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
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
        <ActivityIndicator size="large" color={theme.colors.primary} />
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
        renderItem={({ item }) => <TenantItem item={item} onPress={handleSelectTenant} styles={styles} />}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />

      <TouchableOpacity style={styles.addButton} onPress={handleCreateNewTenant}>
        <MaterialIcons name="person-add" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Cadastrar novo inquilino</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    padding: 15,
    paddingBottom: 80,
  },
  tenantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    ...(theme.isHighContrast ? {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
      shadowOpacity: 0,
      elevation: 0,
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: theme.colors.borderSubtle,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    ...theme.typography.bodyStrong,
    color: theme.colors.textPrimary,
  },
  tenantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  tenantMetaText: {
    marginLeft: 5,
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
  },
  statusAvailable: {
    backgroundColor: theme.colors.surfaceHighlight || '#e3f2fd',
    borderColor: theme.colors.primary,
  },
  statusOccupied: {
    backgroundColor: '#e8f5e9',
    borderColor: '#c8e6c9',
  },
  statusText: {
    ...theme.typography.caption,
    fontWeight: '600',
  },
  statusAvailableText: {
    color: theme.colors.primary,
  },
  statusOccupiedText: {
    color: '#2e7d32',
  },
  addButton: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 20,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radii.pill,
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
    ...theme.typography.button,
  },
});

export default LinkTenantScreen;


