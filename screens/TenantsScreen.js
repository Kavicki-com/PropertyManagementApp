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

// Updated TenantItem to display more information
const TenantItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.tenantCard} onPress={() => onPress(item)}>
    <Image
      source={require('../assets/avatar-placeholder.png')}
      style={styles.avatar}
    />
    <View style={styles.tenantInfo}>
      <Text style={styles.tenantName}>{item.full_name}</Text>
      <View style={styles.tenantMeta}>
        <MaterialIcons name="phone" size={16} color="#666" />
        <Text style={styles.tenantMetaText}>{item.phone || 'N/A'}</Text>
      </View>
    </View>
    <View style={styles.dueDateContainer}>
      <Text style={styles.dueDateLabel}>Vencimento</Text>
      <Text style={styles.dueDateText}>Dia {item.due_date || 'N/A'}</Text>
    </View>
  </TouchableOpacity>
);

const TenantsScreen = ({ navigation }) => {
  const [tenants, setTenants] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
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

  React.useEffect(() => {
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
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Inquilinos</Text>
      </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    padding: 15,
    paddingTop: 50, // Safe area for status bar
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
  tenantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: 'bold',
    fontSize: 17,
    marginBottom: 5,
    color: '#333',
  },
  tenantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tenantMetaText: {
    color: '#666',
    fontSize: 14,
    marginLeft: 5,
  },
  dueDateContainer: {
    alignItems: 'center',
    paddingLeft: 10,
  },
  dueDateLabel: {
    fontSize: 12,
    color: '#888',
  },
  dueDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4a86e8',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});

export default TenantsScreen;

