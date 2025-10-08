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
import DropDownPicker from 'react-native-dropdown-picker'; // NEW IMPORT
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';

const AddTenantScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  // New state for the DropDownPicker
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null); // This will hold the selected property ID
  const [items, setItems] = useState([]);

  // Fetch properties and format them for the DropDownPicker
  useEffect(() => {
    const fetchProperties = async () => {
      const { data, error } = await supabase.from('properties').select('id, address');
      if (error) {
        Alert.alert('Error', 'Could not fetch properties.');
      } else {
        const formattedProperties = data.map(prop => ({
          label: prop.address,
          value: prop.id,
        }));
        setItems(formattedProperties);
      }
    };
    fetchProperties();
  }, []);

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
      property_id: value, // Use the 'value' from the dropdown state
      full_name: fullName,
      phone: phone,
      email: email,
      id_number: idNumber,
      rent_amount: parseInt(rentAmount, 10) || null,
      deposit: parseInt(deposit, 10) || null,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
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
    setStartDate(selectedDate || startDate);
  };

  const onEndDateChange = (event, selectedDate) => {
    setShowEndPicker(false);
    setEndDate(selectedDate || endDate);
  };

  return (
    <ScrollView 
        style={styles.container}
        // Add this keyboardShouldPersistTaps prop for better UX with the dropdown
        keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Adicionar Inquilino</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome Completo</Text>
        <TextInput
          style={styles.input}
          placeholder="Digite o nome do inquilino"
          value={fullName}
          onChangeText={setFullName}
        />
      </View>

      {/* THIS IS THE NEW COMBO BOX FOR PROPERTIES */}
      <View style={[styles.inputGroup, Platform.OS === 'android' && { zIndex: 1000 }]}>
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
            listMode="MODAL" // Use 'MODAL' for a better experience on mobile
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

      {/* ... other form fields ... */}
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
        <Text style={styles.label}>Número de Identificação</Text>
        <TextInput
          style={styles.input}
          placeholder="Atribua um número ao inquilino"
          value={idNumber}
          onChangeText={setIdNumber}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Data de locação</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowStartPicker(true)}
          >
            <Text>{format(startDate, 'MM/dd/yyyy')}</Text>
          </TouchableOpacity>
          <Text style={styles.dateSeparator}>to</Text>
          <TouchableOpacity
            style={styles.dateInput}
            onPress={() => setShowEndPicker(true)}
          >
            <Text>{format(endDate, 'MM/dd/yyyy')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Valor do Aluguel</Text>
        <TextInput
          style={styles.input}
          placeholder="Insira o valor do aluguel"
          value={rentAmount}
          onChangeText={setRentAmount}
          keyboardType="decimal-pad"
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

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={onStartDateChange}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={onEndDateChange}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
      },
      header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
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
        marginBottom: 50, // Add some margin at the bottom
      },
      addButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
      },
});

export default AddTenantScreen;