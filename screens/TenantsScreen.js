// screens/TenantsScreen.js
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

const TenantItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.tenantCard} onPress={() => onPress(item)}>
    <Image
      source={require('../assets/avatar-placeholder.png')}
      style={styles.avatar}
    />
    <View style={styles.tenantInfo}>
      <Text style={styles.tenantName}>{item.full_name}</Text>
      {/* We will add property address later */}
    </View>
    <View style={styles.tenantStatus}>
      <Text style={styles.statusActive}>Ativo</Text>
    </View>
  </TouchableOpacity>
);

const TenantsScreen = ({ navigation }) => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchTenants = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tenants').select('*');

    if (error) {
      console.error('Error fetching tenants:', error);
    } else {
      setTenants(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isFocused) {
      fetchTenants();
    }
  }, [isFocused]);

  const handleTenantPress = (tenant) => {
    navigation.navigate('TenantDetails', { tenant });
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
      <Text style={styles.header}>Inquilinos</Text>
      <FlatList
        data={tenants}
        renderItem={({ item }) => <TenantItem item={item} onPress={handleTenantPress} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddTenant')}
      >
        <MaterialIcons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
};

// ... (Your styles remain the same)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
    position: 'relative',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  listContent: {
    paddingBottom: 80,
  },
  tenantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  tenantAddress: {
    color: '#666',
    fontSize: 14,
  },
  tenantStatus: {
    backgroundColor: '#e8f5e9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusActive: {
    color: '#4CAF50',
    fontWeight: '500',
    fontSize: 12,
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

export default TenantsScreen;