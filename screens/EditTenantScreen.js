// screens/EditTenantScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { filterOnlyLetters, filterOnlyNumbers } from '../lib/validation';
import { radii } from '../theme';

const EditTenantScreen = ({ route, navigation }) => {
  const { tenant } = route.params;

  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [nationality, setNationality] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [profession, setProfession] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-fill form with tenant data
    if (tenant) {
      setFullName(tenant.full_name || '');
      setCpf(tenant.cpf || '');
      setRg(tenant.rg || '');
      setNationality(tenant.nationality || '');
      setMaritalStatus(tenant.marital_status || '');
      setProfession(tenant.profession || '');
      setPhone(tenant.phone || '');
      setEmail(tenant.email || '');
    }
  }, [tenant]);
  
  const handleUpdateTenant = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('tenants')
      .update({
        full_name: fullName,
        cpf: cpf,
        rg: rg,
        nationality,
        marital_status: maritalStatus,
        profession,
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
    <View style={styles.container}>
        <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.header}>Editar Inquilino</Text>
            <View style={{ width: 24 }} />
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 32 : 0}
        >
        <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome Completo</Text>
                <TextInput 
                    style={styles.input} 
                    value={fullName} 
                    onChangeText={(text) => setFullName(filterOnlyLetters(text))}
                    placeholder="Digite o nome do inquilino"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>CPF</Text>
                <TextInput 
                    style={styles.input} 
                    value={cpf} 
                    onChangeText={(text) => setCpf(filterOnlyNumbers(text))} 
                    keyboardType="numeric"
                    placeholder="Digite o CPF do inquilino"
                    maxLength={11}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>RG</Text>
                <TextInput 
                    style={styles.input} 
                    value={rg} 
                    onChangeText={(text) => setRg(filterOnlyNumbers(text))}
                    keyboardType="numeric"
                    placeholder="Digite o RG do inquilino"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nacionalidade</Text>
                <TextInput 
                    style={styles.input} 
                    value={nationality} 
                    onChangeText={(text) => setNationality(filterOnlyLetters(text))}
                    placeholder="Ex: Brasileiro"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Estado civil</Text>
                <TextInput 
                    style={styles.input} 
                    value={maritalStatus} 
                    onChangeText={(text) => setMaritalStatus(filterOnlyLetters(text))}
                    placeholder="Ex: Solteiro, Casado"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Profissão</Text>
                <TextInput 
                    style={styles.input} 
                    value={profession} 
                    onChangeText={(text) => setProfession(filterOnlyLetters(text))}
                    placeholder="Ex: Engenheiro, Professora"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput 
                    style={styles.input} 
                    value={phone} 
                    onChangeText={(text) => setPhone(filterOnlyNumbers(text))} 
                    keyboardType="phone-pad"
                    maxLength={11}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput 
                    style={styles.input} 
                    value={email} 
                    onChangeText={setEmail} 
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
            </View>

            <TouchableOpacity style={styles.updateButton} onPress={handleUpdateTenant} disabled={loading}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
            </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#f5f5f5',
    },
    scrollContainer: {
        flex: 1,
        padding: 20,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        paddingTop: 50,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    backButton: {
        padding: 5,
    },
    header: { 
        fontSize: 22, 
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'left',
        flex: 1,
    },
    inputGroup: { 
        marginBottom: 20,
    },
    label: { 
        marginBottom: 8, 
        fontWeight: '500',
    },
    input: { 
        height: 50, 
        borderWidth: 1, 
        borderColor: '#ddd', 
        borderRadius: 8, 
        paddingHorizontal: 15, 
        fontSize: 16,
    },
    disabledInput: {
        backgroundColor: '#f5f5f5',
        color: '#666',
    },
    dateRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
    },
    dateInput: { 
        flex: 1, 
        height: 50, 
        borderWidth: 1, 
        borderColor: '#ddd', 
        borderRadius: 8, 
        paddingHorizontal: 15, 
        justifyContent: 'center',
    },
    dateSeparator: { 
        marginHorizontal: 10, 
        color: '#666',
    },
    updateButton: { 
        backgroundColor: '#4a86e8', 
        padding: 15, 
        borderRadius: radii.pill, 
        alignItems: 'center', 
        marginTop: 10,
    },
    buttonText: { 
        color: 'white', 
        fontWeight: 'bold', 
        fontSize: 16,
    },
});

export default EditTenantScreen;