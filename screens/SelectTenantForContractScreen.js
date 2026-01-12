// screens/SelectTenantForContractScreen.js
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
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';

const TenantItem = ({ item, onPress, styles, theme }) => {
  const isOccupied = !!item.property_id;

  return (
    <TouchableOpacity style={styles.tenantCard} onPress={() => onPress(item)}>
      <Image
        source={item.photo_url
          ? { uri: item.photo_url }
          : require('../assets/avatar-placeholder.png')
        }
        style={styles.avatar}
      />
      <View style={styles.tenantInfo}>
        <Text style={styles.tenantName}>{item.full_name}</Text>
        <View style={styles.tenantMetaRow}>
          <MaterialIcons name="phone" size={16} color={theme.colors.textSecondary} />
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
      <MaterialIcons name="chevron-right" size={24} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );
};

const SelectTenantForContractScreen = ({ route, navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { propertyId, property } = route.params;
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado.');
      navigation.goBack();
      return;
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('user_id', user.id)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching tenants:', error);
      Alert.alert('Erro', 'Não foi possível carregar a lista de inquilinos.');
    } else {
      setTenants(data || []);
    }
    setLoading(false);
  };

  const handleSelectTenant = (tenant) => {
    navigation.navigate('AddContract', {
      propertyId: propertyId,
      tenantId: tenant.id,
      property: property,
    });
  };

  const handleCreateNewTenant = () => {
    navigation.navigate('AddTenant', { preselectedPropertyId: propertyId });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Selecionar Inquilino"
        onBack={() => navigation.goBack()}
      />
      {tenants.length === 0 ? (
        <View style={styles.centerContent}>
          <Text style={styles.emptyText}>Nenhum inquilino cadastrado</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleCreateNewTenant}
          >
            <Text style={styles.addButtonText}>Cadastrar Inquilino</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={tenants}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TenantItem item={item} onPress={handleSelectTenant} styles={styles} theme={theme} />
            )}
            contentContainerStyle={styles.listContent}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            initialNumToRender={10}
            windowSize={10}
          />
          <TouchableOpacity style={styles.fab} onPress={handleCreateNewTenant}>
            <MaterialIcons name="person-add" size={24} color="#fff" />
            <Text style={styles.fabText}>Novo Inquilino</Text>
          </TouchableOpacity>
        </>
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
    paddingBottom: 80,
  },
  tenantCard: {
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
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: '#ccc', // Add fallback
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: 16,
    ...theme.typography.bodyStrong,
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  tenantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenantMetaText: {
    marginLeft: 5,
    fontSize: 13,
    color: theme.colors.textSecondary,
    ...theme.typography.caption,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    marginRight: 10,
  },
  statusAvailable: {
    backgroundColor: theme.colors.primarySoft || '#e3f2fd',
    borderColor: theme.colors.primarySoft || '#bbdefb',
  },
  statusOccupied: {
    backgroundColor: theme.colors.successSoft || '#e8f5e9',
    borderColor: theme.colors.successSoft || '#c8e6c9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    ...theme.typography.caption,
  },
  statusAvailableText: {
    color: theme.colors.primaryDark || '#1565c0',
  },
  statusOccupiedText: {
    color: theme.colors.success || '#2e7d32',
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
  },
  addButtonText: {
    ...theme.typography.button,
    fontSize: 16,
    color: theme.colors.surface,
  },
  fab: {
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
  fabText: {
    marginLeft: 8,
    color: theme.colors.surface,
    fontWeight: 'bold',
    fontSize: 15,
    ...theme.typography.button,
  },
});

export default SelectTenantForContractScreen;


