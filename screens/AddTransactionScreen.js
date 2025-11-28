// screens/AddTransactionScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SelectList } from 'react-native-dropdown-select-list';
import { supabase } from '../lib/supabase';
import { fetchActiveContractByProperty } from '../lib/contractsService';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, radii, typography } from '../theme';

const AddTransactionScreen = ({ route, navigation }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const preselectedPropertyId = route?.params?.preselectedPropertyId ?? null;
  const [propertyValue, setPropertyValue] = useState(preselectedPropertyId || null);
  const [propertyItems, setPropertyItems] = useState([]);
  const preselectedTenantId = route?.params?.preselectedTenantId ?? null;
  
  const preselectedType = route?.params?.preselectedType ?? 'income';
  const [typeValue, setTypeValue] = useState(preselectedType);
  const [typeItems] = useState([
    { key: 'income', value: 'Entrada' },
    { key: 'expense', value: 'Despesa' },
    { key: 'rent', value: 'Aluguel' },
  ]);

  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, address')
        .is('archived_at', null);
      if (error) {
        Alert.alert('Error', 'Could not fetch properties.');
      } else {
        const formattedProperties = data.map(prop => ({
          key: prop.id,
          value: prop.address,
        }));
        setPropertyItems(formattedProperties);
      }
    };
    fetchProperties();
  }, []);

  const handleAddTransaction = async () => {
    if (!description || !amount || !propertyValue) {
      Alert.alert('Error', 'Please fill out all fields.');
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      setLoading(false);
      return;
    }

    // Descobrir tenant_id a ser usado (se vier da tela do inquilino já temos,
    // senão, para tipo "Aluguel", buscamos o contrato ativo do imóvel)
    let tenantIdForInsert = preselectedTenantId ?? null;

    if (!tenantIdForInsert && typeValue === 'rent') {
      const { data: activeContract, error: contractError } =
        await fetchActiveContractByProperty(propertyValue || null);

      if (contractError) {
        console.error('Erro ao buscar contrato ativo para lançamento de aluguel:', contractError);
      } else if (activeContract?.tenant_id) {
        tenantIdForInsert = activeContract.tenant_id;
      }
    }

    const dbType = typeValue === 'rent' ? 'income' : typeValue;
    const finalDescription =
      description || (typeValue === 'rent' ? 'Aluguel' : '');

    const { error } = await supabase.from('finances').insert({
      user_id: user.id,
      property_id: propertyValue || null,
      tenant_id: tenantIdForInsert,
      description: finalDescription,
      amount: parseFloat(amount),
      type: dbType,
      date: new Date().toISOString(),
    });

    if (error) {
      Alert.alert('Error adding transaction', error.message);
    } else {
      Alert.alert('Success', 'Transaction added successfully!');
      navigation.goBack();
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
        <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back-ios" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.header}>Adicionar Transação</Text>
            <View style={{ width: 24 }} />
        </View>
        <ScrollView 
            style={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
        >

        {/* Property Dropdown */}
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Propriedade</Text>
            <SelectList
                setSelected={(val) => setPropertyValue(val)}
                data={propertyItems}
                save="key"
                placeholder="Selecione uma propriedade"
                defaultOption={propertyValue ? propertyItems.find(p => p.key === propertyValue) : undefined}
                boxStyles={styles.dropdown}
                inputStyles={styles.dropdownText}
                dropdownStyles={styles.dropdownContainer}
                search={false}
            />
        </View>
        
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
            style={styles.input}
            placeholder="Ex: Aluguel, Reforma, Manutenção"
            value={description}
            onChangeText={setDescription}
            />
        </View>

        <View style={styles.inputGroup}>
            <Text style={styles.label}>Valor (R$)</Text>
            <TextInput
            style={styles.input}
            placeholder="Ex: 1200"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            />
        </View>

        {/* Type Dropdown */}
        <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo</Text>
            <SelectList
                setSelected={(val) => setTypeValue(val)}
                data={typeItems}
                save="key"
                placeholder="Selecione o tipo"
                defaultOption={typeValue ? typeItems.find(t => t.key === typeValue) : undefined}
                boxStyles={styles.dropdown}
                inputStyles={styles.dropdownText}
                dropdownStyles={styles.dropdownContainer}
                search={false}
            />
        </View>

        <TouchableOpacity style={styles.addButton} onPress={handleAddTransaction} disabled={loading}>
            {loading ? (
            <ActivityIndicator color="white" />
            ) : (
            <Text style={styles.addButtonText}>Adicionar Transação</Text>
            )}
        </TouchableOpacity>
        </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backButton: {
      padding: 5,
  },
  header: {
    ...typography.sectionTitle,
    textAlign: 'left',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    ...typography.label,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: 'white',
    ...typography.button,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    minHeight: 50,
    overflow: 'hidden',
  },
  dropdownText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
});

export default AddTransactionScreen;