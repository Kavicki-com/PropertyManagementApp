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
import DropDownPicker from 'react-native-dropdown-picker';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';

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

  // Property Dropdown state
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(null);
  const [properties, setProperties] = useState([]);

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
      setPropertyId(tenant.property_id);
    }

    // Fetch available properties for the dropdown (apenas imóveis ativos)
    const fetchProperties = async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, address, rent')
        .is('archived_at', null);
      if (error) {
        console.error("Error fetching properties:", error);
      } else {
        const formattedProperties = data.map(p => ({ 
            label: p.address, 
            value: p.id,
            rent: p.rent 
        }));
        setProperties(formattedProperties);
      }
    };
    fetchProperties();
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
        property_id: propertyId,
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
                <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>CPF</Text>
                <TextInput 
                    style={styles.input} 
                    value={cpf} 
                    onChangeText={setCpf} 
                    keyboardType="numeric"
                    placeholder="Digite o CPF do inquilino"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>RG</Text>
                <TextInput 
                    style={styles.input} 
                    value={rg} 
                    onChangeText={setRg}
                    keyboardType="numeric"
                    placeholder="Digite o RG do inquilino"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nacionalidade</Text>
                <TextInput 
                    style={styles.input} 
                    value={nationality} 
                    onChangeText={setNationality}
                    placeholder="Ex: Brasileiro(a)"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Estado civil</Text>
                <TextInput 
                    style={styles.input} 
                    value={maritalStatus} 
                    onChangeText={setMaritalStatus}
                    placeholder="Ex: Solteiro(a), Casado(a)"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Profissão</Text>
                <TextInput 
                    style={styles.input} 
                    value={profession} 
                    onChangeText={setProfession}
                    placeholder="Ex: Engenheiro, Professora"
                />
            </View>
            
            <View style={[styles.inputGroup, Platform.OS === 'android' && { zIndex: 1000 }]}>
              <Text style={styles.label}>Propriedade</Text>
              <DropDownPicker
                open={open}
                value={propertyId}
                items={properties}
                setOpen={setOpen}
                setValue={setPropertyId}
                setItems={setProperties}
                searchable={true}
                placeholder="Selecione uma propriedade"
                listMode="MODAL"
                clearable={true}
                labelProps={{
                  numberOfLines: 1,
                  ellipsizeMode: 'tail',
                }}
              />
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
        borderRadius: 8, 
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