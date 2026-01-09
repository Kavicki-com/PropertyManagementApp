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
import { filterOnlyLetters, filterOnlyNumbers, isValidCPF, isValidEmail, isValidPhone } from '../lib/validation';
import { radii } from '../theme';
import { SelectList } from 'react-native-dropdown-select-list';
import { removeCache, CACHE_KEYS } from '../lib/cacheService';

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
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Nome completo é obrigatório';
    } else if (fullName.trim().length < 3) {
      newErrors.fullName = 'Nome deve ter pelo menos 3 caracteres';
    }

    if (!cpf.trim()) {
      newErrors.cpf = 'CPF é obrigatório';
    } else if (!isValidCPF(cpf)) {
      newErrors.cpf = 'CPF inválido. Verifique os dígitos.';
    }

    if (!rg.trim()) {
      newErrors.rg = 'RG é obrigatório';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Telefone é obrigatório';
    } else if (!isValidPhone(phone)) {
      newErrors.phone = 'Telefone inválido. Use formato (00) 00000-0000';
    }

    if (email.trim() && !isValidEmail(email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useEffect(() => {
    // Preencher formulário com dados do inquilino
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
    if (!validate()) {
      Alert.alert('Verifique os dados', 'Alguns campos precisam de atenção antes de salvar.');
      return;
    }

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
      Alert.alert('Erro ao atualizar inquilino', error.message);
    } else {
      // Invalidar cache de inquilinos
      await removeCache(CACHE_KEYS.TENANTS);
      if (tenant.id) {
        await removeCache(CACHE_KEYS.TENANT_DETAILS(tenant.id));
      }
      
      Alert.alert('Sucesso', 'Inquilino atualizado com sucesso!');
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
                    style={[styles.input, errors.fullName && styles.inputError]} 
                    value={fullName} 
                    onChangeText={(text) => {
                      setFullName(filterOnlyLetters(text));
                      if (errors.fullName) setErrors({ ...errors, fullName: null });
                    }}
                    placeholder="Digite o nome do inquilino"
                />
                {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>CPF</Text>
                <TextInput 
                    style={[styles.input, errors.cpf && styles.inputError]} 
                    value={cpf} 
                    onChangeText={(text) => {
                      setCpf(filterOnlyNumbers(text));
                      if (errors.cpf) setErrors({ ...errors, cpf: null });
                    }} 
                    keyboardType="numeric"
                    placeholder="Digite o CPF do inquilino"
                    maxLength={11}
                />
                {errors.cpf && <Text style={styles.errorText}>{errors.cpf}</Text>}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>RG</Text>
                <TextInput 
                    style={[styles.input, errors.rg && styles.inputError]} 
                    value={rg} 
                    onChangeText={(text) => {
                      setRg(filterOnlyNumbers(text));
                      if (errors.rg) setErrors({ ...errors, rg: null });
                    }}
                    keyboardType="numeric"
                    placeholder="Digite o RG do inquilino"
                />
                {errors.rg && <Text style={styles.errorText}>{errors.rg}</Text>}
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
                <SelectList
                    setSelected={(val) => setMaritalStatus(val)}
                    data={[
                        { key: 'Solteiro', value: 'Solteiro' },
                        { key: 'Casado', value: 'Casado' },
                        { key: 'União Estável', value: 'União Estável' },
                        { key: 'Divorciado', value: 'Divorciado' },
                    ]}
                    save="value"
                    placeholder="Selecione o estado civil"
                    defaultOption={maritalStatus ? { key: maritalStatus, value: maritalStatus } : undefined}
                    boxStyles={styles.dropdown}
                    inputStyles={styles.dropdownText}
                    dropdownStyles={styles.dropdownContainer}
                    search={false}
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
                    style={[styles.input, errors.phone && styles.inputError]} 
                    value={phone} 
                    onChangeText={(text) => {
                      setPhone(filterOnlyNumbers(text));
                      if (errors.phone) setErrors({ ...errors, phone: null });
                    }} 
                    keyboardType="phone-pad"
                    maxLength={11}
                />
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput 
                    style={[styles.input, errors.email && styles.inputError]} 
                    value={email} 
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email) setErrors({ ...errors, email: null });
                    }} 
                    keyboardType="email-address"
                    autoCapitalize="none"
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <TouchableOpacity style={styles.updateButton} onPress={handleUpdateTenant} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
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
    inputError: {
        borderColor: '#F44336',
        borderWidth: 2,
    },
    errorText: {
        color: '#F44336',
        fontSize: 12,
        marginTop: 4,
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
    dropdown: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        minHeight: 50,
        overflow: 'hidden',
        width: '100%',
    },
    dropdownText: {
        fontSize: 16,
        color: '#333',
    },
    dropdownContainer: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        backgroundColor: '#fff',
    },
});

export default EditTenantScreen;