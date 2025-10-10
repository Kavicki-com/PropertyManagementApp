// screens/AddTenantScreen.js
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
import DropDownPicker from 'react-native-dropdown-picker';
import { format, differenceInMonths } from 'date-fns';
import { supabase } from '../lib/supabase';
import CustomDatePicker from '../components/CustomDatePicker';
import { MaterialIcons } from '@expo/vector-icons';

const AddTenantScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contractLength, setContractLength] = useState(0);

  // DropDownPicker state
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase.from('properties').select('id, address, rent');
      if (error) {
        Alert.alert('Error', 'Could not fetch properties.');
      } else {
        const formattedProperties = data.map(prop => ({
          label: prop.address,
          value: prop.id,
          rent: prop.rent,
        }));
        setItems(formattedProperties);
      }
    };
    fetchProperties();
  }, []);

  useEffect(() => {
    if (value) {
      const selectedProperty = items.find(item => item.value === value);
      if (selectedProperty && selectedProperty.rent) {
        setRentAmount(selectedProperty.rent.toString());
      }
    } else {
      setRentAmount('');
    }
  }, [value, items]);

  useEffect(() => {
    const months = differenceInMonths(endDate, startDate);
    setContractLength(months);
  }, [startDate, endDate]);

  const handleAddTenant = async () => {
    if (!value) {
      Alert.alert('Erro', 'Por favor, selecione uma propriedade.');
      return;
    }
    
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado para adicionar um inquilino.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('tenants').insert({
      user_id: user.id,
      property_id: value,
      full_name: fullName,
      phone: phone,
      email: email,
      rent_amount: parseInt(rentAmount, 10) || null,
      deposit: parseInt(deposit, 10) || null,
      due_date: parseInt(dueDate, 10) || null,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      lease_term: contractLength,
    });

    if (error) {
      Alert.alert('Erro ao adicionar inquilino', error.message);
    } else {
      Alert.alert('Sucesso', 'Inquilino adicionado com sucesso!');
      navigation.goBack();
    }
    setLoading(false);
  };

  const onStartDateChange = (event, selectedDate) => {
    setShowStartPicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndPicker(false);
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  return (
    <View style={styles.container}>
        <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.header}>Adicionar Inquilino</Text>
            <View style={{ width: 24 }} />
        </View>
        <ScrollView 
            style={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
        >
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome Completo</Text>
                <TextInput
                style={styles.input}
                placeholder="Digite o nome do inquilino"
                value={fullName}
                onChangeText={setFullName}
                />
            </View>

            <View style={[styles.inputGroup, { zIndex: 1000 }]}>
                <Text style={styles.label}>Propriedade</Text>
                <DropDownPicker
                    open={open}
                    value={value}
                    items={items}
                    setOpen={setOpen}
                    setValue={setValue}
                    setItems={setItems}
                    searchable={true}
                    placeholder="Selecione uma propriedade"
                    listMode="MODAL"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                style={styles.input}
                placeholder="Digite o telefone do inquilino"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                style={styles.input}
                placeholder="Digite o email do inquilino"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Data de locação</Text>
                <View style={styles.dateRow}>
                <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowStartPicker(true)}
                >
                    <Text>{format(startDate, 'dd/MM/yyyy')}</Text>
                </TouchableOpacity>
                <Text style={styles.dateSeparator}>até</Text>
                <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => setShowEndPicker(true)}
                >
                    <Text>{format(endDate, 'dd/MM/yyyy')}</Text>
                </TouchableOpacity>
                </View>
            </View>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Duração do Contrato (meses)</Text>
                <TextInput
                style={[styles.input, styles.disabledInput]}
                value={`${contractLength} meses`}
                editable={false}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Valor do Aluguel</Text>
                <TextInput
                style={styles.input}
                placeholder="Selecione uma propriedade para preencher"
                value={rentAmount}
                onChangeText={setRentAmount}
                keyboardType="decimal-pad"
                />
            </View>
            
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Dia do Vencimento do Aluguel</Text>
                <TextInput
                style={styles.input}
                placeholder="Ex: 5"
                value={dueDate}
                onChangeText={setDueDate}
                keyboardType="numeric"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Depósito Caução</Text>
                <TextInput
                style={styles.input}
                placeholder="Insira o valor de depósito"
                value={deposit}
                onChangeText={setDeposit}
                keyboardType="decimal-pad"
                />
            </View>

            <TouchableOpacity style={styles.addButton} onPress={handleAddTenant} disabled={loading}>
                {loading ? (
                <ActivityIndicator color="white" />
                ) : (
                <Text style={styles.addButtonText}>Adicionar Inquilino</Text>
                )}
            </TouchableOpacity>

            <CustomDatePicker
                visible={showStartPicker}
                date={startDate}
                onDateChange={onStartDateChange}
                onClose={() => setShowStartPicker(false)}
            />

            <CustomDatePicker
                visible={showEndPicker}
                date={endDate}
                onDateChange={onEndDateChange}
                onClose={() => setShowEndPicker(false)}
            />
        </ScrollView>
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
        backgroundColor: '#f0f0f0',
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
    addButton: {
        backgroundColor: '#4a86e8',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 50,
    },
    addButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

export default AddTenantScreen;