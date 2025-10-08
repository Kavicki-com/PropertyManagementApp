// screens/EditTenantScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

const EditTenantScreen = ({ route, navigation }) => {
  const { tenant } = route.params;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tenant) {
      setFullName(tenant.full_name);
      setPhone(tenant.phone);
      setEmail(tenant.email);
    }
  }, [tenant]);

  const handleUpdateTenant = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('tenants')
      .update({
        full_name: fullName,
        phone: phone,
        email: email,
      })
      .eq('id', tenant.id);

    if (error) {
      Alert.alert('Error updating tenant', error.message);
    } else {
      Alert.alert('Success', 'Tenant updated successfully!');
      navigation.goBack();
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Editar Inquilino</Text>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome Completo</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Telefone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />
      </View>

      <TouchableOpacity style={styles.updateButton} onPress={handleUpdateTenant} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    inputGroup: { marginBottom: 20 },
    label: { marginBottom: 8, fontWeight: '500' },
    input: { height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, fontSize: 16 },
    updateButton: { backgroundColor: '#FF9800', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default EditTenantScreen;